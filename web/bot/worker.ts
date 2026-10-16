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
  answerPrompt, extractPrompt, generalisePrompt, langFromText, langName, prefilledService, scriptLang, serviceByKey,
  serviceFromText, t, translatePrompt,
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
const MONEY = /₹|\brs\.?\s*\d|\binr\b|rupees?|lakhs?|\$\s*\d|discount|രൂപ|रुपय|ರೂಪಾಯಿ/i;

interface Fields { name?: string; business?: string; need?: string; timeline?: string; notes?: string }
export interface Contact {
  wa_id: string; phone: string | null; profile_name: string | null; code: string; lead_id: string; lead_saved: boolean;
  step: Step; mode: 'bot' | 'human' | 'stopped' | 'blocked'; taken_by: string | null; lang: Lang | null; service: ServiceKey | null;
  fields: Fields; alerted_at: string | null; busy_until: string | null; turns: number; turns_day: string | null; last_in_at: string;
}
export interface Msg {
  wamid: string; wa_id: string | null; team: string | null; dir: 'in' | 'out'; body: string | null; reply_id: string | null;
  ctx_id: string | null; profile: string | null; question_id: number | null; knowledge_id: number | null;
  handled_at: string | null; at: string;
}
interface Question {
  id: number; wa_id: string; question: string; question_en: string; status: string; answered_by: string | null;
  kind: 'question' | 'draft' | 'decision' | 'price'; draft: string | null; draft_en: string | null;
}
interface Knowledge { id: number; question_en: string; answer_en: string; status: string; similarity?: number }

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
    if (!room(env, 16)) return;                                // the cron picks up the rest
    await runTeam(env, m);
  }
  for (const waId of new Set(fresh.filter((m) => m.wa_id).map((m) => m.wa_id!))) await runClient(env, waId);
}

/** A team message, handled once; if it fails, the member is told to send it again. */
async function runTeam(env: Env, m: Msg) {
  const now = clock.now();
  try { await handleTeam(env, m, now); } catch (e) {
    console.error('[bot] team message failed', String(e));
    await sendText(env, m.team!, 'That did not go through. Please send it again.');
  }
  await sb(env, 'PATCH', `messages?wamid=eq.${q(m.wamid)}`, { handled_at: iso(now) }, 'return=minimal');
}

/* ================================================================================ clients */

