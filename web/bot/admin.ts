/** The admin's window on the bot (phase 6): an RPC entrypoint the website's service binding calls
 *  (web/wrangler.jsonc BOT → BotAdmin). An entrypoint is reachable only through a binding, never
 *  from the internet, so the website holds no Supabase key. The website checks the admin first
 *  (requireAdmin); every call here is bounded. */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { clip, clock, embed, gatewayCall, q, sb, sbCount, vec, viaGateway, type Env } from './io';
import { LANGS, type Lang } from './text';
import { flushOut, generalise, newVersion, relay, supersedeNear, webChat, withRun, type Contact } from './worker';
import { MONEY } from './text';

export type Speaker = 'client' | 'bot' | 'team' | 'alert';
export interface ChatLine { at: string; who: Speaker; body: string }
export interface Answer {
  id: number; question_en: string; answer_en: string; status: 'pending' | 'approved' | 'rejected' | 'superseded' | 'archived'; source: 'site' | 'team';
  wins: number; translations_ok: boolean; created_at: string; version: number; supersedes: number | null; review_at: string | null;
  decided_by: string | null; decided_at: string | null;
}
export type WhatsAppLink = { mode: 'cloud' } | { mode: 'baileys'; reachable: false; error: string }
  | { mode: 'baileys'; reachable: true; connected: boolean; me: string | null; since: string | null; qr: string | null };
export interface OpenQuestion { id: number; code: string; name: string | null; lang: string | null; lead_id: string | null; question: string; question_en: string; kind: string; created_at: string }
export interface Health {
  unhandled: number; oldestUnhandled: string | null; lastIn: string | null; openQuestions: number; pendingAnswers: number;
  pastReview: number; withPerson: number; aiToday: number; aiCap: number;
}
export interface Insights {
  days: number; questions: number; byBot: number; byTeam: number; open: number;
  top: { question: string; count: number; byBot: number }[];
  answers: { approved: number; pending: number; rejected: number };
}

type Row = Record<string, unknown>;
const ANSWER_COLS = 'id,question_en,answer_en,status,source,wins,translations_ok,created_at,version,supersedes,review_at,decided_by,decided_at';
const NO_MONEY = 'The bot never sends an answer with prices, amounts, percentages or long numbers (those are the team’s to give): leave this one to the team, or write it without them.';
const KEY = (s: string) => s.trim().toLowerCase().replace(/[?.!\s]+$/, '');

export class BotAdmin extends WorkerEntrypoint<Env> {
  /** The website chat bubble, forwarded by the site's /api/chat (app/api/chat/route.ts). */
  async fetch(req: Request): Promise<Response> {
    return new URL(req.url).pathname === '/chat' ? webChat(req, this.env, this.ctx) : new Response('Not found', { status: 404 });
  }

  /** The WhatsApp conversation behind a lead (this enquiry or an earlier one), oldest first:
   *  the client, the bot's replies, the team's messages and the bot's alerts to the team. */
  async chat(leadId: string): Promise<{ code: string; name: string | null; mode: string; lang: string | null; lines: ChatLine[] } | null> {
    const env = this.env;
    const fields = 'wa_id,code,profile_name,fields,mode,lang';
    let [c] = await sb<Row>(env, 'GET', `contacts?lead_id=eq.${q(leadId)}&select=${fields}`);
    if (!c) [c] = await sb<Row>(env, 'GET', `contacts?fields->prev_leads=cs.${q(JSON.stringify([leadId]))}&select=${fields}`);
    if (!c) return null;
    // the newest 500, oldest first (a long chat keeps its latest messages)
    const rows = (await sb<Row>(env, 'GET', `messages?wa_id=eq.${q(String(c.wa_id))}&order=at.desc,wamid.desc&limit=500&select=at,dir,team,body,reply_id`)).reverse();
    const lines: ChatLine[] = [];
    for (const r of rows) {
      const line: ChatLine = {
        at: String(r.at),
        who: r.team ? (r.dir === 'in' ? 'team' : 'alert') : r.dir === 'in' ? 'client' : r.reply_id === 'team' ? 'team' : 'bot',
        body: clip(String(r.body ?? (String(r.reply_id ?? '').startsWith('media:') ? '📎 a file or voice note' : r.reply_id ?? '')), 4000),
      };
      const before = lines.findLast((l) => l.who === 'alert');                 // the same alert to each member: shown once
      if (line.who === 'alert' && before?.body === line.body && Date.parse(line.at) - Date.parse(before.at) < 60_000) continue;
      lines.push(line);
    }
    return { code: String(c.code), name: ((c.fields as Row)?.name as string) || (c.profile_name as string) || null, mode: String(c.mode ?? 'bot'), lang: (c.lang as string) ?? null, lines };
  }

