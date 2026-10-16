/** Legit Forge WhatsApp bot (separate Worker `legitforge-bot`, bot/wrangler.jsonc).
 *
 *  Client: menu → language → name → business → need → timeline (fixed text per language, so
 *  it works with no AI). Any message can also be a question: answered from approved knowledge
 *  (Supabase + Gemini embeddings), or asked to the team on their own WhatsApp. A team answer is
 *  relayed (translated) and, once a team member taps Approve, saved for next time.
 *  Every enquiry is a row in the website's D1 `leads`, so Admin → Leads shows it.
 *
 *  Durability: inbound messages are stored in Supabase before Meta gets its 200 (Supabase down →
 *  500, Meta retries). A per-contact lock (busy_until) runs one turn at a time. A turn keeps
 *  within the free plan's 50 subrequests and 30 s (io.ts room()): what it can't finish stays
 *  unhandled and the 2-minute cron picks it up. A message that fails part-way is rolled back in
 *  memory and retried; finished ones are marked handled before the state is saved. */

import { isOpenNow } from '../lib/business-hours';
import {
  ANSWER_SCHEMA, EXTRACT_SCHEMA, FACTS, FIELDS, LANG_PROMPT, LANGS, QA_SCHEMA, SERVICES, TEXT, TEXT_SCHEMA, TIMELINES,
  TRANSLATED, TRANSLATIONS_SCHEMA, answerPrompt, extractPrompt, generalisePrompt, langFromText, langName, prefilledService,
  scriptLang, serviceByKey, serviceFromText, t, tonePrompt, translatePrompt, translationsPrompt,
  type Field, type Lang, type ServiceKey, type Step,
} from './text';
import {
  chat, clip, count, embed, markRead, q, redact, room, sb, sendButtons, sendList, sendTemplate, sendText, validSignature, vec,
  type Env, type Provider,
} from './io';

export type { Env };
/** Tests move time. */
export const clock = { now: () => Date.now() };
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const LOCK = 45_000;            // longer than a turn can run (room() stops new work after 18 s)
const AI_PER_DAY = 40;          // AI calls per client per day; past it, the fixed path still works
const MATCH = 0.8;              // knowledge similarity needed to use an approved answer
const SURE = 0.9;               // ...and to send it without a team member checking it first
/** A generated answer that names money is never sent: prices are the team's to give. */
const MONEY = new RegExp([
  '₹', '\\brs\\.?\\s*\\p{Nd}', '\\binr\\b', 'rupees?', 'roopa', 'rupa\\b', 'lakhs?', 'laksh', 'crores?', 'thousand', 'aayiram', '\\$\\s*\\p{Nd}',
  'discount', '\\p{Nd}+\\s*%', '\\b\\p{Nd}+(\\.\\p{Nd}+)?\\s*k\\b', '\\p{Nd}{1,3}(,\\p{Nd}{2,3})+', '\\p{Nd}{4,}', '\\/-',
  // Malayalam, Hindi, Kannada: rupees, thousand, lakh (ലക്ഷ്യം "goal", രൂപകൽപ്പന "design" are not money)
  'രൂപയ', '\\p{Nd}\\s*രൂപ', 'ആയിര', '\\p{Nd}\\s*ലക്ഷ', 'रुपय', 'रु\\.?\\s*\\p{Nd}', 'लाख', 'हज़ार', 'हजार', 'ರೂಪಾಯಿ', 'ರೂ\\.?\\s*\\p{Nd}', 'ಸಾವಿರ', '\\p{Nd}\\s*ಲಕ್ಷ',
].join('|'), 'iu');
/** "Delete my data" in the bot's languages (the Yes/No buttons guard against false matches). */
const DELETE_ASK = /^(please\s+)?(delete|erase|remove)\s+(all\s+)?(of\s+)?(my\s+)?(data|details|chat|info(rmation)?)\b|ente\s+data\s+delete|ഡാറ്റ\s*ഡിലീറ്റ്|डेटा\s*(हटा|डिलीट)|ಡೇಟಾ\s*ಅಳಿಸ/i;

interface Fields {
  name?: string; business?: string; need?: string; timeline?: string; notes?: string;
  flags?: number;            // abusive messages flagged so far (the second one blocks)
  call_at?: string;          // last "arrange a call" alert, so repeated taps alert once a day
  prev_leads?: string[];     // earlier enquiries' D1 lead ids (DELETE MY DATA removes them too)
}
export interface Contact {
  wa_id: string; phone: string | null; profile_name: string | null; code: string; lead_id: string; lead_saved: boolean;
  step: Step; mode: 'bot' | 'human' | 'stopped' | 'blocked'; taken_by: string | null; lang: Lang | null; service: ServiceKey | null;
  fields: Fields; alerted_at: string | null; busy_until: string | null; won_counted?: boolean; turns: number; turns_day: string | null; last_in_at: string;
}
export interface Msg {
  wamid: string; wa_id: string | null; team: string | null; dir: 'in' | 'out'; body: string | null; reply_id: string | null;
  ctx_id: string | null; profile: string | null; question_id: number | null; knowledge_id: number | null;
  handled_at: string | null; at: string;
}
interface Question {
  id: number; wa_id: string; question: string; question_en: string; status: string; answered_by: string | null;
  kind: 'question' | 'draft' | 'decision' | 'price' | 'auto'; draft: string | null; draft_en: string | null;
  knowledge_id?: number | null;
}
interface Knowledge {
  id: number; question_en: string; answer_en: string; status: string; similarity?: number;
  translations?: Partial<Record<Lang, string>>; translations_ok?: boolean; wins?: number;
}
/** Answers from chats that became won deals win near-ties (phase 2: learn from won deals). */
const score = (k: Knowledge) => (k.similarity ?? 0) + 0.02 * Math.min(k.wins ?? 0, 5);

const teamIds = (env: Env) => new Set((env.TEAM_WHATSAPP || '').split(',').map((s) => s.replace(/[\s+]/g, '')).filter(Boolean));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
const host = (env: Env) => (env.SITE_URL || 'https://legitforge.pages.dev').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const footer = (env: Env) => `Automated assistant · ${host(env)}/privacy`;
const ACK = /^(hi+|hello|hey|hai|ok(ay)?|k|thanks?( you)?|thank you|namaskaram|namaste|👍|🙏)[\s!.]*$/i;
/** Each invocation gets its own call budget (io.ts room()). */
const withRun = (env: Env): Env => ({ ...env, run: { calls: 0, t0: Date.now() } });

/* ================================================================================ webhook */

type Ctx = Pick<ExecutionContext, 'waitUntil'>;

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/webhook') return new Response('Not found', { status: 404 });
    if (req.method === 'GET') {
      const p = url.searchParams;
      return p.get('hub.mode') === 'subscribe' && env.WA_VERIFY_TOKEN && p.get('hub.verify_token') === env.WA_VERIFY_TOKEN
        ? new Response(p.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const raw = await req.arrayBuffer();
    if (!env.WA_APP_SECRET || !(await validSignature(env.WA_APP_SECRET, raw, req.headers.get('x-hub-signature-256')))) {
      return new Response('Bad signature', { status: 401 });
    }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad JSON', { status: 400 }); }
    const rows = inbound(body, env);
    if (!rows.length) return new Response('ok');               // delivery/read statuses: nothing to do
    const e = withRun(env);
    let fresh: Msg[];
    try {
      fresh = await sb<Msg>(e, 'POST', 'messages?on_conflict=wamid', rows, 'resolution=ignore-duplicates,return=representation');
    } catch (err) {
      console.error('[bot] could not store inbound messages; Meta will retry', String(err));
      return new Response('Retry later', { status: 500 });
    }
    if (fresh.length) ctx.waitUntil(processFresh(e, fresh).catch((err) => console.error('[bot] turn failed', String(err))));
    return new Response('ok');
  },
  async scheduled(controller: { scheduledTime: number }, env: Env, ctx: Ctx) {
    ctx.waitUntil(tick(env, controller.scheduledTime || clock.now()).catch((e) => console.error('[bot] tick failed', String(e))));
  },
};