/** One client's unhandled messages, one turn at a time (the lock), then check again. */
export async function runClient(env: Env, waId: string) {
  for (let round = 0; round < 3; round++) {
    if (!room(env, 24)) return;                                // the cron picks up the rest
    const now = clock.now(), until = iso(now + LOCK);
    const claimed = await claim(env, waId, now, until);
    if (!claimed) return;                                      // another invocation is on it
    const old = structuredClone(claimed);
    const turn = new Turn(env, structuredClone(claimed), now);
    const done: Msg[] = [];
    let committed = false;
    try {
      const pending = await sb<Msg>(env, 'GET', `messages?wa_id=eq.${q(waId)}&dir=eq.in&handled_at=is.null&order=at.asc,wamid.asc&limit=10`);
      if (pending.length && turn.c.mode !== 'stopped' && turn.c.mode !== 'blocked') void markRead(env, pending[pending.length - 1].wamid);
      // A flood (10 queued at once, or the same text 4 times) blocks the chat; the team can undo it.
      const same = new Map<string, number>();
      for (const m of pending) if (m.body) same.set(m.body, (same.get(m.body) ?? 0) + 1);
      if (pending.length >= 10 || [...same.values()].some((n) => n >= 4)) await turn.block('a flood of messages', pending.at(-1)?.body ?? '');
      for (const m of pending) {
        if (done.length && !room(env, 20)) break;              // always at least one message per turn
        const snapshot = structuredClone(turn.c);
        try { await turn.handle(m); done.push(m); } catch (e) {
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
      await sb(env, 'PATCH', `contacts?wa_id=eq.${q(waId)}&busy_until=eq.${q(until)}`, patch, 'return=minimal');
    }
    if (!done.length) return;
    const more = await sb(env, 'GET', `messages?wa_id=eq.${q(waId)}&dir=eq.in&handled_at=is.null&select=wamid&limit=1`);
    if (!more.length) return;
  }
}

async function claim(env: Env, waId: string, now: number, until: string): Promise<Contact | null> {
  const [mine] = await sb<Contact>(env, 'PATCH', `contacts?wa_id=eq.${q(waId)}&or=(busy_until.is.null,busy_until.lt.${iso(now)})`, { busy_until: until });
  if (mine) return mine;
  if ((await sb(env, 'GET', `contacts?wa_id=eq.${q(waId)}&select=wa_id`)).length) return null;   // busy
  const [first] = await sb<Msg>(env, 'GET', `messages?wa_id=eq.${q(waId)}&dir=eq.in&order=at.asc&limit=1`);
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
  const [first] = await sb<{ created_at: string }>(env, 'GET', 'contacts?select=created_at&order=created_at.asc&limit=1');
  return !first || now < Date.parse(first.created_at) + days * DAY;
}
const brief = (c: Contact) => `Brief so far: ${serviceLabel(c)} · need: ${clip(c.fields.need || '-', 140)} · timeline: ${c.fields.timeline || '-'}`;

class Turn {
  constructor(readonly env: Env, readonly c: Contact, readonly now: number) {}
  private say(text: string) { return sendText(this.env, this.c.wa_id, text); }

  erased = false;

  async handle(m: Msg) {
    const c = this.c, text = (m.body ?? '').trim(), lang = c.lang ?? 'en';
    const [kind, value] = (m.reply_id ?? '').split(':');
    // Privacy first: works even for stopped or blocked chats.
    if (/^delete\s+(my\s+)?(data|details|chat)[\s.!]*$/i.test(text)) {
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
    if (Date.parse(c.last_in_at) < this.now - 30 * DAY && this.welcomeBack()) {
      c.last_in_at = m.at;
      await sendButtons(this.env, c.wa_id, t(lang, 'welcomeBack'), TEXT[lang].retBtn.map((title, i) => ({ id: `ret:${i ? 'new' : 'same'}`, title })));
      return;
    }
    c.last_in_at = m.at;
    if (/^(stop|unsubscribe)$/i.test(text)) { c.mode = 'stopped'; await this.say(t(c.lang, 'stopped')); return; }
    if (c.mode === 'stopped') c.mode = 'bot';                               // any later message restarts the chat
    if (c.mode === 'human') {
      // With a person on the chat the bot stays quiet and forwards: to whoever took it, or to
      // the whole team while nobody has (an upset or urgent client waiting for anyone).
      const team = teamIds(this.env);
      if (c.taken_by && !team.has(c.taken_by)) c.taken_by = null;           // that person left the team
      const to = c.taken_by ? [c.taken_by] : [...team];
      if (to.length) {
        await toTeam(this.env, this.now, `#${c.code} ${who(c)}: ${text || m.reply_id}`, { wa_id: c.wa_id }, to);
        return;
      }
      c.mode = 'bot';
    }
    if (!text) { await this.say(t(c.lang, 'pleaseType')); return; }

    // Taps work at any step (an old menu tapped later just updates the answer).
    if (kind === 'ret') {
      if (value === 'new') { this.restart(); c.step = 'service'; await this.ask(text); return; }
      c.step = nextStep(c);
      if (c.step === 'done') await this.say(t(c.lang, 'sameProject')); else await this.ask();
      return;
    }
    if (kind === 'call') {
      if (value === 'y') { await this.alertTeam('call'); await this.say(t(c.lang, 'callSoon')); } else await this.ask('', t(c.lang, 'keepGoing'));
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
        c.step = nextStep(c);
        await this.field(text);
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
    c.step = 'returning';
    return true;
  }

  /** "DELETE MY DATA": their messages, the contact (its questions cascade) and their WhatsApp
   *  leads in D1. Learned answers keep no personal details (generalised before approval). */
  private async erase() {
    const c = this.c;
    await sb(this.env, 'DELETE', `messages?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    await sb(this.env, 'DELETE', `contacts?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    count(this.env);
    await this.env.DB.prepare(`DELETE FROM leads WHERE source = 'whatsapp' AND (id = ? OR (phone IS NOT NULL AND phone = ?))`)
      .bind(c.lead_id, c.phone ? `+${c.phone}` : null).run();
    this.erased = true;
    c.lead_saved = true;                                                    // nothing re-creates the lead this turn
    await toTeam(this.env, this.now, `#${c.code} asked to delete their data. Their chat, details and WhatsApp lead are erased.`, {});
    await this.say(t(c.lang, 'deleted'));
  }

  /** Abuse or a flood: stop replying, tell the team once. */
  async block(reason: string, last: string) {
    const c = this.c;
    if (c.mode === 'blocked') return;
    c.mode = 'blocked';
    await toTeam(this.env, this.now, `#${c.code} blocked: ${reason}. I no longer reply to them. "#${c.code} unblock" to undo.\nLast message: "${clip(last, 200)}"`, { wa_id: c.wa_id });
  }

  /** Upset or urgent: the bot stops asking and the whole team is alerted to take over. */
  private async handOver(mood: 'upset' | 'urgent') {
    const c = this.c;
    c.mode = 'human'; c.taken_by = null;
    await this.alertTeam(mood);
    await this.say(t(c.lang, 'person'));
  }

  private restart() {
    Object.assign(this.c, {
      lead_id: crypto.randomUUID(), lead_saved: false, step: 'start', mode: 'bot', taken_by: null, service: null, fields: {}, alerted_at: null,
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
      if (x.abusive) { await this.block('abusive messages', text); return; }
      if (x.mood === 'upset' || x.mood === 'urgent') { await this.handOver(x.mood); return; }
      if (x.kind === 'question' && x.price && !x.commitment) {
        // Prices are the team's: the question goes to them and the client is offered a call.
        await this.escalate(text, x.question_en || text, { kind: 'price' });
        await sendButtons(this.env, c.wa_id, t(lang, 'price'), TEXT[lang].callBtn.map((title, i) => ({ id: `call:${i ? 'n' : 'y'}`, title })));
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
      const matches = v ? await sb<Knowledge>(this.env, 'POST', 'rpc/match_knowledge',
        { query_embedding: vec(v), match_threshold: MATCH, match_count: 3 }).catch(() => []) : [];
      // The client's words go in as one JSON string, so they can't pose as facts or approved answers.
      const r = await this.ai<{ answer: string; answer_en: string }>({
        system: answerPrompt(c.lang ?? 'en'), schema: ANSWER_SCHEMA, name: 'answer',
        user: JSON.stringify({ facts: FACTS, approved_answers: matches.map((k) => ({ q: k.question_en, a: k.answer_en })), client_question: original }),
      }, writer(c.lang));
      const answer = r?.answer.trim(), answerEn = r?.answer_en.trim() || answer;
      if (answer && !MONEY.test(answer) && !MONEY.test(answerEn ?? '')) {
        // Sent straight away only when an approved answer matches closely and training is over;
        // otherwise the team gets the draft: one tap sends it, and that approval teaches the bot.
        if ((matches[0]?.similarity ?? 0) >= SURE && !(await training(this.env, this.now))) return clip(answer, 600);
        await this.escalate(original, questionEn, { kind: 'draft', draft: clip(answer, 600), draft_en: clip(answerEn ?? answer, 600) });
        return t(c.lang, 'checking');
      }
    }
    await this.escalate(original, questionEn, { kind: commitment ? 'decision' : 'question' });
    return t(c.lang, 'checking');
  }

  /** A question for the team: stored, then sent with the client's words, the brief so far and,
   *  for a draft, the reply the bot would send with [Send] [Write my own]. */
  private async escalate(original: string, questionEn: string, o: { kind: Question['kind']; draft?: string; draft_en?: string }) {
    const c = this.c, other = c.lang && c.lang !== 'en';
    const [question] = await sb<Question>(this.env, 'POST', 'questions', {
      wa_id: c.wa_id, question: original, question_en: questionEn, status: 'pending', kind: o.kind, draft: o.draft ?? null, draft_en: o.draft_en ?? null,
    });
    await this.saveLead();
    const head = { question: 'question', draft: 'draft reply', decision: '⚠ needs your decision (discount, deadline or terms)', price: 'price question (offered a call)' }[o.kind];
    const body = [
      `#${c.code} ${head} · ${who(c)} · ${serviceLabel(c)} · ${langName(c.lang)}`,
      `"${clip(original, 600)}"${questionEn !== original ? `\nIn English: ${clip(questionEn, 600)}` : ''}`,
      brief(c), '',
      o.draft
        ? `Draft reply${other ? ` (${langName(c.lang)})` : ''}: ${o.draft}${other ? `\nIn English: ${o.draft_en}` : ''}\n\nTap Send, or reply to this message with your own answer.`
        : `Reply to this message with the answer (I translate it for the client). "#${c.code} take" = chat with them yourself.`,
    ].join('\n');
    const sent = await toTeam(this.env, this.now, body, { wa_id: c.wa_id, question_id: question.id }, undefined,
      o.draft ? [{ id: `dr:s:${question.id}`, title: 'Send' }, { id: `dr:w:${question.id}`, title: 'Write my own' }] : undefined);
    if (!sent) console.error(`[bot] question #${c.code} reached no team member (TEAM_WHATSAPP, template?)`);
  }

  /** AI with a daily cap per client; null means "use the fixed path". */
  private async ai<T>(o: { system: string; user: string; schema: typeof EXTRACT_SCHEMA | typeof ANSWER_SCHEMA; name: string }, prefer: Provider[]) {
    const c = this.c, today = iso(this.now).slice(0, 10);
    if (c.turns_day !== today) { c.turns_day = today; c.turns = 0; }
    if (c.turns >= AI_PER_DAY || !room(this.env, 14)) return null;
    c.turns++;
    return chat<T>(this.env, { ...o, prefer });
  }

  private async alertTeam(why: Alert) {
    const c = this.c;
    if (why === 'complete' && c.alerted_at) return;
    await this.saveLead();                                    // stored before its notification
    const f = c.fields;
    const sent = await toTeam(this.env, this.now, [
      `#${c.code} ${ALERT_HEAD[why]}`,
      `Name: ${f.name || c.profile_name || '-'}`, `Business: ${f.business || '-'}`, `Service: ${serviceLabel(c)}`,
      `Need: ${clip(f.need || '-', 500)}`, `Timeline: ${f.timeline || '-'}`, `Language: ${langName(c.lang)}`,
      ...(f.notes ? [`Notes: ${clip(f.notes, 300)}`] : []),
      c.phone ? `WhatsApp: wa.me/${c.phone}` : 'WhatsApp: no phone number shared (username)',
      '', why === 'upset' || why === 'urgent'
        ? `The bot has stopped. Reply to this message to talk to them; "#${c.code} bot" hands back to the bot.`
        : 'Reply to this message to write to the client.',
    ].join('\n'), { wa_id: c.wa_id });
    if (!sent) console.error(`[bot] lead #${c.code} reached no team member (TEAM_WHATSAPP, template?); retried on their next message`);
    else if (why === 'complete') c.alerted_at = iso(this.now);
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
    if (id) { sent++; await storeOut(env, now, id, member, text, link); }
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

async function handleTeam(env: Env, m: Msg, now: number) {
  const member = m.team!, text = (m.body ?? '').trim();
  const reply = async (body: string, link: { wa_id?: string; knowledge_id?: number; question_id?: number } = {}) => {
    const id = await sendText(env, member, body);
    if (id && (link.wa_id || link.knowledge_id || link.question_id)) await storeOut(env, now, id, member, body, link);
  };

  const kb = /^kb:([aer]):(\d+)$/.exec(m.reply_id ?? '');
  if (kb) return review(env, now, member, kb[1] as 'a' | 'e' | 'r', Number(kb[2]), reply);
  const dr = /^dr:([sw]):(\d+)$/.exec(m.reply_id ?? '');
  if (dr) {
    const [question] = await sb<Question>(env, 'GET', `questions?id=eq.${dr[2]}`);
    if (!question) return reply(HELP);
    if (dr[1] === 's') return sendDraft(env, now, member, question, reply);
    return reply('Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  }

  let contact: Contact | undefined, questionId: number | null = null, rest = text;
  const code = /^#([A-Z0-9]{5})\b\s*/i.exec(text);
  if (code) {
    rest = text.slice(code[0].length).trim();
    [contact] = await sb<Contact>(env, 'GET', `contacts?code=eq.${q(code[1].toUpperCase())}`);
  } else if (m.ctx_id) {
    const [o] = await sb<Msg>(env, 'GET', `messages?wamid=eq.${q(m.ctx_id)}`);
    if (o?.knowledge_id) return saveEdit(env, now, member, o.knowledge_id, text, reply);   // only the Edit prompt has one
    questionId = o?.question_id ?? null;
    if (o?.wa_id) [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(o.wa_id)}`);
  }
  if (!contact || !rest) return reply(HELP);

  if (/^unblock$/i.test(rest)) {
    await sb(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}&mode=eq.blocked`, { mode: 'bot' }, 'return=minimal');
    return reply(`#${contact.code} is unblocked; the bot answers them again.`);
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
  // "send" / "ok" in reply to a draft (e.g. to the template, which carries no buttons) sends the draft.
  if (pending?.kind === 'draft' && pending.draft && /^(send|ok|okay|yes|👍)[\s.!]*$/i.test(rest)) return sendDraft(env, now, member, pending, reply);
  if (pending) {
    const [won] = await sb<Question>(env, 'PATCH', `questions?id=eq.${pending.id}&status=eq.pending`,
      { status: 'answered', answer: clip(rest, 2000), answered_by: member, answered_at: iso(now) });
    if (!won) return reply('Someone answered this a moment ago.');
  }
  const sent = await relay(env, now, contact, rest);
  if (!pending || !sent.ok) return reply(sent.note, { wa_id: contact.wa_id });

  // Learning: a general Q&A, only reused once this member taps Approve. Short enough that the
  // card shows all of it (WhatsApp cuts a button message at 1024 characters).
  const qa = await chat<{ question_en: string; answer_en: string }>(env, {
    system: generalisePrompt, schema: QA_SCHEMA, name: 'faq', prefer: ['groq', 'gemini'],
    user: `Client question: ${pending.question_en}\nTeam answer: ${rest}`,
  });
  if (!qa?.question_en.trim() || !qa.answer_en.trim()) return reply(sent.note, { wa_id: contact.wa_id });
  const [k] = await sb<Knowledge>(env, 'POST', 'knowledge', {
    question_en: clip(qa.question_en, 200), answer_en: clip(qa.answer_en, 700), source: 'team', status: 'pending', question_id: pending.id,
  });
  const body = `${sent.note}\n\nSave this for next time?\nQ: ${k.question_en}\nA: ${k.answer_en}`;
  const id = await sendButtons(env, member, body, [
    { id: `kb:a:${k.id}`, title: 'Approve' }, { id: `kb:e:${k.id}`, title: 'Edit' }, { id: `kb:r:${k.id}`, title: 'Reject' },
  ]);
  if (id) await storeOut(env, now, id, member, body, { wa_id: contact.wa_id });   // a reply to this card goes to the client
}

/** The team's words to the client, in the client's language. Translated only when nothing would
 *  be removed on the way to the AI (numbers, emails): otherwise sent exactly as written. */
async function relay(env: Env, now: number, c: Contact, text: string, asIs = false): Promise<{ ok: boolean; note: string }> {
  const direct = c.phone ? ` Message them directly: wa.me/${c.phone}` : '';
  if (c.mode === 'stopped') return { ok: false, note: `#${c.code} opted out, so nothing was sent.` };
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
 *  language) and, since a team member approved it, it is saved as an approved answer. */
async function sendDraft(env: Env, now: number, member: string, question: Question, reply: Reply) {
  if (question.status !== 'pending') return reply(`Already answered by ${question.answered_by === member ? 'you' : `+${question.answered_by}`}.`);
  if (!question.draft) return reply('There is no draft for this one. Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  const [won] = await sb<Question>(env, 'PATCH', `questions?id=eq.${question.id}&status=eq.pending`,
    { status: 'answered', answer: question.draft, answered_by: member, answered_at: iso(now) });
  if (!won) return reply('Someone answered this a moment ago.');
  const [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(question.wa_id)}`);
  if (!contact) return reply('That client deleted their data, so nothing was sent.');
  const sent = await relay(env, now, contact, question.draft, true);
  if (!sent.ok) return reply(sent.note, { wa_id: contact.wa_id });
  const v = await embed(env, question.question_en);
  await sb(env, 'POST', 'knowledge', {
    question_en: clip(question.question_en, 200), answer_en: clip(question.draft_en || question.draft, 700), source: 'team',
    status: v ? 'approved' : 'pending', embedding: v ? vec(v) : null, question_id: question.id, decided_by: v ? member : null, decided_at: v ? iso(now) : null,
  }, 'return=minimal');
  return reply(`${sent.note} ${v ? 'Saved for next time.' : 'Not saved yet (AI busy); approve it later from the answers list.'}`, { wa_id: contact.wa_id });
}

async function review(env: Env, now: number, member: string, action: 'a' | 'e' | 'r', id: number, reply: Reply) {
  if (action === 'e') return reply('Reply to this message with the corrected answer.', { knowledge_id: id });
  if (action === 'r') {
    const [k] = await sb(env, 'PATCH', `knowledge?id=eq.${id}&status=eq.pending`, { status: 'rejected', decided_by: member, decided_at: iso(now) });
    return reply(k ? 'Discarded.' : 'This one was already decided.');
  }
  const [k] = await sb<Knowledge>(env, 'GET', `knowledge?id=eq.${id}&status=eq.pending`);
  if (!k) return reply('This one was already decided.');
  const v = await embed(env, k.question_en);
  if (!v) return reply('I could not save it right now. Tap Approve again in a minute.');
  const [ok] = await sb(env, 'PATCH', `knowledge?id=eq.${id}&status=eq.pending`, { status: 'approved', embedding: vec(v), decided_by: member, decided_at: iso(now) });
  return reply(ok ? 'Saved ✅ I will answer this myself next time.' : 'This one was already decided.');
}

async function saveEdit(env: Env, now: number, member: string, id: number, text: string, reply: Reply) {
  const [k] = await sb<Knowledge>(env, 'GET', `knowledge?id=eq.${id}`);
  if (!k || !text) return reply(HELP);
  const v = await embed(env, k.question_en);
  if (!v) return reply('I could not save it right now. Reply with the answer again in a minute.', { knowledge_id: id });
  await sb(env, 'PATCH', `knowledge?id=eq.${id}`, { answer_en: clip(text, 700), status: 'approved', embedding: vec(v), decided_by: member, decided_at: iso(now) }, 'return=minimal');
  return reply('Saved your answer ✅ I will use it next time.');
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
  }
  const due = await sb<Question>(env, 'GET', `questions?status=eq.pending&client_told_at=is.null&created_at=lt.${iso(now - 10 * MIN)}&select=id,wa_id&order=created_at.asc&limit=10`);
  const told = new Set<string>();
  for (const question of due) {
    if (!room(env, 6)) break;
    const [won] = await sb(env, 'PATCH', `questions?id=eq.${question.id}&client_told_at=is.null&status=eq.pending`, { client_told_at: iso(now) });
    if (!won || told.has(question.wa_id)) continue;
    told.add(question.wa_id);
    const [c] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(question.wa_id)}`);
    if (!c || c.mode === 'stopped' || Date.parse(c.last_in_at) < now - 24 * HOUR) continue;
    await sendText(env, c.wa_id, t(c.lang, isOpenNow(new Date(now)) ? 'teamSoon' : 'teamLater'));
  }
  const stale = await sb<Msg>(env, 'GET', `messages?dir=eq.in&handled_at=is.null&at=lt.${iso(now - 2 * MIN)}&order=at.asc&limit=20`);
  for (const m of stale.filter((m) => m.team)) {
    if (!room(env, 16)) return;
    await runTeam(env, m);
  }
  for (const waId of new Set(stale.filter((m) => m.wa_id).map((m) => m.wa_id!))) {
    if (!room(env, 24)) return;
    await runClient(env, waId).catch((e) => console.error('[bot] retry failed', String(e)));
  }
}