  /** How WhatsApp is connected: Meta's Cloud API, or WhatsApp Web through the gateway (linked or
   *  not, and the QR to scan while not). Admin → WhatsApp → Connection. */
  async whatsapp(): Promise<WhatsAppLink> {
    if (this.env.WA_TRANSPORT !== 'baileys') return { mode: 'cloud' };
    if (!viaGateway(this.env)) return { mode: 'baileys', reachable: false, error: 'The gateway’s address is not set yet: add BAILEYS_URL as a secret of the bot Worker (SETUP.md step 13).' };
    try {
      const { status, data } = await gatewayCall(this.env, 'GET', '/status');
      if (status !== 200) return { mode: 'baileys', reachable: false, error: status === 401 ? 'The gateway refused the signature: WA_APP_SECRET must be the same on both.' : `The gateway answered ${status}.` };
      return { mode: 'baileys', reachable: true, connected: !!data.connected, me: (data.me as string) ?? null, since: (data.since as string) ?? null, qr: (data.qr as string) ?? null };
    } catch { return { mode: 'baileys', reachable: false, error: 'The gateway is not reachable (is it running, and is BAILEYS_URL right?).' }; }
  }

  /** Link the bot's number with an 8-character code (WhatsApp → Linked devices → Link with phone
   *  number), or unlink it (a new QR follows). Owners only (the website checks). */
  async whatsappAdmin(action: 'pair' | 'logout', phone?: string): Promise<{ ok: true; code?: string } | { error: string }> {
    if (this.env.WA_TRANSPORT !== 'baileys') return { error: 'WhatsApp uses the Cloud API here: nothing to link.' };
    if (!viaGateway(this.env)) return { error: 'The gateway’s address (BAILEYS_URL) is not set yet.' };
    const { status, data } = await gatewayCall(this.env, 'POST', '/admin', { action, phone }).catch(() => ({ status: 0, data: {} as Record<string, unknown> }));
    if (status === 200) return { ok: true, ...(data.code ? { code: String(data.code) } : {}) };
    return { error: status === 409 ? 'Already linked: log out first to link another number.' : status === 400 ? 'Check the phone number (with the country code).' : status === 0 ? 'The gateway is not reachable.' : `The gateway answered ${status}.` };
  }

  /** The team's open questions (oldest first), with the client's code: Admin → WhatsApp → Questions. */
  async openQuestions(): Promise<OpenQuestion[]> {
    const qs = await sb<Row>(this.env, 'GET', 'questions?status=eq.pending&kind=neq.auto&order=created_at.asc&limit=50&select=id,wa_id,question,question_en,kind,created_at');
    if (!qs.length) return [];
    const ids = [...new Set(qs.map((x) => String(x.wa_id)))];
    const cs = await sb<Row>(this.env, 'GET', `contacts?wa_id=in.${q(`(${ids.map((w) => `"${w}"`).join(',')})`)}&select=wa_id,code,lang,lead_id,profile_name,fields`);
    const by = new Map(cs.map((c) => [String(c.wa_id), c]));
    return qs.filter((x) => by.has(String(x.wa_id))).map((x) => {
      const c = by.get(String(x.wa_id))!;
      return { id: Number(x.id), code: String(c.code), name: ((c.fields as Row)?.name as string) || (c.profile_name as string) || null, lang: (c.lang as string) ?? null,
        lead_id: (c.lead_id as string) ?? null, question: String(x.question ?? ''), question_en: String(x.question_en ?? ''), kind: String(x.kind), created_at: String(x.created_at) };
    });
  }