/** Meta's payload → message rows (only for our number; statuses and reactions are ignored). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function inbound(body: any, env: Env): Msg[] {
  const team = teamIds(env);
  const rows: Msg[] = [];
  for (const entry of body?.entry ?? []) for (const change of entry?.changes ?? []) {
    const v = change?.value;
    if (change?.field !== 'messages' || v?.metadata?.phone_number_id !== env.WA_PHONE_NUMBER_ID) continue;
    const names = new Map<string, string>((v.contacts ?? []).map((c: { wa_id?: string; user_id?: string; profile?: { name?: string } }) => [c.wa_id ?? c.user_id ?? '', c.profile?.name ?? '']));
    for (const m of v.messages ?? []) {
      const from: string | undefined = m.from || m.from_user_id;
      if (!from || !m.id || m.type === 'reaction' || m.type === 'system') continue;
      const isTeam = team.has(from);
      let text: string | null = null, reply: string | null = null;
      if (m.type === 'text') text = m.text?.body ?? null;
      else if (m.type === 'interactive') {
        const r = m.interactive?.list_reply ?? m.interactive?.button_reply;
        text = r?.title ?? null; reply = r?.id ?? null;
      } else if (m.type === 'button') { text = m.button?.text ?? null; reply = m.button?.payload ?? null; }
      else reply = `[${m.type ?? 'unknown'}]`;                  // voice, image, sticker…: "please type"
      rows.push({
        wamid: m.id, wa_id: isTeam ? null : from, team: isTeam ? from : null, dir: 'in',
        body: text ? clip(text, 4000) : null, reply_id: reply, ctx_id: m.context?.id ?? null,
        profile: names.get(from) || null, question_id: null, knowledge_id: null, handled_at: null,
        at: iso(Number(m.timestamp) * 1000 || clock.now()),
      });
    }
  }
  return rows;
}

async function processFresh(env: Env, fresh: Msg[]) {
  for (const m of fresh.filter((m) => m.team)) {
    if (!room(env, 20)) return;                                // the cron picks up the rest
    await runTeam(env, m);
  }
  for (const waId of new Set(fresh.filter((m) => m.wa_id && !m.team).map((m) => m.wa_id!))) await runClient(env, waId);
}

/** A team message, handled once: claimed first (the webhook and the cron never both run it); if it
 *  fails, the member is told to send it again, unless the client already has it. Once handled it is
 *  linked to the client it was about, so DELETE MY DATA and the purge remove it too. */
async function runTeam(env: Env, m: Msg) {
  const now = clock.now(), about: About = {};
  const [mine] = await sb(env, 'PATCH', `messages?wamid=eq.${q(m.wamid)}&handled_at=is.null`, { handled_at: iso(now) });
  if (!mine) return;
  try { await handleTeam(env, m, now, about); } catch (e) {
    console.error('[bot] team message failed', String(e));
    await sendText(env, m.team!, about.sent ? `${about.sent} (Saving it for next time failed.)` : 'That did not go through. Please send it again.');
  }
  if (about.wa_id) await sb(env, 'PATCH', `messages?wamid=eq.${q(m.wamid)}`, { wa_id: about.wa_id }, 'return=minimal');
}
/** What a team message was about, and the note once the client got it (so a later error never asks for a resend). */
interface About { wa_id?: string; sent?: string }

/* ================================================================================ clients */

/** One client's unhandled messages, one turn at a time (the lock), then check again. */
export async function runClient(env: Env, waId: string) {
  // The worst message: AI calls, a question and a complete-brief alert, each copied to every team
  // member (window check, send, store); 4 more for the commit (lead, handled marks, contact, more?).
  const per = 15 + 6 * teamIds(env).size;
  for (let round = 0; round < 3; round++) {
    if (!room(env, per + 4)) return;                           // the cron picks up the rest
    const now = clock.now(), until = iso(now + LOCK);
    const claimed = await claim(env, waId, now, until);
    if (!claimed) return;                                      // another invocation is on it
    const old = structuredClone(claimed);
    const turn = new Turn(env, structuredClone(claimed), now);
    const done: Msg[] = [];
    let committed = false;
    try {
      const pending = await sb<Msg>(env, 'GET', `messages?wa_id=eq.${q(waId)}&team=is.null&dir=eq.in&handled_at=is.null&order=at.asc,wamid.asc&limit=10`);
      if (pending.length && turn.c.mode !== 'stopped' && turn.c.mode !== 'blocked') void markRead(env, pending[pending.length - 1].wamid);
      // A flood blocks the chat (the team can undo it): 10 texts, or the same longer text 4 times,
      // sent within a minute. Photos, a backlog from our own delays and repeated STOPs never count.
      const newest = Date.parse(pending.at(-1)?.at ?? '');
      const burst = pending.filter((m) => m.body && Date.parse(m.at) >= newest - MIN);
      const same = new Map<string, number>();
      for (const m of burst) if (m.body!.length > 15 && !ACK.test(m.body!)) same.set(m.body!, (same.get(m.body!) ?? 0) + 1);
      const optOut = pending.some((m) => /^(stop|unsubscribe)$/i.test((m.body ?? '').trim()));
      if (!optOut && (burst.length >= 10 || [...same.values()].some((n) => n >= 4))) await turn.block('a flood of messages', pending.at(-1)?.body ?? '');
      for (const m of pending) {
        if (done.length && !room(env, per + 4)) break;         // always at least one message per turn
        const snapshot = structuredClone(turn.c);
        try {
          await turn.handle(m); done.push(m);
          if (turn.erased) break;                              // the rest of the batch was erased with it
        } catch (e) {
          Object.assign(turn.c, snapshot);                     // retried later from the state before it
          console.error('[bot] message failed; the cron retries it', String(e));
          break;
        }
      }
      if (done.length) {
        await turn.saveLead().catch((e) => console.error('[bot] lead not saved; the next turn retries', String(e)));
        await sb(env, 'PATCH', `messages?wamid=in.${q(`(${done.map((m) => `"${m.wamid}"`).join(',')})`)}`, { handled_at: iso(now) }, 'return=minimal');
      }
      committed = true;
    } finally {
      // Save what changed (only once the handled marks are in) and release our own lock in one
      // write; a team "take" in between is kept, and a lock that expired and was re-taken is left alone.
      const patch: Record<string, unknown> = { busy_until: null };
      if (committed) for (const k of Object.keys(turn.c) as (keyof Contact)[]) {
        if (k !== 'busy_until' && JSON.stringify(turn.c[k]) !== JSON.stringify(old[k])) patch[k] = turn.c[k];
      }
      const save = () => sb(env, 'PATCH', `contacts?wa_id=eq.${q(waId)}&busy_until=eq.${q(until)}`, patch, 'return=minimal');
      await save().catch(save);                                // one retry: a lost save would undo a block or hand-over
    }
    if (!done.length || turn.erased) return;
    const more = await sb(env, 'GET', `messages?wa_id=eq.${q(waId)}&team=is.null&dir=eq.in&handled_at=is.null&select=wamid&limit=1`);
    if (!more.length) return;
  }
}

async function claim(env: Env, waId: string, now: number, until: string): Promise<Contact | null> {
  const [mine] = await sb<Contact>(env, 'PATCH', `contacts?wa_id=eq.${q(waId)}&or=(busy_until.is.null,busy_until.lt.${iso(now)})`, { busy_until: until });
  if (mine) return mine;
  if ((await sb(env, 'GET', `contacts?wa_id=eq.${q(waId)}&select=wa_id`)).length) return null;   // busy
  const [first] = await sb<Msg>(env, 'GET', `messages?wa_id=eq.${q(waId)}&team=is.null&dir=eq.in&order=at.asc&limit=1`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row: Contact = {
      wa_id: waId, phone: /^\d{8,15}$/.test(waId) ? waId : null, profile_name: first?.profile ?? null, code: newCode(),
      lead_id: crypto.randomUUID(), lead_saved: false, step: 'start', mode: 'bot', taken_by: null, lang: null, service: null,
      fields: {}, alerted_at: null, busy_until: until, turns: 0, turns_day: null, last_in_at: iso(now),
    };
    try {
      const [made] = await sb<Contact>(env, 'POST', 'contacts?on_conflict=wa_id', row, 'resolution=ignore-duplicates,return=representation');
      return made ?? null;                                     // empty: created by a parallel turn, which holds it
    } catch (e) { if ((e as { status?: number }).status !== 409) throw e; }   // code collision: new code
  }
  return null;
}

const who = (c: Contact) => `${c.fields.name || c.profile_name || 'New client'}${c.fields.business ? ` (${clip(c.fields.business, 60)})` : ''}`;
const serviceLabel = (c: Contact) => serviceByKey(c.service ?? '')?.lead ?? 'Not chosen yet';
const join = (a: string | undefined, b: string, n = 1500) => clip(a ? `${a}\n${b}` : b, n);
const nextStep = (c: Contact): Step => FIELDS.find((f) => !c.fields[f]) ?? 'done';
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Groq (which keeps no prompts) goes first, except for Malayalam and Kannada: Groq's models
 *  don't support them, so Gemini reads them first and is the only one that writes them (if it is
 *  busy, the client gets fixed text and the team is asked instead). */
const indic = (lang: string | null) => lang === 'ml' || lang === 'kn' || lang === 'mg';
const reader = (lang: string | null, text: string): Provider[] =>
  indic(lang) || scriptLang(text) === 'ml' || scriptLang(text) === 'kn' ? ['gemini', 'groq'] : ['groq', 'gemini'];
const writer = (lang: string | null): Provider[] => (indic(lang) ? ['gemini'] : ['groq', 'gemini']);

interface Extract {
  kind: 'answer' | 'question' | 'person' | 'off_topic'; name: string; business: string; need_en: string; timeline: string;
  question_en: string; commitment: boolean; price: boolean; mood: 'calm' | 'upset' | 'urgent'; abusive: boolean;
}
type Alert = 'complete' | 'person' | 'call' | 'upset' | 'urgent';
const ALERT_HEAD: Record<Alert, string> = {
  complete: 'new lead (brief complete)', person: 'new lead (asked for a person)', call: '📞 wants a call to discuss a quote',
  upset: '⚠ upset client: please take over now', urgent: '⚠ urgent: please take over now',
};

/** Training mode: for the first TRAINING_DAYS (default 14) after the first client, every
 *  AI-written answer goes to the team as a draft first. After that only uncertain ones do. */
async function training(env: Env, now: number) {
  const days = Number(env.TRAINING_DAYS ?? 14);
  if (!(days > 0)) return false;
  // The start is stored once (settings 'first_client_at'), so deleted or purged contacts never move it.
  let [row] = await sb<{ value: string }>(env, 'GET', 'settings?key=eq.first_client_at&select=value');
  if (!row) {
    const [first] = await sb<{ created_at: string }>(env, 'GET', 'contacts?select=created_at&order=created_at.asc&limit=1');
    row = { value: first?.created_at ?? iso(now) };
    await sb(env, 'POST', 'settings?on_conflict=key', { key: 'first_client_at', value: row.value, updated_at: iso(now) }, 'resolution=ignore-duplicates,return=minimal');
  }
  return now < Date.parse(row.value) + days * DAY;
}
const brief = (c: Contact) => `Brief so far: ${serviceLabel(c)} · need: ${clip(c.fields.need || '-', 140)} · timeline: ${c.fields.timeline || '-'}`;

class Turn {
  constructor(readonly env: Env, readonly c: Contact, readonly now: number) {}
  private say(text: string) { return sendText(this.env, this.c.wa_id, text); }

  erased = false;
  private wamid = '';                                                      // the message being handled (questions key on it)

  async handle(m: Msg) {
    const c = this.c, text = (m.body ?? '').trim(), lang = c.lang ?? 'en';
    const [kind, value] = (m.reply_id ?? '').split(':');
    this.wamid = m.wamid;
    // Privacy first: works even for stopped or blocked chats.
    if (DELETE_ASK.test(text)) {
      c.last_in_at = m.at;
      await sendButtons(this.env, c.wa_id, t(lang, 'deleteAsk'), TEXT[lang].delBtn.map((title, i) => ({ id: `del:${i ? 'n' : 'y'}`, title })));
      return;
    }
    if (kind === 'del') {
      c.last_in_at = m.at;
      if (value === 'y') await this.erase(); else await this.say(t(lang, 'kept'));
      return;
    }
    if (c.mode === 'blocked') return;                                       // the team unblocks with "#CODE unblock"
    if (/^(stop|unsubscribe)$/i.test(text)) { c.last_in_at = m.at; c.mode = 'stopped'; await this.say(t(c.lang, 'stopped')); return; }
    if (Date.parse(c.last_in_at) < this.now - 30 * DAY && this.welcomeBack()) {
      c.last_in_at = m.at;
      await sendButtons(this.env, c.wa_id, t(lang, 'welcomeBack'), TEXT[lang].retBtn.map((title, i) => ({ id: `ret:${i ? 'new' : 'same'}`, title })));
      return;
    }
    c.last_in_at = m.at;
    if (c.mode === 'stopped') c.mode = 'bot';                               // any later message restarts the chat
    if (c.mode === 'human') {
      // With a person on the chat the bot stays quiet and forwards: to whoever took it, or to
      // the whole team while nobody has (an upset or urgent client waiting for anyone).
      const team = teamIds(this.env);
      if (c.taken_by && !team.has(c.taken_by)) c.taken_by = null;           // that person left the team
      const to = c.taken_by ? [c.taken_by] : [...team];
      if (to.length && (await toTeam(this.env, this.now, `#${c.code} ${who(c)}: ${text || m.reply_id}`, { wa_id: c.wa_id }, to))) return;
      c.mode = 'bot'; c.taken_by = null;                                    // nobody could be reached: the bot carries on
    }
    if (!text) { await this.say(t(c.lang, 'pleaseType')); return; }

    // Taps work at any step (an old menu tapped later just updates the answer).
    if ((kind === 'ret' || kind === 'call') && c.step === 'start') { c.step = 'service'; await this.ask(text); return; }   // an old button on a fresh chat
    if (kind === 'ret') {
      if (c.step !== 'returning') { await this.ask(); return; }            // an old welcome-back button: ignore it
      if (value === 'new') { this.restart(); c.step = 'service'; await this.ask(text); return; }
      c.step = c.lang ? nextStep(c) : 'language';
      if (c.step === 'done') await this.say(t(c.lang, 'sameProject')); else await this.ask();
      return;
    }
    if (kind === 'call') {
      if (value !== 'y') { await this.ask('', t(c.lang, 'keepGoing')); return; }
      if (!c.fields.call_at || Date.parse(c.fields.call_at) < this.now - DAY) {   // repeated taps alert once a day
        c.fields.call_at = iso(this.now);
        await this.alertTeam('call');
      }
      await this.say(t(c.lang, 'callSoon'));
      return;
    }
    if (kind === 'svc' && serviceByKey(value)) {
      c.service = value as ServiceKey;
      if (c.step === 'start' || c.step === 'service') c.step = 'language';
      await this.ask();
      return;
    }
    if (kind === 'lang' && LANGS.some((l) => l.key === value)) {
      c.lang = value as Lang;
      if (c.step === 'start' || c.step === 'service' || c.step === 'language') c.step = nextStep(c);
      await this.ask();
      return;
    }
    if (kind === 'tl' && TIMELINES[Number(value)] && !c.fields.timeline) { c.fields.timeline = TIMELINES[Number(value)]; await this.advance(''); return; }

    switch (c.step) {
      case 'start': {
        const pre = prefilledService(text);
        if (pre) { c.service = pre; c.step = 'language'; } else {
          if (!ACK.test(text) && !/^hi legit forge/i.test(text)) c.fields.notes = join(c.fields.notes, text);
          c.step = 'service';
        }
        await this.ask(text);
        return;
      }
      case 'service':
        if (ACK.test(text)) { await this.ask(text); return; }             // a second "hello": the menu again
        c.service = serviceFromText(text);
        if (c.service === 'other' || words(text) > 3) c.fields.notes = join(c.fields.notes, text);
        c.step = 'language';
        await this.ask();
        return;
      case 'language':
        c.lang = langFromText(text);
        if (words(text) > 3) c.fields.notes = join(c.fields.notes, text);
        c.step = nextStep(c);
        await this.ask();
        return;
      case 'returning':                                                     // typed instead of tapped: the same project
        c.step = c.lang ? nextStep(c) : 'language';
        if (c.step === 'language') await this.ask(); else await this.field(text);
        return;
      default:
        await this.field(text);
    }
  }

  /** Back after 30+ days: a client with an earlier brief is asked "same project or new?";
   *  anyone else just starts again. True when the question was asked. */
  private welcomeBack() {
    const c = this.c;
    if (c.mode === 'stopped' || !(c.service || FIELDS.some((f) => c.fields[f]))) { this.restart(); return false; }
    c.mode = 'bot'; c.taken_by = null;                                      // a month later, nobody is still on the chat
    c.step = 'returning';
    return true;
  }