  /** An admin answers an open question: it goes to the client in their language (as a team
   *  member's reply would), the question is closed, and the answer waits in Answers as a draft
   *  for someone to switch on (never used by the bot until then). */
  async answerQuestion(id: number, text: string, by: string): Promise<{ ok: true; note: string } | { error: string }> {
    const answer = text.trim();
    if (answer.length < 2) return { error: 'Write the answer.' };
    const env = withRun(this.env), now = clock.now();
    const [question] = await sb<Row>(env, 'GET', `questions?id=eq.${Number(id)}&select=id,wa_id,question_en,kind,status`);
    if (!question) return { error: 'That question is gone (the client may have deleted their data).' };
    if (question.status !== 'pending') return { error: 'Someone answered this already.' };
    const [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(String(question.wa_id))}`);
    if (!contact) return { error: 'That client is gone (they deleted their data).' };
    const [won] = await sb(env, 'PATCH', `questions?id=eq.${Number(id)}&status=eq.pending`,
      { status: 'answered', answer: clip(answer, 2000), answered_by: clip(`admin:${by}`, 120), answered_at: new Date(now).toISOString() });
    if (!won) return { error: 'Someone answered this a moment ago.' };
    const sent = await relay(env, now, contact, answer);
    if (!sent.ok) {
      await sb(env, 'PATCH', `questions?id=eq.${Number(id)}`, { status: 'pending', answer: null, answered_by: null, answered_at: null }, 'return=minimal');
      await flushOut(env, clock.now());
      return { error: sent.note };
    }
    if (question.kind === 'question') {                                    // reusable once someone switches it on: generalised like the team's
      const qa = await generalise(env, String(question.question_en), answer).catch(() => null);
      if (qa && !MONEY.test(qa.answer_en)) {
        await sb(env, 'POST', 'knowledge', { question_en: clip(qa.question_en, 200), answer_en: clip(qa.answer_en, 700), status: 'pending', source: 'team',
          question_id: Number(id), decided_by: clip(`admin:${by}`, 120) }, 'return=minimal').catch((e) => console.error('[admin] draft not saved', String(e)));
      }
    }
    await flushOut(env, clock.now());
    return { ok: true, note: sent.note };
  }

  /** How the bot is doing right now: stuck messages, open questions, answers waiting, AI used today. */
  async health(): Promise<Health> {
    const env = this.env, now = clock.now(), iso = (ms: number) => new Date(ms).toISOString();
    const stuck = `messages?dir=eq.in&handled_at=is.null&at=lt.${q(iso(now - 5 * 60_000))}`;
    const [unhandled, openQuestions, pendingAnswers, pastReview, withPerson] = await Promise.all([
      sbCount(env, stuck), sbCount(env, 'questions?status=eq.pending&kind=neq.auto'), sbCount(env, 'knowledge?status=eq.pending'),
      sbCount(env, `knowledge?status=eq.approved&review_at=lt.${q(iso(now))}`), sbCount(env, 'contacts?mode=eq.human'),
    ]);
    const [[oldest], [last]] = await Promise.all([
      sb<{ at: string }>(env, 'GET', `${stuck}&order=at.asc&limit=1&select=at`), sb<{ at: string }>(env, 'GET', 'messages?dir=eq.in&team=is.null&order=at.desc&limit=1&select=at'),
    ]);
    const ai = await env.DB.prepare('SELECT n FROM bot_limits WHERE key = ?').bind(`ai:${iso(now).slice(0, 10)}`).first<{ n: number }>().catch(() => null);
    return { unhandled, oldestUnhandled: oldest?.at ?? null, lastIn: last?.at ?? null, openQuestions, pendingAnswers, pastReview, withPerson,
      aiToday: ai?.n ?? 0, aiCap: Number(env.AI_DAILY_CAP || 1500) };
  }

  /** Take a lead's chat over (the bot stays quiet; messages go to the team) or hand it back. */
  async setMode(leadId: string, mode: 'human' | 'bot'): Promise<{ ok: true } | { error: string }> {
    const c = await this.contactOf(leadId);
    if (!c) return { error: 'No WhatsApp conversation for this lead.' };
    if (c.mode === 'stopped' || c.mode === 'blocked') return { error: `This client is ${c.mode === 'stopped' ? 'opted out' : 'blocked'}: nothing changed.` };
    await sb(this.env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}`, { mode, taken_by: null }, 'return=minimal');
    return { ok: true };
  }

  /** The client's language, as if they chose it (kept, whatever they type). */
  async setLang(leadId: string, lang: string): Promise<{ ok: true } | { error: string }> {
    if (!LANGS.some((l) => l.key === lang)) return { error: 'Pick a language from the list.' };
    const c = await this.contactOf(leadId);
    if (!c) return { error: 'No WhatsApp conversation for this lead.' };
    // under the client's own lock, like a turn: their answers in between are never written over
    const now = clock.now(), until = new Date(now + 45_000).toISOString();
    const [mine] = await sb<Contact>(this.env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&or=(busy_until.is.null,busy_until.lt.${new Date(now).toISOString()})`, { busy_until: until });
    if (!mine) return { error: 'The bot is answering them right now: try again in a few seconds.' };
    await sb(this.env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&busy_until=eq.${q(until)}`, { lang: lang as Lang, fields: { ...mine.fields, lang_auto: false }, busy_until: null }, 'return=minimal');
    return { ok: true };
  }

  private async contactOf(leadId: string): Promise<Contact | undefined> {
    let [c] = await sb<Contact>(this.env, 'GET', `contacts?lead_id=eq.${q(leadId)}`);
    if (!c) [c] = await sb<Contact>(this.env, 'GET', `contacts?fields->prev_leads=cs.${q(JSON.stringify([leadId]))}`);
    return c;
  }

  /** What the bot knows (newest first), optionally one status. */
  async answers(status?: Answer['status']): Promise<Answer[]> {
    // all = the ones that count now; replaced and archived ones on their own filters
    const only = status && ['pending', 'approved', 'rejected', 'superseded', 'archived'].includes(status) ? `&status=eq.${status}` : '&status=in.(pending,approved,rejected)';
    return sb<Answer>(this.env, 'GET', `knowledge?select=${ANSWER_COLS}&order=created_at.desc&limit=300${only}`);
  }

  /** An answer's versions, newest first (each edit of an approved answer is one). */
  async history(id: number): Promise<Answer[]> {
    const out: Answer[] = [];
    for (let next: number | null = Number(id); next && out.length < 10;) {
      const [k]: Answer[] = await sb<Answer>(this.env, 'GET', `knowledge?id=eq.${next}&select=${ANSWER_COLS}`);
      if (!k) break;
      out.push(k);
      next = k.supersedes;
    }
    return out;
  }

  /** Archived: kept for the record, never used, not offered again. */
  async archive(id: number, by: string): Promise<{ ok: true } | { error: string }> {
    const [k] = await sb(this.env, 'PATCH', `knowledge?id=eq.${Number(id)}&status=neq.archived`, { status: 'archived', decided_by: clip(by, 120), decided_at: new Date(clock.now()).toISOString() });
    return k ? { ok: true } : { error: 'That answer is gone or already archived.' };
  }

  /** A new or corrected answer, approved at once (the admin wrote it). A changed answer drops its
   *  approved translations: the bot then translates it for each client as it goes. */
  async saveAnswer(v: { id?: number; question_en: string; answer_en: string; by: string; review_at?: string | null }): Promise<{ ok: true; id: number } | { error: string }> {
    const question = clip(v.question_en.trim(), 200), answer = clip(v.answer_en.trim(), 700);
    if (question.length < 5 || answer.length < 2) return { error: 'Write the question and the answer.' };
    if (MONEY.test(answer)) return { error: NO_MONEY };
    // the end of that day in India; a date already past means "checked now" (cleared)
    const end = /^\d{4}-\d{2}-\d{2}$/.test(v.review_at ?? '') ? Date.parse(`${v.review_at}T23:59:59+05:30`) : NaN;
    const review = Number.isFinite(end) && end > clock.now() ? new Date(end).toISOString() : null;
    const [old] = v.id ? await sb<Row>(this.env, 'GET', `knowledge?id=eq.${Number(v.id)}`) : [];
    if (v.id && !old) return { error: 'That answer is gone.' };
    if (old && (old.status === 'superseded' || old.status === 'archived')) return { error: 'That is an old version: edit the current one instead.' };
    // the same question keeps its embedding (no AI call); a new one is embedded (never blocked by the daily cap)
    const e = old?.question_en === question && typeof old.embedding === 'string' ? JSON.parse(old.embedding) as number[] : await embed(this.env, question, true);
    if (!e) return { error: 'The AI is busy (embedding); try again in a minute.' };
    const at = new Date(clock.now()).toISOString(), same = old?.answer_en === answer;
    if (old && old.status === 'approved' && (old.question_en !== question || !same)) {   // an answer in use: a new version, the old one kept
      const k = await newVersion(this.env, old as never, { question_en: question, answer_en: answer, embedding: vec(e), by: v.by, at, review_at: review, keep: same });
      if (k) await supersedeNear(this.env, k.id, e, v.by, clock.now()).catch(() => []);
      return k ? { ok: true, id: k.id } : { error: 'That answer could not be saved; try again.' };
    }
    const row = { question_en: question, answer_en: answer, embedding: vec(e), status: 'approved', decided_by: clip(v.by, 120), decided_at: at, review_at: review,
      ...(same ? {} : { translations: {}, translations_ok: false }) };
    if (v.id) {
      const [k] = await sb<{ id: number }>(this.env, 'PATCH', `knowledge?id=eq.${Number(v.id)}`, row);
      if (k) await supersedeNear(this.env, k.id, e, v.by, clock.now()).catch(() => []);
      return k ? { ok: true, id: k.id } : { error: 'That answer is gone.' };
    }
    const [k] = await sb<{ id: number }>(this.env, 'POST', 'knowledge', { ...row, source: 'team' });
    await supersedeNear(this.env, k.id, e, v.by, clock.now()).catch(() => []);
    return { ok: true, id: k.id };
  }

  /** Switch an answer off (rejected: never used) or on again (approved; embedded if it never was). */
  async setAnswer(id: number, on: boolean, by: string): Promise<{ ok: true } | { error: string }> {
    const [k] = await sb<{ id: number; question_en: string; answer_en: string; embedding: string | null }>(this.env, 'GET', `knowledge?id=eq.${Number(id)}&select=id,question_en,answer_en,embedding`);
    if (!k) return { error: 'That answer is gone.' };
    if (on && MONEY.test(k.answer_en)) return { error: NO_MONEY };
    let embedding: string | undefined, e: number[] | null = k.embedding ? JSON.parse(k.embedding) as number[] : null;
    if (on && !e) {
      e = await embed(this.env, k.question_en, true);
      if (!e) return { error: 'The AI is busy (embedding); try again in a minute.' };
      embedding = vec(e);
    }
    await sb(this.env, 'PATCH', `knowledge?id=eq.${k.id}`, { status: on ? 'approved' : 'rejected', ...(embedding ? { embedding } : {}), decided_by: clip(by, 120), decided_at: new Date(clock.now()).toISOString() }, 'return=minimal');
    if (on && e) await supersedeNear(this.env, k.id, e, by, clock.now()).catch(() => []);   // switched back on: the one in use now steps aside
    return { ok: true };
  }

  /** The last `days` of questions: how many, who answered, the most asked (from the latest
   *  1,000, Supabase's page), and the answers' state. Counts are exact, however many there are. */
  async insights(days = 30): Promise<Insights> {
    const env = this.env, since = new Date(clock.now() - Math.min(Math.max(days, 1), 365) * 86_400_000).toISOString(), window = `questions?created_at=gt.${q(since)}`;
    const [questions, byBot, open, approved, pending, rejected] = await Promise.all([
      sbCount(env, window), sbCount(env, `${window}&kind=eq.auto`), sbCount(env, `${window}&status=eq.pending`),
      sbCount(env, 'knowledge?status=eq.approved'), sbCount(env, 'knowledge?status=eq.pending'), sbCount(env, 'knowledge?status=eq.rejected'),
    ]);
    const qs = await sb<{ kind: string; status: string; question_en: string }>(env, 'GET', `${window}&select=kind,status,question_en&order=created_at.desc&limit=1000`);
    const tally = new Map<string, { question: string; count: number; byBot: number }>();
    for (const x of qs) {
      const t = tally.get(KEY(x.question_en)) ?? { question: x.question_en.trim(), count: 0, byBot: 0 };
      t.count++; if (x.kind === 'auto') t.byBot++;
      tally.set(KEY(x.question_en), t);
    }
    return {
      days, questions, byBot, byTeam: questions - byBot, open,
      top: [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      answers: { approved, pending, rejected },
    };
  }
}