  /** "DELETE MY DATA": every WhatsApp lead of theirs in D1, their questions, the contact and
   *  every message about them (team copies included), in that order, so a failure part-way
   *  leaves the tap unhandled and the cron repeats the erase. Learned answers are generalised
   *  before approval and hold no personal details. A blocked chat keeps a bare record (number,
   *  code, block, today's AI count) so deleting can't be used to get unblocked. */
  private async erase() {
    const c = this.c, ids = [c.lead_id, ...(c.fields.prev_leads ?? [])];
    count(this.env);
    await this.env.DB.prepare(`DELETE FROM leads WHERE source = 'whatsapp' AND (id IN (${ids.map(() => '?').join(',')}) OR (phone IS NOT NULL AND phone = ?))`)
      .bind(...ids, c.phone ? `+${c.phone}` : null).run();
    const theirs = await sb<Question>(this.env, 'GET', `questions?wa_id=eq.${q(c.wa_id)}&select=id`);
    if (theirs.length) await sb(this.env, 'DELETE', `knowledge?status=eq.pending&question_id=in.(${theirs.map((x) => x.id).join(',')})`, undefined, 'return=minimal');
    await sb(this.env, 'DELETE', `questions?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    if (c.mode === 'blocked') {
      Object.assign(c, { profile_name: null, lead_id: crypto.randomUUID(), lead_saved: true, step: 'start', taken_by: null, lang: null, service: null, fields: {}, alerted_at: null });
    } else {
      await sb(this.env, 'DELETE', `contacts?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    }
    await sb(this.env, 'DELETE', `messages?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    this.erased = true;
    c.lead_saved = true;                                                    // nothing re-creates the lead this turn
    await toTeam(this.env, this.now, `#${c.code} asked to delete their data. Their chat, details and WhatsApp leads are erased; please also delete #${c.code}'s messages in your own WhatsApp.`, {});
    await this.say(t(c.lang, 'deleted'));
  }

  /** Abuse or a flood: stop replying, tell the team once. */
  async block(reason: string, last: string) {
    const c = this.c;
    if (c.mode === 'blocked') return;
    c.mode = 'blocked';
    await toTeam(this.env, this.now, `#${c.code} blocked: ${reason}. I no longer reply to them. "#${c.code} unblock" to undo.\nLast message: "${clip(last, 200)}"`, { wa_id: c.wa_id });
  }

  /** Upset or urgent: the bot stops asking and the whole team is alerted to take over (with the
   *  client's words). Only when the alert reached someone; otherwise the bot carries on. */
  private async handOver(mood: 'upset' | 'urgent', text: string) {
    const c = this.c;
    if (!(await this.alertTeam(mood, text))) return false;
    c.mode = 'human'; c.taken_by = null;
    await this.say(t(c.lang, 'person'));
    return true;
  }

  private restart() {
    const prev = [...(this.c.fields.prev_leads ?? []), ...(this.c.lead_saved ? [this.c.lead_id] : [])].slice(-10);
    // ponytail: wins follow the current enquiry only; an earlier one marked Won later is not credited
    Object.assign(this.c, {
      lead_id: crypto.randomUUID(), lead_saved: false, won_counted: false, step: 'start', mode: 'bot', taken_by: null, service: null,
      fields: prev.length ? { prev_leads: prev } : {}, alerted_at: null,
    });
  }

  /** Whatever the current step asks (with anything said first). `seen` picks the menu's language
   *  before the client has chosen one. */
  private async ask(seen = '', prefix = '') {
    const c = this.c, lang = c.lang ?? 'en', lead = prefix ? `${prefix}\n\n` : '';
    switch (c.step) {
      case 'start': case 'service': {
        const l = c.lang ?? scriptLang(seen);
        await sendList(this.env, c.wa_id, t(l, 'welcome'), t(l, 'menu'),
          SERVICES.map((s) => ({ id: `svc:${s.key}`, title: s.title, description: s.description })), footer(this.env));
        return;
      }
      case 'language':
        await sendList(this.env, c.wa_id, LANG_PROMPT, 'Language', LANGS.map((l) => ({ id: `lang:${l.key}`, title: l.title })), footer(this.env));
        return;
      case 'done': case 'returning':
        if (prefix) await this.say(prefix);
        return;
      case 'timeline':
        await sendButtons(this.env, c.wa_id, lead + TEXT[lang].timeline, TEXT[lang].tl.map((title, i) => ({ id: `tl:${i}`, title })));
        return;
      default:
        await this.say(lead + t(lang, c.step));
    }
  }

  private async advance(prefix: string) {
    const c = this.c, was = c.step;
    c.step = nextStep(c);
    if (c.step === 'done' && was !== 'done') {
      await this.say(prefix ? `${prefix}\n\n${t(c.lang, 'done')}` : t(c.lang, 'done'));
      await this.alertTeam('complete');
      return;
    }
    await this.ask('', prefix);
  }

  /** A typed answer to name / business / need / timeline, or anything after the brief is done. */
  private async field(text: string) {
    const c = this.c, step = c.step as Field | 'done', lang = c.lang ?? 'en';
    const before = JSON.stringify(FIELDS.map((f) => c.fields[f]));
    const x = await this.ai<Extract>({ system: extractPrompt(step), user: text, schema: EXTRACT_SCHEMA, name: 'extract' }, reader(c.lang, text));
    let prefix = '';
    if (x) {
      if (x.name && !c.fields.name) c.fields.name = clip(x.name, 80);
      if (x.business && !c.fields.business) c.fields.business = clip(x.business, 200);
      if (x.need_en) c.fields.need = join(c.fields.need, x.need_en, 1000);
      if (x.timeline && !c.fields.timeline) c.fields.timeline = clip(x.timeline, 120);
      if (x.abusive) {
        // One flag goes to a person (an AI can misread anger or a pasted promo); a second blocks.
        c.fields.flags = (c.fields.flags ?? 0) + 1;
        if (c.fields.flags >= 2) { await this.block('abusive messages', text); return; }
        if (await this.handOver('upset', text)) return;
      }
      if ((x.mood === 'upset' || x.mood === 'urgent') && (await this.handOver(x.mood, text))) return;
      if (x.kind === 'question' && x.price && !x.commitment) {
        // Prices are the team's: the question goes to them and the client is offered a call.
        await this.escalate(text, x.question_en || text, { kind: 'price' });
        await sendButtons(this.env, c.wa_id, t(lang, 'price'), TEXT[lang].callBtn.map((title, i) => ({ id: `call:${i ? 'n' : 'y'}`, title })));
        if (step !== 'done') { c.step = nextStep(c); if (c.step === 'done') await this.alertTeam('complete'); }
        return;
      }
      if (x.kind === 'question' && x.question_en) prefix = await this.answerOrAsk(text, x.question_en, x.commitment);
      else if (x.kind === 'person') { await this.alertTeam('person'); prefix = t(lang, 'person'); }
      else if (x.kind === 'off_topic') prefix = t(lang, 'offTopic');
    }
    const plain = (!x || x.kind === 'answer') && !ACK.test(text);
    const filled = JSON.stringify(FIELDS.map((f) => c.fields[f])) !== before;
    // With no AI (or when it found nothing), the message answers the question we asked.
    if (plain && !filled && step !== 'done' && !c.fields[step]) c.fields[step] = clip(text, step === 'need' ? 1000 : 200);
    if (step === 'done') {
      if (plain) { c.fields.notes = join(c.fields.notes, text); prefix ||= t(lang, 'noted'); }
      if (!c.alerted_at) await this.alertTeam('complete');                  // an earlier alert that didn't go out
      if (prefix) await this.say(prefix);
      return;
    }
    await this.advance(prefix);
  }

  private async answerOrAsk(original: string, questionEn: string, commitment: boolean): Promise<string> {
    const c = this.c;
    if (!commitment) {
      const v = await embed(this.env, questionEn);
      const found = v ? await sb<Knowledge>(this.env, 'POST', 'rpc/match_knowledge',
        { query_embedding: vec(v), match_threshold: MATCH, match_count: 3 }).catch(() => []) : [];
      // Wins only break near-ties (within 0.02 of the closest); a looser answer never wins on them.
      const best = Math.max(0, ...found.map((k) => k.similarity ?? 0)), matches = found;
      const top = found.filter((k) => (k.similarity ?? 0) >= best - 0.02).sort((a, b) => score(b) - score(a))[0];
      const sure = (top?.similarity ?? 0) >= SURE;
      // A close match already has the approved words: English as written, other languages from
      // the translations the team approved. No AI call, the same answer every time.
      let answer = !sure ? undefined : !c.lang || c.lang === 'en' ? top.answer_en : top.translations_ok ? top.translations?.[c.lang] : undefined;
      let answerEn: string | undefined = top?.answer_en;
      if (!answer) {
        // The client's words go in as one JSON string, so they can't pose as facts or approved answers.
        const r = await this.ai<{ answer: string; answer_en: string }>({
          system: answerPrompt(c.lang ?? 'en', await this.tone()), schema: ANSWER_SCHEMA, name: 'answer',
          user: JSON.stringify({ facts: FACTS, approved_answers: matches.map((k) => ({ q: k.question_en, a: k.answer_en })), client_question: original }),
        }, writer(c.lang));
        answer = r?.answer.trim(); answerEn = r?.answer_en.trim() || answer;
      }
      if (answer && !MONEY.test(answer) && !MONEY.test(answerEn ?? '')) {
        // Sent straight away only when an approved answer matches closely and training is over;
        // otherwise the team gets the draft: one tap sends it, and that approval teaches the bot.
        if (sure && !(await training(this.env, this.now))) {
          await sb(this.env, 'POST', 'questions?on_conflict=wamid', {
            wa_id: c.wa_id, wamid: this.wamid || null, question: original, question_en: questionEn, status: 'answered', kind: 'auto',
            answer: clip(answer, 600), answered_by: 'bot', answered_at: iso(this.now), knowledge_id: top.id,
          }, 'resolution=ignore-duplicates,return=minimal');
          return answer;                                                     // whole: the approved words are never cut
        }
        // A draft of an approved answer keeps its id: Send then teaches nothing new (no duplicate).
        await this.escalate(original, questionEn, { kind: 'draft', draft: clip(answer, 700), draft_en: clip(answerEn ?? answer, 700), knowledge_id: sure ? top.id : null });
        return t(c.lang, 'checking');
      }
    }
    await this.escalate(original, questionEn, { kind: commitment ? 'decision' : 'question' });
    return t(c.lang, 'checking');
  }

  /** A question for the team: stored, then sent with the client's words, the brief so far and,
   *  for a draft, the reply the bot would send with [Send] [Write my own]. */
  private async escalate(original: string, questionEn: string, o: { kind: Question['kind']; draft?: string; draft_en?: string; knowledge_id?: number | null }) {
    const c = this.c, other = c.lang && c.lang !== 'en';
    // Keyed on the client's message: a retry after a failure part-way reuses the same question.
    let [question] = await sb<Question>(this.env, 'POST', 'questions?on_conflict=wamid', {
      wa_id: c.wa_id, wamid: this.wamid || null, question: original, question_en: questionEn, status: 'pending', kind: o.kind,
      draft: o.draft ?? null, draft_en: o.draft_en ?? null, knowledge_id: o.knowledge_id ?? null,
    }, 'resolution=ignore-duplicates,return=representation');
    if (!question) [question] = await sb<Question>(this.env, 'GET', `questions?wamid=eq.${q(this.wamid)}`);
    await this.saveLead();
    const head = { question: 'question', draft: 'draft reply', decision: '⚠ needs your decision (discount, deadline or terms)', price: 'price question (offered a call)', auto: 'answered' }[o.kind];
    // A draft comes first, then what to do, then the context: WhatsApp cuts a button message at
    // 1024 characters (a template at 900), and only the context may be cut, never the draft.
    const asked = `Client: "${clip(original, o.draft ? 150 : 600)}"${questionEn !== original ? `\nIn English: ${clip(questionEn, o.draft ? 150 : 600)}` : ''}`;
    const top = `#${c.code} ${head} · ${who(c)} · ${langName(c.lang)}`, draft = `Draft reply${other ? ` (${langName(c.lang)})` : ''}: ${o.draft}`;
    const tap = 'Tap Send, or reply to this message with your own answer.';
    const left = 880 - top.length - draft.length - tap.length;              // the English gets what is left
    const body = (o.draft
      ? [top, `${draft}${other && o.draft_en && left > 60 ? `\nIn English: ${clip(o.draft_en, left - 15)}` : ''}`, tap, '', asked, brief(c)]
      : [`#${c.code} ${head} · ${who(c)} · ${serviceLabel(c)} · ${langName(c.lang)}`, asked, brief(c), '',
        `Reply to this message with the answer (I translate it for the client). "#${c.code} take" = chat with them yourself.`]).join('\n');
    const sent = await toTeam(this.env, this.now, body, { wa_id: c.wa_id, question_id: question.id }, undefined,
      o.draft ? [{ id: `dr:s:${question.id}`, title: 'Send' }, { id: `dr:w:${question.id}`, title: 'Write my own' }] : undefined);
    if (!sent) console.error(`[bot] question #${c.code} reached no team member (TEAM_WHATSAPP, template?)`);
  }

  private toneText: string | null | undefined;
  /** The team's style guide (Supabase settings 'tone'), read once per turn. */
  private async tone() {
    if (this.toneText === undefined) {
      const [row] = await sb<{ value: string }>(this.env, 'GET', 'settings?key=eq.tone&select=value').catch(() => []);
      this.toneText = row?.value ?? null;
    }
    return this.toneText;
  }

  /** AI with a daily cap per client; null means "use the fixed path". */
  private async ai<T>(o: { system: string; user: string; schema: typeof EXTRACT_SCHEMA | typeof ANSWER_SCHEMA; name: string }, prefer: Provider[]) {
    const c = this.c, today = iso(this.now).slice(0, 10);
    if (c.turns_day !== today) { c.turns_day = today; c.turns = 0; }
    if (c.turns >= AI_PER_DAY || !room(this.env, 14)) return null;
    c.turns++;
    return chat<T>(this.env, { ...o, prefer });
  }

  private async alertTeam(why: Alert, said = '') {
    const c = this.c;
    if (why === 'complete' && c.alerted_at) return 1;
    await this.saveLead();                                    // stored before its notification
    const f = c.fields;
    const sent = await toTeam(this.env, this.now, [
      `#${c.code} ${ALERT_HEAD[why]}`,
      `Name: ${f.name || c.profile_name || '-'}`, `Business: ${f.business || '-'}`, `Service: ${serviceLabel(c)}`,
      `Need: ${clip(f.need || '-', 500)}`, `Timeline: ${f.timeline || '-'}`, `Language: ${langName(c.lang)}`,
      ...(f.notes ? [`Notes: ${clip(f.notes, 300)}`] : []),
      ...(said ? [`Message: "${clip(said, 300)}"`] : []),
      c.phone ? `WhatsApp: wa.me/${c.phone}` : 'WhatsApp: no phone number shared (username)',
      '', why === 'upset' || why === 'urgent'
        ? `The bot has stopped. Reply to this message to talk to them; "#${c.code} bot" hands back to the bot.`
        : 'Reply to this message to write to the client.',
    ].join('\n'), { wa_id: c.wa_id });
    if (!sent) console.error(`[bot] lead #${c.code} reached no team member (TEAM_WHATSAPP, template?); retried on their next message`);
    else if (why === 'complete') c.alerted_at = iso(this.now);
    return sent;
  }

  /** The enquiry in the website's D1, where Admin → Leads reads it (same table as the form).
   *  Inserted once per enquiry; later turns only update it, so a lead deleted in the admin stays deleted. */
  async saveLead() {
    const c = this.c, f = c.fields;
    const message = [f.business && `Business: ${f.business}`, f.need && `Need: ${f.need}`, f.timeline && `Timeline: ${f.timeline}`, f.notes && `Notes: ${f.notes}`]
      .filter(Boolean).join('\n') || null;
    const values = [f.name || c.profile_name || null, c.phone ? `+${c.phone}` : null, serviceByKey(c.service ?? '')?.lead ?? null, message, c.lang ? langName(c.lang) : null];
    count(this.env);
    await (c.lead_saved
      ? this.env.DB.prepare('UPDATE leads SET name = ?, phone = ?, service = ?, message = ?, language = ? WHERE id = ?').bind(...values, c.lead_id)
      : this.env.DB.prepare(`INSERT OR IGNORE INTO leads (name, phone, service, message, language, id, source, whatsapp_consent)
          VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', 1)`).bind(...values, c.lead_id)).run();
    c.lead_saved = true;
  }
}

/* =================================================================================== team */

/** A message to team members (all by default), each checked against their 24-hour window:
 *  free-form when they wrote to the bot in the last 23 hours, else the approved template.
 *  Each copy is stored so a swipe-reply to it finds the client / question / answer it is about.
 *  Returns how many members it reached. */
async function toTeam(env: Env, now: number, text: string, link: { wa_id?: string; question_id?: number; knowledge_id?: number },
  members = [...teamIds(env)], buttons?: { id: string; title: string }[]) {
  let sent = 0;
  for (const member of members) {
    const open = (await sb(env, 'GET', `messages?team=eq.${q(member)}&dir=eq.in&at=gt.${iso(now - 23 * HOUR)}&select=wamid&limit=1`)).length > 0;
    const code = /^#([A-Z0-9]{5})/.exec(text)?.[1] ?? '-';
    // Outside the 24-hour window only the template goes out (no buttons): a text reply still works.
    const id = !open ? await sendTemplate(env, member, 'team_alert', [code, text])
      : buttons ? await sendButtons(env, member, text, buttons) : await sendText(env, member, text);
    if (id) { sent++; if (link.wa_id || link.question_id || link.knowledge_id) await storeOut(env, now, id, member, text, link); }
  }
  return sent;
}

async function storeOut(env: Env, now: number, wamid: string, member: string, body: string, link: { wa_id?: string; question_id?: number; knowledge_id?: number }) {
  await sb(env, 'POST', 'messages', {
    wamid, wa_id: link.wa_id ?? null, team: member, dir: 'out', body: clip(body, 4000), reply_id: null, ctx_id: null, profile: null,
    question_id: link.question_id ?? null, knowledge_id: link.knowledge_id ?? null, handled_at: iso(now), at: iso(now),
  }, 'return=minimal');
}

const HELP = 'Reply (swipe right) to a question or lead message to answer it, or start with #CODE then your message.\n"#CODE take" = chat with the client yourself, "#CODE bot" = hand back to the bot, "#CODE unblock" = undo a block.';

async function handleTeam(env: Env, m: Msg, now: number, about: About = {}) {
  const member = m.team!, text = (m.body ?? '').trim();
  const reply = async (body: string, link: { wa_id?: string; knowledge_id?: number; question_id?: number } = {}) => {
    const id = await sendText(env, member, body);
    if (id && (link.wa_id || link.knowledge_id || link.question_id)) await storeOut(env, now, id, member, body, link);
  };

  const kb = /^kb:([aer]):(\d+)$/.exec(m.reply_id ?? '');
  if (kb) return review(env, now, member, kb[1] as 'a' | 'e' | 'r', Number(kb[2]), reply);
  const tr = /^tr:([as]):(\d+)$/.exec(m.reply_id ?? '');
  if (tr) {
    if (tr[1] === 's') return reply('Skipped: the bot translates this answer itself when it is needed.');
    const [ok] = await sb(env, 'PATCH', `knowledge?id=eq.${tr[2]}`, { translations_ok: true });
    return reply(ok ? 'Translations saved ✅ The bot uses them word for word.' : HELP);
  }
  const dr = /^dr:([sw]):(\d+)$/.exec(m.reply_id ?? '');
  if (dr) {
    const [question] = await sb<Question>(env, 'GET', `questions?id=eq.${dr[2]}`);
    if (!question) return reply('That question is gone (the client may have deleted their data).');
    about.wa_id = question.wa_id;
    if (dr[1] === 's') return sendDraft(env, now, member, question, reply, about);
    return reply('Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  }

  let contact: Contact | undefined, questionId: number | null = null, rest = text, o: Msg | undefined;
  const code = /^#([A-Z0-9]{5})\b\s*/i.exec(text);
  if (code) {
    rest = text.slice(code[0].length).trim();
    [contact] = await sb<Contact>(env, 'GET', `contacts?code=eq.${q(code[1].toUpperCase())}`);
  } else if (m.ctx_id) {
    [o] = await sb<Msg>(env, 'GET', `messages?wamid=eq.${q(m.ctx_id)}`);
    // A save-for-next-time card (a template carries no buttons): "approve" / "reject" do what the
    // buttons do; other words on a client's card go to that client, and on the Edit prompt or a
    // weekly card (no client) they are the better answer.
    if (o?.knowledge_id) {
      if (/^approve[\s.!]*$/i.test(text)) return review(env, now, member, 'a', o.knowledge_id, reply);
      if (/^reject[\s.!]*$/i.test(text)) return review(env, now, member, 'r', o.knowledge_id, reply);
      if (!o.wa_id) return saveEdit(env, now, member, o.knowledge_id, text, reply);
    }
    questionId = o?.question_id ?? null;
    if (o?.wa_id) [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(o.wa_id)}`);
  }
  if (contact) about.wa_id = contact.wa_id;
  if (!contact || !rest) return reply(HELP);

  if (/^unblock$/i.test(rest)) {
    const [done] = await sb<Contact>(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}&mode=eq.blocked`, { mode: 'bot' });
    return reply(done ? `#${contact.code} is unblocked; the bot answers them again.` : `#${contact.code} was not blocked (now: ${contact.mode}), so nothing changed.`);
  }
  if (/^delete$/i.test(rest)) {
    // A client asked the team to delete their data: they confirm it themselves with the buttons.
    if (Date.parse(contact.last_in_at) < now - 24 * HOUR) return reply(`#${contact.code}'s 24-hour window has closed; ask them to send "delete my data".`);
    const lang = contact.lang ?? 'en';
    await sendButtons(env, contact.wa_id, t(lang, 'deleteAsk'), TEXT[lang].delBtn.map((title, i) => ({ id: `del:${i ? 'n' : 'y'}`, title })));
    return reply(`Sent #${contact.code} the delete question; they confirm it themselves.`);
  }
  if (/^(take|bot)$/i.test(rest)) {
    if (contact.mode === 'stopped') return reply(`#${contact.code} opted out (STOP), so nothing changed and nothing will be sent.`);
    const take = /^take$/i.test(rest);
    await sb(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}`, take ? { mode: 'human', taken_by: member } : { mode: 'bot', taken_by: null }, 'return=minimal');
    return reply(take
      ? `You have #${contact.code}. Their messages come to you here; reply to them to answer.\n"#${contact.code} bot" hands back to the bot.`
      : `The bot is back on #${contact.code}.`);
  }

  // A reply to a question's alert answers that question; "#CODE text" answers their oldest open
  // one; a reply to anything else (a lead alert, a forwarded message) just goes to the client.
  const [pending] = questionId ? await sb<Question>(env, 'GET', `questions?id=eq.${questionId}`)
    : code ? await sb<Question>(env, 'GET', `questions?wa_id=eq.${q(contact.wa_id)}&status=eq.pending&order=created_at.asc&limit=1`) : [];
  if (pending && pending.status !== 'pending') return reply(`Already answered by ${pending.answered_by === member ? 'you' : `+${pending.answered_by}`}.`);
  // "send" in reply to a draft's alert (e.g. the template, which carries no buttons) sends the draft.
  // Not "yes"/"ok" (those may be the answer itself), and never in reply to the "Write my own" prompt.
  if (pending?.kind === 'draft' && pending.draft && /^(send|👍)[\s.!]*$/i.test(rest) && (!o || (o.body ?? '').startsWith('#'))) {
    return sendDraft(env, now, member, pending, reply, about);
  }
  if (pending) {
    const [won] = await sb<Question>(env, 'PATCH', `questions?id=eq.${pending.id}&status=eq.pending`,
      { status: 'answered', answer: clip(rest, 2000), answered_by: member, answered_at: iso(now) });
    if (!won) return reply('Someone answered this a moment ago.');
  }
  const sent = await relay(env, now, contact, rest);
  if (!sent.ok) {
    // Nothing reached the client: the question stays open (the 10-minute message, a later answer).
    if (pending) await sb(env, 'PATCH', `questions?id=eq.${pending.id}`, { status: 'pending', answer: null, answered_by: null, answered_at: null }, 'return=minimal');
    return reply(sent.note, { wa_id: contact.wa_id });
  }
  about.sent = sent.note;
  if (pending) return suggest(env, now, member, contact, pending.question_en, rest, sent.note, pending.id, reply);
  // A reply the team wrote on its own (not to a bot question) can teach the bot too, when it
  // answers what the client last asked; the AI returns nothing for small talk and scheduling.
  if (rest.split(/\s+/).length < 4) return reply(sent.note, { wa_id: contact.wa_id });
  const [asked] = await sb<Msg>(env, 'GET', `messages?wa_id=eq.${q(contact.wa_id)}&team=is.null&dir=eq.in&body=not.is.null&order=at.desc&limit=1&select=body`);
  if (!asked?.body) return reply(sent.note, { wa_id: contact.wa_id });
  return suggest(env, now, member, contact, asked.body, rest, sent.note, null, reply);
}

/** Learning: a general Q&A from a client question and the team's answer, reused only once this
 *  member taps Approve. Short enough that the card shows all of it (WhatsApp cuts a button
 *  message at 1024 characters). */
async function suggest(env: Env, now: number, member: string, contact: Contact, question: string, answer: string, note: string,
  questionId: number | null, reply: Reply) {
  const qa = await chat<{ question_en: string; answer_en: string }>(env, {
    system: generalisePrompt, schema: QA_SCHEMA, name: 'faq', prefer: ['groq', 'gemini'],
    user: JSON.stringify({ client_message: question, team_reply: answer }),
  });
  if (!qa?.question_en.trim() || !qa.answer_en.trim()) return reply(note, { wa_id: contact.wa_id });
  const [k] = await sb<Knowledge>(env, 'POST', 'knowledge', {
    question_en: clip(qa.question_en, 200), answer_en: clip(qa.answer_en, 700), source: 'team', status: 'pending', question_id: questionId,
  });
  await card(env, now, k, note, contact.wa_id, [member]);
}

/** "Save this for next time?" with Approve / Edit / Reject. Outside a member's 24-hour window it
 *  arrives as the template (no buttons): replying "approve", "reject" or a better answer works too. */
async function card(env: Env, now: number, k: Knowledge, note: string, waId?: string, members?: string[]) {
  const body = `${note ? `${note}\n\n` : ''}Save this for next time?\nQ: ${k.question_en}\nA: ${k.answer_en}\n\nTap a button, or reply "approve" or "reject"${waId ? '' : ' or a better answer'}.`;
  return toTeam(env, now, body, { wa_id: waId, knowledge_id: k.id }, members,
    [{ id: `kb:a:${k.id}`, title: 'Approve' }, { id: `kb:e:${k.id}`, title: 'Edit' }, { id: `kb:r:${k.id}`, title: 'Reject' }]);
}

/** After an answer is approved: one translation into every other language, shown in full, with
 *  [Approve all] [Skip]. Approved translations are used word for word (no AI at reply time). */
async function offerTranslations(env: Env, member: string, k: { id: number; question_en: string; answer_en: string }, tone: string | null) {
  if (redact(k.answer_en) !== k.answer_en) return;                       // the AI would see "[number]" and copy it
  const r = await chat<Record<(typeof TRANSLATED)[number], string>>(env, {
    system: translationsPrompt(tone), schema: TRANSLATIONS_SCHEMA, name: 'translations', prefer: ['gemini'], user: k.answer_en,
  });
  if (!r) return;
  const translations = Object.fromEntries(TRANSLATED.map((l) => [l, clip(r[l].trim(), 900)]).filter(([, v]) => v));
  if (Object.keys(translations).length !== TRANSLATED.length) return;
  await sb(env, 'PATCH', `knowledge?id=eq.${k.id}`, { translations, translations_ok: false }, 'return=minimal');
  await sendText(env, member, [`Translations of: ${k.question_en}`, ...TRANSLATED.map((l) => `${langName(l)}:\n${translations[l]}`)].join('\n\n'));
  await sendButtons(env, member, 'Use these translations for this answer?', [{ id: `tr:a:${k.id}`, title: 'Approve all' }, { id: `tr:s:${k.id}`, title: 'Skip' }]);
}
const toneOf = async (env: Env) => (await sb<{ value: string }>(env, 'GET', 'settings?key=eq.tone&select=value').catch(() => []))[0]?.value ?? null;

/** The team's words to the client, in the client's language. Translated only when nothing would
 *  be removed on the way to the AI (numbers, emails): otherwise sent exactly as written. */
async function relay(env: Env, now: number, c: Contact, text: string, asIs = false): Promise<{ ok: boolean; note: string }> {
  const direct = c.phone ? ` Message them directly: wa.me/${c.phone}` : '';
  if (c.mode === 'stopped') return { ok: false, note: `#${c.code} opted out, so nothing was sent.` };
  if (c.mode === 'blocked') return { ok: false, note: `#${c.code} is blocked, so nothing was sent. "#${c.code} unblock" first.` };
  if (Date.parse(c.last_in_at) < now - 24 * HOUR) return { ok: false, note: `#${c.code}'s 24-hour WhatsApp window has closed, so I can't send this.${direct}` };
  let out = text, asWritten = false;
  if (c.lang && c.lang !== 'en' && !asIs) {
    if (redact(text) !== text) asWritten = true;
    else {
      const r = await chat<{ text: string }>(env, { system: translatePrompt(c.lang), user: text, schema: TEXT_SCHEMA, name: 'translate', prefer: writer(c.lang) });
      if (r?.text.trim()) out = r.text.trim(); else asWritten = true;
    }
  }
  if (!(await sendText(env, c.wa_id, out))) return { ok: false, note: `Sending to #${c.code} failed.${direct}` };
  count(env);
  await env.DB.prepare(`UPDATE leads SET last_contact_at = datetime('now') WHERE id = ?`).bind(c.lead_id).run();
  return { ok: true, note: `Sent to #${c.code} ✅${asWritten ? ' (as you wrote it: numbers and emails are never sent for translation)' : ''}` };
}

type Reply = (body: string, link?: { wa_id?: string; knowledge_id?: number; question_id?: number }) => Promise<void>;

/** [Send] on a draft: the bot's reply goes to the client as written (it is already in their
 *  language). A draft of an approved answer teaches nothing new; any other becomes a suggested
 *  answer that the member reads in full and approves, like a typed one. */
async function sendDraft(env: Env, now: number, member: string, question: Question, reply: Reply, about: About = {}) {
  if (question.status !== 'pending') return reply(`Already answered by ${question.answered_by === member ? 'you' : `+${question.answered_by}`}.`);
  if (!question.draft) return reply('There is no draft for this one. Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  const [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(question.wa_id)}`);
  if (!contact) return reply('That client deleted their data, so nothing was sent.');
  const [won] = await sb<Question>(env, 'PATCH', `questions?id=eq.${question.id}&status=eq.pending`,
    { status: 'answered', answer: question.draft, answered_by: member, answered_at: iso(now) });
  if (!won) return reply('Someone answered this a moment ago.');
  const sent = await relay(env, now, contact, question.draft, true);
  if (!sent.ok) {
    // Nothing reached the client: the question stays open, so Send can be tapped again later.
    await sb(env, 'PATCH', `questions?id=eq.${question.id}`, { status: 'pending', answer: null, answered_by: null, answered_at: null }, 'return=minimal');
    return reply(sent.note, { wa_id: contact.wa_id });
  }
  about.sent = sent.note;
  if (question.knowledge_id) return reply(sent.note, { wa_id: contact.wa_id });
  return suggest(env, now, member, contact, question.question_en, question.draft_en || question.draft, sent.note, question.id, reply);
}

async function review(env: Env, now: number, member: string, action: 'a' | 'e' | 'r', id: number, reply: Reply) {
  if (action === 'e') return reply('Reply to this message with the corrected answer.', { knowledge_id: id });
  if (action === 'r') {                                                     // also withdraws an approved answer
    const [k] = await sb(env, 'PATCH', `knowledge?id=eq.${id}&status=in.(pending,approved)`, { status: 'rejected', decided_by: member, decided_at: iso(now) });
    return reply(k ? 'Discarded: I will not use it.' : 'This one was already discarded.');
  }
  const [k] = await sb<Knowledge>(env, 'GET', `knowledge?id=eq.${id}&status=eq.pending`);
  if (!k) return reply('This one was already decided.');
  const v = await embed(env, k.question_en);
  if (!v) return reply('I could not save it right now. Tap Approve again in a minute.');
  const [ok] = await sb(env, 'PATCH', `knowledge?id=eq.${id}&status=eq.pending`, { status: 'approved', embedding: vec(v), decided_by: member, decided_at: iso(now) });
  await reply(ok ? 'Saved ✅ I will answer this myself next time.' : 'This one was already decided.');
  // the answer is saved: a failure from here on never asks the member to tap again
  if (ok) await offerTranslations(env, member, k, await toneOf(env)).catch((e) => console.error('[bot] translations not offered', String(e)));
}

async function saveEdit(env: Env, now: number, member: string, id: number, text: string, reply: Reply) {
  const [k] = await sb<Knowledge>(env, 'GET', `knowledge?id=eq.${id}`);
  if (!k || !text) return reply(HELP);
  const v = await embed(env, k.question_en);
  if (!v) return reply('I could not save it right now. Reply with the answer again in a minute.', { knowledge_id: id });
  // the old translations go too: an earlier "Approve all" must not bring back the old answer
  await sb(env, 'PATCH', `knowledge?id=eq.${id}`, { answer_en: clip(text, 700), status: 'approved', embedding: vec(v), decided_by: member, decided_at: iso(now), translations: {}, translations_ok: false }, 'return=minimal');
  await reply('Saved your answer ✅ I will use it next time.');
  await offerTranslations(env, member, { id, question_en: k.question_en, answer_en: clip(text, 700) }, await toneOf(env))
    .catch((e) => console.error('[bot] translations not offered', String(e)));
}

/* =================================================================================== cron */

/** Every 2 minutes: the daily purge (first, so nothing can skip it), the 10-minute "team will
 *  reply" message (once per client per run), then stuck messages, all within one call budget. */
export async function tick(env0: Env, now: number) {
  const env = withRun(env0);
  const d = new Date(now);
  if (d.getUTCHours() === 21 && d.getUTCMinutes() >= 30 && d.getUTCMinutes() < 32) {   // ~03:00 IST, once a day
    await Promise.all([
      sb(env, 'DELETE', `messages?at=lt.${iso(now - 90 * DAY)}`, undefined, 'return=minimal'),
      sb(env, 'DELETE', `contacts?last_in_at=lt.${iso(now - 180 * DAY)}`, undefined, 'return=minimal'),
      sb(env, 'DELETE', `knowledge?status=in.(pending,rejected)&created_at=lt.${iso(now - 90 * DAY)}`, undefined, 'return=minimal'),
    ]).catch((e) => console.error('[bot] purge failed', String(e)));
    await learnFromWins(env).catch((e) => console.error('[bot] won-deal learning failed', String(e)));
  }
  const ist = new Date(now + 5.5 * HOUR);                                                  // Monday 10 a.m. India time
  if (ist.getUTCDay() === 1 && ist.getUTCHours() === 10) {
    await weeklyOnce(env, now, ist.toISOString().slice(0, 10)).catch((e) => console.error('[bot] weekly report failed', String(e)));
  }
  const due = await sb<Question>(env, 'GET', `questions?status=eq.pending&client_told_at=is.null&created_at=lt.${iso(now - 10 * MIN)}&select=id,wa_id&order=created_at.asc&limit=10`);
  const told = new Set<string>();
  for (const question of due) {
    if (!room(env, 6)) break;
    const [won] = await sb(env, 'PATCH', `questions?id=eq.${question.id}&client_told_at=is.null&status=eq.pending`, { client_told_at: iso(now) });
    if (!won || told.has(question.wa_id)) continue;
    told.add(question.wa_id);
    const [c] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(question.wa_id)}`);
    if (!c || c.mode === 'stopped' || c.mode === 'blocked' || Date.parse(c.last_in_at) < now - 24 * HOUR) continue;
    await sendText(env, c.wa_id, t(c.lang, isOpenNow(new Date(now)) ? 'teamSoon' : 'teamLater'));
  }
  const stale = await sb<Msg>(env, 'GET', `messages?dir=eq.in&handled_at=is.null&at=lt.${iso(now - 2 * MIN)}&order=at.asc&limit=20`);
  for (const m of stale.filter((m) => m.team)) {
    if (!room(env, 16)) return;
    await runTeam(env, m);
  }
  for (const waId of new Set(stale.filter((m) => m.wa_id && !m.team).map((m) => m.wa_id!))) {
    if (!room(env, 24)) return;
    await runClient(env, waId).catch((e) => console.error('[bot] retry failed', String(e)));
  }
}

/** The weekly report, once per Monday: any tick in the 10 o'clock hour may claim it (a failed
 *  tick is retried by the next one), and the settings row 'weekly_at' records the week sent. */
async function weeklyOnce(env: Env, now: number, monday: string) {
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'weekly_at', value: '2000-01-01', updated_at: iso(now) }, 'resolution=ignore-duplicates,return=minimal');
  const [mine] = await sb(env, 'PATCH', `settings?key=eq.weekly_at&value=lt.${monday}`, { value: monday, updated_at: iso(now) });
  if (mine) await weekly(env, now);
}

/** Monday's learning report to the team: what was asked, who answered, what still needs the
 *  team, the answers waiting for Approve (one tap each), and a refreshed tone guide. */
export async function weekly(env: Env, now: number) {
  const qs = await sb<Question>(env, 'GET', `questions?created_at=gt.${iso(now - 7 * DAY)}&select=kind,status,question_en&limit=500`);
  const key = (text: string) => text.trim().toLowerCase().replace(/[?.!\s]+$/, '');
  const tally = (list: Question[]) => {
    const n = new Map<string, number>();
    for (const x of list) n.set(key(x.question_en), (n.get(key(x.question_en)) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  const auto = qs.filter((x) => x.kind === 'auto'), team = qs.filter((x) => x.kind !== 'auto');
  const pending = await sb<Knowledge>(env, 'GET', 'knowledge?status=eq.pending&select=id,question_en,answer_en&order=created_at.desc&limit=3');
  const tone = await updateTone(env, now).catch(() => null);         // the report goes out without it
  const text = [
    'Weekly learning report (last 7 days)',
    `Questions: ${qs.length}. Answered by the bot: ${auto.length}. Went to the team: ${team.length}. Still open: ${qs.filter((x) => x.status === 'pending').length}.`,
    qs.length ? `Most asked:\n${tally(qs).map(([q, n], i) => `${i + 1}. ${q} (${n}×)`).join('\n')}` : 'No questions this week.',
    team.length ? `Still going to the team:\n${tally(team).map(([q], i) => `${i + 1}. ${q}`).join('\n')}` : '',
    pending.length ? `${pending.length} answer${pending.length > 1 ? 's' : ''} waiting for your Approve (below).` : 'Nothing is waiting for approval.',
    tone ? `Tone guide now: ${tone}` : '',
  ].filter(Boolean).join('\n\n');
  await toTeam(env, now, text, {});
  for (const k of pending) {
    if (!room(env, 3 * teamIds(env).size + 2)) break;
    await card(env, now, k, '');
  }
}

/** The team's style, from their last 30 days of replies: at most five short rules the answer and
 *  translation prompts follow. Kept in Supabase settings ('tone'). */
async function updateTone(env: Env, now: number) {
  const recent = await sb<Msg>(env, 'GET', `messages?team=not.is.null&dir=eq.in&body=not.is.null&at=gt.${iso(now - 30 * DAY)}&order=at.desc&limit=40&select=body`);
  const samples = recent.map((m) => (m.body ?? '').replace(/^#[A-Z0-9]{5}\b\s*/i, '').trim()).filter((b) => b.split(/\s+/).length >= 5);
  if (samples.length < 5) return toneOf(env);
  const r = await chat<{ text: string }>(env, { system: tonePrompt, user: samples.join('\n---\n'), schema: TEXT_SCHEMA, name: 'tone', prefer: ['groq', 'gemini'] });
  if (!r?.text.trim()) return toneOf(env);
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'tone', value: clip(r.text.trim(), 600), updated_at: iso(now) }, 'resolution=merge-duplicates,return=minimal');
  return clip(r.text.trim(), 600);
}

/** Leads marked Won in Admin: every answer used in that chat gets a win, so it is preferred when
 *  similar questions tie. Each contact counts once (won_counted). */
async function learnFromWins(env: Env) {
  count(env);
  const won = (await env.DB.prepare(`SELECT id FROM leads WHERE source = 'whatsapp' AND status = 'won' ORDER BY created_at DESC LIMIT 50`).all<{ id: string }>()).results;
  if (!won.length) return;
  const contacts = await sb<Contact>(env, 'GET', `contacts?lead_id=in.${q(`(${won.map((l) => `"${l.id}"`).join(',')})`)}&won_counted=eq.false&select=wa_id&limit=3`);
  for (const c of contacts) {
    if (!room(env, 10)) return;
    // Claimed first: a failure part-way loses a win, never counts one twice.
    const [mine] = await sb(env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&won_counted=eq.false`, { won_counted: true });
    if (!mine) continue;
    const asked = await sb<Question>(env, 'GET', `questions?wa_id=eq.${q(c.wa_id)}&select=id,knowledge_id&limit=50`);
    const ids = new Set(asked.map((x) => x.knowledge_id).filter((id): id is number => !!id));
    if (asked.length) for (const k of await sb<Knowledge>(env, 'GET', `knowledge?question_id=in.(${asked.map((x) => x.id).join(',')})&select=id`)) ids.add(k.id);
    if (ids.size) for (const k of await sb<Knowledge>(env, 'GET', `knowledge?id=in.(${[...ids].slice(0, 20).join(',')})&select=id,wins`)) {
      if (!room(env, 2)) return;
      await sb(env, 'PATCH', `knowledge?id=eq.${k.id}`, { wins: (k.wins ?? 0) + 1 }, 'return=minimal');
    }
  }
}
