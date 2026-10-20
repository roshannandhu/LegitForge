/** Legit Forge WhatsApp bot (separate Worker `legitforge-bot`, bot/wrangler.jsonc).
 *
 *  Client: menu → language → name → business → need → the service's own question → websites
 *  they like (websites and apps) → timeline (fixed text per language, so it works with no AI).
 *  Voice notes are transcribed; photos and documents are kept for the team (R2, Admin → Leads). Any message can also be a question: answered from approved knowledge
 *  (Supabase + Gemini embeddings), or asked to the team on their own WhatsApp. A team answer is
 *  relayed (translated) and, once a team member taps Approve, saved for next time.
 *  Every enquiry is a row in the website's D1 `leads`, so Admin → Leads shows it.
 *  Team (phase 4): alerts go first to whoever handles the service (Admin → Team, D1 bot_team),
 *  to the others 10 minutes later if nobody replied; "busy" / "free" / "off"; website form
 *  enquiries reach the team here too; a 10 a.m. summary on working days; "#CODE update: …".
 *  Sales (phase 5): a call the client's way (WhatsApp, phone or Meet) at a free time from the
 *  team's Google Calendar, with a reminder; "#CODE quote <link>", "#CODE pay <amount>"; a Google
 *  review request after a Won lead, then a referral ask; one revival template after 30 quiet days.
 *
 *  Durability: inbound messages are stored in Supabase before Meta gets its 200 (Supabase down →
 *  500, Meta retries). A per-contact lock (busy_until) runs one turn at a time. A turn keeps
 *  within the free plan's 50 subrequests and 30 s (io.ts room()): what it can't finish stays
 *  unhandled and the 2-minute cron picks it up. A message that fails part-way is rolled back in
 *  memory and retried; finished ones are marked handled before the state is saved. */

import { isOpenNow, replyDeadline } from '../lib/business-hours';
import { serviceOfLabel } from '../lib/wa-services';
import { CHANNEL_SQL } from '../lib/wa-services';
import { bookCall, calendarOn, callEvent, cancelCall, freeSlots, offerable } from './calendar';
import { CHANNEL_LABEL, channelOf, metaInbound, type Option } from './channels';
import { inr, paymentLink, rupees } from './pay';
import {
  ANSWER_SCHEMA, BACK_ASK, BRIEF_PROMPT, CANCEL_ASK, clearService, DETAILS, LANG_ASK, LOCALE, MENU_ASK, PERSON_ASK, PRICE_ASK, fill, EXTRACT_SCHEMA, FACTS, FIELDS, guessLang,
  LANG_PROMPT, LANGS, MONEY, QA_SCHEMA, SERVICES, TEXT, TEXT_SCHEMA, TIMELINES,
  TRANSLATED, TRANSLATIONS_SCHEMA, answerPrompt, extractPrompt, generalisePrompt, langFromText, langName, prefilledService,
  scriptLang, serviceByKey, serviceFromText, t, tonePrompt, translatePrompt, translationsPrompt,
  type Field, type Lang, type ServiceKey, type Step,
} from './text';
import {
  chat, clip, clock, count, embed, flushAi, forgetGateway, gatewayBase, markRead, media, q, redact, room, sb, sbCount, sendButtons, sendHumanText, sendList, sendTemplate, sendText, transcribe,
  validSignature, vec, viaGateway,
  type Env, type Provider,
} from './io';

export type { Env };
/** Admin → WhatsApp reads the bot through this entrypoint (the website's BOT service binding). */
export { BotAdmin } from './admin';
export { clock };                                                // tests move time
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const LOCK = 45_000;            // longer than a turn can run (room() stops new work after 18 s)
const AI_PER_DAY = 40;          // AI calls per client per day; past it, the fixed path still works
const FILE_MAX = 20 * 1024 * 1024, FILES_MAX = 20, VOICE_MAX = 5 * 1024 * 1024;   // per file, per enquiry, per voice note
const MATCH = 0.8;              // knowledge similarity needed to use an approved answer
const SURE = 0.9;               // ...and to send it without a team member checking it first
/** STOP, typed or spoken (a transcript ends with a full stop). */
const STOP = /^(stop|unsubscribe)(\s+promotions)?[\s.!]*$/i;     // "Stop promotions": Meta's marketing opt-out button
/** "Delete my data" in the bot's languages (the Yes/No buttons guard against false matches). */
const DELETE_ASK = /^(please\s+)?(delete|erase|remove)\s+(all\s+)?(of\s+)?(my\s+)?(data|details|chat|info(rmation)?)\b|ente\s+data\s+delete|ഡാറ്റ\s*ഡിലീറ്റ്|डेटा\s*(हटा|डिलीट)|ಡೇಟಾ\s*ಅಳಿಸ/i;

interface Fields {
  name?: string; business?: string; need?: string; details?: string; refs?: string; timeline?: string; notes?: string;
  files?: string[];          // R2 keys of the files they sent (leads/<lead id>/…), shown in Admin → Leads
  file_ack_at?: string;      // the last "saved" notice (an album is many messages: one notice a minute)
  lead_gone?: boolean;       // the admin deleted this enquiry's lead: files are no longer kept
  since?: string;            // when this enquiry started (the brief lists its own questions only)
  flags?: number;            // abusive messages flagged so far (the second one blocks)
  call_at?: string;          // last "arrange a call" alert, so repeated taps alert once a day
  arrange_at?: string;       // last "please arrange the time" note to the team (once a day too)
  person_at?: string;        // asked for a person: they wait for the team, not for a reminder
  call_how?: How;            // how they want the call: WhatsApp, phone or Google Meet
  away_at?: string;          // the last away message (the bot paused): once every 12 hours
  page?: string;             // where the enquiry started (the site's WhatsApp buttons): Admin → WhatsApp
  prev_leads?: string[];     // earlier enquiries' D1 lead ids (DELETE MY DATA removes them too)
  unclear?: number;          // the AI could not tell what their last message meant: asked once to say it again
  lang_guess?: Lang;         // the language their first typed words were clearly in (the list is skipped)
  lang_auto?: boolean;       // the language was detected, not chosen: it follows how they write
  lang_next?: Lang;          // ...once two messages in a row are clearly in another one
  resume?: Step;             // "language" typed mid-brief: the question to go back to
  opts?: { step: Step; list: Option[] };   // the bot's latest buttons: a typed number or their words is a tap
  price_asked?: string;      // a price asked in the first message: the call offer follows the brief
  contact?: string;          // how to reach them, from the website chat, Messenger or Instagram ('-' = skipped)
  email?: string;
  contact_tries?: number;
}
export interface Contact {
  wa_id: string; phone: string | null; profile_name: string | null; code: string; lead_id: string; lead_saved: boolean;
  step: Step; mode: 'bot' | 'human' | 'stopped' | 'blocked'; taken_by: string | null; lang: Lang | null; service: ServiceKey | null;
  fields: Fields; alerted_at: string | null; busy_until: string | null; won_counted?: boolean; turns: number; turns_day: string | null; last_in_at: string;
  nudged_at: string | null;  // the one reminder after 3 quiet hours mid-brief (once per enquiry)
  quote_at?: string | null;  // a quote went out ("#CODE quote"): their next message is passed to the team
  review_at?: string | null; // the Google review request went out (a Won lead): a referral ask follows
  referred_at?: string | null;
  revived_at?: string | null; // the one revival template after 30 quiet days
  pay_at?: string | null;    // the last payment link (a double tap sends one)
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
export const withRun = (env: Env): Env => ({ ...env, run: { calls: 0, t0: Date.now(), out: [], gone: new Set() } });

/** The bot's own messages to clients this run, in one write (Admin → Leads → Chat shows them; the
 *  team's copies are stored as they go). Never for a client who was erased in the meantime. */
export async function flushOut(env: Env, now: number) {
  await flushAi(env);
  const team = teamIds(env), out = (env.run?.out ?? []).filter((o) => !team.has(o.to) && !env.run?.gone?.has(o.to));
  if (env.run) env.run.out = [];
  if (!out.length) return;
  try {
    // only clients who still exist: a DELETE MY DATA in another run meanwhile keeps nothing of theirs
    const to = [...new Set(out.map((o) => o.to))];
    const live = new Set((await sb<{ wa_id: string }>(env, 'GET', `contacts?wa_id=in.${q(`(${to.map((w) => `"${w}"`).join(',')})`)}&select=wa_id`)).map((r) => r.wa_id));
    let prev = 0;                                                            // when each went (a millisecond apart at least, in order)
    const rows = out.filter((o) => live.has(o.to)).map((o) => {
      prev = Math.max(o.at, prev + 1);
      return { wamid: o.wamid, wa_id: o.to, team: null, dir: 'out', body: clip(o.body, 4000), reply_id: o.team ? 'team' : null, ctx_id: null, profile: null,
        question_id: null, knowledge_id: null, handled_at: iso(now), at: iso(prev),
        options: (o.to.startsWith('web:') && o.options?.length ? o.options : null) as Option[] | null | undefined };
    });
    if (!rows.some((r) => r.options)) for (const r of rows) delete r.options;   // (one batch: every row has the same columns)
    if (rows.length) await sb(env, 'POST', 'messages?on_conflict=wamid', rows, 'resolution=ignore-duplicates,return=minimal');
  } catch (e) { console.error('[bot] sent messages not stored', String(e)); }
}

interface Phrase { lang: string; phrase: string; meaning: string }
/** Regional phrases the team confirmed (D1 bot_phrases, 0017), once a run: the AI is told the
 *  meaning of those a message holds (glossary). Reading hints only, never company facts. */
async function phrasesOf(env: Env): Promise<Phrase[]> {
  if (env.run?.phrases) return env.run.phrases;
  count(env);
  const rows = (await env.DB.prepare('SELECT lang, phrase, meaning FROM bot_phrases ORDER BY id DESC LIMIT 300').all<Phrase>()
    .catch(() => ({ results: [] as Phrase[] }))).results;
  if (env.run) env.run.phrases = rows;
  return rows;
}
const words_ = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
export function glossary(text: string, phrases: Phrase[]) {
  const t = words_(text), hits = phrases.filter((p) => t.includes(words_(p.phrase))).slice(0, 8);
  return hits.length ? `\nPhrases our team has confirmed (use these meanings):\n${hits.map((p) => `- "${p.phrase}" (${langName(p.lang)}): ${p.meaning}`).join('\n')}` : '';
}
async function addPhrase(env: Env, member: string, lang: string, phrase: string, meaning: string) {
  const p = phrase.trim().toLowerCase().replace(/\s+/g, ' '), m = meaning.trim();
  if (p.length < 2 || p.length > 60 || m.length < 2 || m.length > 200) return 'Write it as: phrase mg: ethra aakum = how much will it cost';
  if (MONEY.test(m)) return 'A meaning never holds a price or amount: write what the phrase means, e.g. "how much will it cost".';
  count(env);
  await env.DB.prepare(`INSERT INTO bot_phrases (lang, phrase, meaning, created_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(lang, phrase) DO UPDATE SET meaning = excluded.meaning, created_by = excluded.created_by`).bind(lang, p, m, member).run();
  return `Saved ✅ "${p}" (${langName(lang)}) = ${m}. The AI reads it that way from now on; "phrases" lists them.`;
}
async function listPhrases(env: Env) {
  count(env);
  const rows = (await env.DB.prepare('SELECT lang, phrase, meaning FROM bot_phrases ORDER BY lang, phrase LIMIT 40').all<Phrase>()).results;
  return rows.length ? `Phrases the bot knows:\n${rows.map((p) => `• ${p.lang}: ${p.phrase} = ${p.meaning}`).join('\n')}`
    : 'No phrases yet. Teach one: phrase mg: ethra aakum = how much will it cost';
}

/** A new version of an approved answer (an edit): the old one is kept as superseded, with its wins.
 *  `keep` keeps the approved translations (the answer itself did not change). */
export async function newVersion(env: Env, old: Knowledge & { source: string; question_id?: number | null; version?: number },
  v: { question_en: string; answer_en: string; embedding: string; by: string; at: string; review_at?: string | null; keep: boolean }) {
  const [k] = await sb<{ id: number }>(env, 'POST', 'knowledge', {
    question_en: v.question_en, answer_en: v.answer_en, embedding: v.embedding, status: 'approved', source: old.source, question_id: old.question_id ?? null,
    wins: old.wins ?? 0, translations: v.keep ? old.translations ?? {} : {}, translations_ok: v.keep ? !!old.translations_ok : false,
    version: (old.version ?? 1) + 1, supersedes: old.id, decided_by: clip(v.by, 120), decided_at: v.at, review_at: v.review_at ?? null,
  });
  await sb(env, 'PATCH', `knowledge?id=eq.${old.id}&status=eq.approved`, { status: 'superseded' }, 'return=minimal');
  return k;
}

/** Admin → WhatsApp → Settings (D1 bot_settings, migration 0015), read once a run. */
async function settingsOf(env: Env): Promise<Record<string, string>> {
  if (env.run?.settings) return env.run.settings;
  count(env);
  // one read for both: the settings, and the greeting the site's WhatsApp buttons open with (Admin → Company)
  const rows = (await env.DB.prepare(`SELECT key, value FROM bot_settings
    UNION ALL SELECT 'site_greeting', json_extract(data, '$.whatsappText') FROM company WHERE id = 1`).all<{ key: string; value: string }>()
    .catch(() => ({ results: [] as { key: string; value: string }[] }))).results;
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (env.run) env.run.settings = s;
  return s;
}

/** The team's English words (an away message, a saved reply) in the client's language; as written
 *  when the AI is busy or the text holds numbers or emails (they are never sent for translation). */
async function inTheirWords(env: Env, lang: string | null, text: string) {
  if (!lang || lang === 'en' || redact(text) !== text) return text;
  const r = await chat<{ text: string }>(env, { system: translatePrompt(lang), user: text, schema: TEXT_SCHEMA, name: 'translate', prefer: writer(lang) });
  return r?.text.trim() || text;
}

/** Where a WhatsApp enquiry started: the site's buttons open WhatsApp with their own words. */
export function pageFrom(text: string, greeting = '') {
  if (greeting && text.trim() === greeting.trim()) return 'Site: WhatsApp button';            // Admin → Company's own words
  const topic = /i'd like to talk about (.+?)\.?\s*$/i.exec(text)?.[1];
  if (topic?.toLowerCase() === 'a project') return 'Site: WhatsApp button';
  if (topic && (prefilledService(text) || /^websites and web apps$/i.test(topic))) return `Site: ${clip(topic, 40)} page`;
  if (/a project like the ones on your site|examples of your work/i.test(text)) return 'Site: work page';
  if (/portfolio on your site/i.test(text)) return 'Site: team page';
  return 'WhatsApp (typed)';
}

/** Hot / warm / cold from the brief: how soon, how clear, how keen (a call, a person). */
export function leadScore(c: Pick<Contact, 'fields' | 'service'>): 'hot' | 'warm' | 'cold' {
  const f = c.fields, typed = f.timeline ?? '';
  // the buttons, or typed words that say soon (in English: the AI reads other languages into English)
  let n = typed === TIMELINES[0] || /asap|as soon|urgent|today|tomorrow|this week|next week|immediately|days?\b/i.test(typed) ? 2
    : typed && typed !== TIMELINES[2] && !/explor|not sure|no hurry|later/i.test(typed) ? 1 : 0;
  if ((f.need ?? '').length > 40) n++;
  if (shown(f.details)) n++;
  if (f.business) n++;
  if (f.call_at || f.person_at) n += 2;
  return n >= 5 ? 'hot' : n >= 3 ? 'warm' : 'cold';
}

/* ================================================================================ webhook */

type Ctx = Pick<ExecutionContext, 'waitUntil'>;

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/gateway') return req.method === 'POST' ? hello(req, env) : new Response('Method not allowed', { status: 405 });
    if (url.pathname !== '/webhook') return new Response('Not found', { status: 404 });
    if (req.method === 'GET') {
      const p = url.searchParams;
      return p.get('hub.mode') === 'subscribe' && env.WA_VERIFY_TOKEN && p.get('hub.verify_token') === env.WA_VERIFY_TOKEN
        ? new Response(p.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const raw = await req.arrayBuffer();
    if (!env.WA_APP_SECRET || !(await validSignature(env.WA_APP_SECRET, raw, req.headers.get('x-hub-signature-256')))) {
      ctx.waitUntil(beat(env, 'badsig'));                     // Admin → WhatsApp shows it: WA_APP_SECRET differs
      return new Response('Bad signature', { status: 401 });
    }
    ctx.waitUntil(beat(env, 'hook'));
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad JSON', { status: 400 }); }
    const rows = [...inbound(body, env), ...metaInbound(body, env, clock.now()).map((r): Msg => ({
      ...r, team: null, dir: 'in', ctx_id: null, profile: null, question_id: null, knowledge_id: null, handled_at: null,
    }))];
    if (!rows.length) return new Response('ok');               // delivery/read statuses: nothing to do
    const e = withRun(env);
    let fresh: Msg[];
    try {
      fresh = await sb<Msg>(e, 'POST', 'messages?on_conflict=wamid', rows, 'resolution=ignore-duplicates,return=representation');
    } catch (err) {
      console.error('[bot] could not store inbound messages; Meta will retry', String(err));
      ctx.waitUntil(beat(env, 'sbfail'));
      return new Response('Retry later', { status: 500 });
    }
    if (fresh.length) ctx.waitUntil(processFresh(e, fresh).catch((err) => console.error('[bot] turn failed', String(err))).finally(() => flushOut(e, clock.now())));
    return new Response('ok');
  },
  async scheduled(controller: { scheduledTime: number }, env: Env, ctx: Ctx) {
    ctx.waitUntil(tick(env, controller.scheduledTime || clock.now()).catch((e) => console.error('[bot] tick failed', String(e))));
  },
};

/** The WhatsApp Web gateway says where it is (on Render, or the laptop behind a fresh tunnel
 *  address), so nobody edits BAILEYS_URL: signed with WA_APP_SECRET like its webhooks, at most 5
 *  minutes old, https only. Kept in D1 bot_settings; io.ts gatewayBase reads it. */
async function hello(req: Request, env: Env): Promise<Response> {
  const raw = await req.arrayBuffer();
  if (raw.byteLength > 2000 || !env.WA_APP_SECRET || !(await validSignature(env.WA_APP_SECRET, raw, req.headers.get('x-hub-signature-256')))) {
    return new Response('Bad signature', { status: 401 });
  }
  let v: { url?: unknown; at?: unknown };
  try { v = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad JSON', { status: 400 }); }
  const now = clock.now();
  if (typeof v.at !== 'number' || Math.abs(now - v.at) > 5 * MIN) return new Response('Stale', { status: 401 });
  const address = typeof v.url === 'string' ? v.url.replace(/\/+$/, '') : '';
  if (address.length > 200 || !/^https:\/\/[a-z0-9.-]+(:\d{2,5})?(\/[\w./-]*)?$/i.test(address)) return new Response('Bad address', { status: 400 });
  const put = env.DB.prepare(`INSERT INTO bot_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  await env.DB.batch([put.bind('gateway_url', address), put.bind('gateway_seen', new Date(now).toISOString())]);
  forgetGateway();
  return Response.json({ ok: true });
}

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
      else if (['image', 'document', 'video', 'audio'].includes(m.type) && m[m.type]?.id) {
        // media:<kind>:<media id>[:<file name>]; a caption is the message text
        const f = m[m.type], kind = m.type === 'audio' && f.voice ? 'voice' : m.type;
        text = f.caption ?? null;
        reply = clip(`media:${kind}:${f.id}${f.filename ? `:${String(f.filename).replace(/[^\w.-]+/g, '_')}` : ''}`, 200);
      } else reply = `[${m.type ?? 'unknown'}]`;                  // sticker, location, contact…: "please type"
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
  // The worst text message: AI calls, a question and a complete-brief alert, each sent and stored
  // per team member, and the finished brief (its questions, the work list); 4 more for the commit
  // (lead, marks, contact, more?). A voice note or file only ever comes first, so it is not counted.
  const per = 23 + 4 * teamIds(env).size;           // + the roster (once a run), two pass-ons and the alert times
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
      if (pending.length && turn.c.mode !== 'stopped' && turn.c.mode !== 'blocked' && channelOf(waId) === 'whatsapp') void markRead(env, pending[pending.length - 1].wamid);
      // A flood blocks the chat (the team can undo it): 10 texts, or the same longer text 4 times,
      // sent within a minute. Photos, a backlog from our own delays and repeated STOPs never count.
      const newest = Date.parse(pending.at(-1)?.at ?? '');
      const burst = pending.filter((m) => m.body && Date.parse(m.at) >= newest - MIN);
      const same = new Map<string, number>();
      for (const m of burst) if (m.body!.length > 15 && !ACK.test(m.body!)) same.set(m.body!, (same.get(m.body!) ?? 0) + 1);
      const optOut = pending.some((m) => STOP.test((m.body ?? '').trim()));
      if (!optOut && (burst.length >= 10 || [...same.values()].some((n) => n >= 4))) await turn.block('a flood of messages', pending.at(-1)?.body ?? '');
      for (const m of pending) {
        // Always at least one message per turn; a file or voice note only as the first (it can take
        // long, and a turn cut off at 30 s would repeat everything handled before it).
        if (done.length && (!room(env, per + 4) || m.reply_id?.startsWith('media:'))) break;
        const snapshot = structuredClone(turn.c), mark = env.run?.out?.length ?? 0;
        try {
          await turn.handle(m); done.push(m);
          // the latest buttons this message got: a typed number or their words answer them next time
          const offered = (env.run?.out ?? []).slice(mark).filter((o) => o.to === waId && o.options?.length).at(-1);
          if (offered) turn.c.fields.opts = { step: turn.c.step, list: offered.options!.slice(0, 10) };
          if (turn.erased) break;                              // the rest of the batch was erased with it
        } catch (e) {
          Object.assign(turn.c, snapshot);                     // retried later from the state before it
          if (Date.parse(m.at) < now - 30 * MIN) {             // failing for half an hour: let it go (it would hold up the cron's retries)
            console.error('[bot] gave up on a message after 30 minutes of failures', m.wamid, String(e));
            done.push(m);
            continue;
          }
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
      fields: {}, alerted_at: null, busy_until: until, turns: 0, turns_day: null, last_in_at: iso(now), nudged_at: null,
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
/** The service's own question for any service but "Something else"; websites they like for sites and apps. */
/** A WhatsApp number (Indian numbers get 91) and an email from what they typed. Never sent to an AI. */
export function contactFrom(text: string): { phone?: string; email?: string } {
  const email = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(text)?.[0]?.toLowerCase();
  const asPhone = (d: string) => /^[6-9]\d{9}$/.test(d) ? `91${d}` : /^0[6-9]\d{9}$/.test(d) ? `91${d.slice(1)}` : /^[1-9]\d{10,14}$/.test(d) ? d : undefined;
  const phone = [...text.matchAll(/\+?\d[\d\s-]{7,16}\d/g)].map((m) => asPhone(m[0].replace(/\D/g, ''))).find(Boolean);
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

const applies = (c: Contact, f: Field) => f === 'contact' ? channelOf(c.wa_id) !== 'whatsapp' && !c.phone :
  f === 'details' ? !!c.service && c.service !== 'other' : f === 'refs' ? c.service === 'website' || c.service === 'app' : true;
const nextStep = (c: Contact): Step => FIELDS.find((f) => applies(c, f) && !c.fields[f]) ?? 'done';
/** A brief field as shown to the team ('-' = the client tapped Skip). */
const shown = (s?: string) => (s && s !== '-' ? s : '');
const WORK: Partial<Record<ServiceKey, string>> = { website: 'static', app: 'dynamic', quote: 'dynamic', whatsapp: 'whatsapp', n8n: 'n8n' };
/** File name in R2 from its type (what Admin → Leads offers to open or download). */
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
};
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Groq (which keeps no prompts) goes first, except for Malayalam and Kannada: Groq's models
 *  don't support them, so Gemini reads them first and is the only one that writes them (if it is
 *  busy, the client gets fixed text and the team is asked instead). */
const indic = (lang: string | null) => ['ml', 'mg', 'kn', 'kg', 'ta', 'tg'].includes(lang ?? '');   // Hindi and Hinglish: Groq writes them well
const reader = (lang: string | null, text: string): Provider[] =>
  indic(lang) || ['ml', 'kn', 'ta'].includes(scriptLang(text) ?? '') ? ['gemini', 'groq'] : ['groq', 'gemini'];
/** Whisper's language hint: a romanised style is spoken as its language. */
const SPOKEN: Partial<Record<Lang, string>> = { mg: 'ml', hg: 'hi', kg: 'kn', tg: 'ta' };
const langTitle = (l: Lang) => LANGS.find((x) => x.key === l)?.title ?? l;

/** A typed number ("2", "2.", "option 2") or an option's own words, as a tap on the bot's latest
 *  buttons at this step: the numbered fallback, or a client who types instead of tapping. Only
 *  for a real choice (2 or more options), so "1" answering "how many pages?" is never "Skip". */
const STEP_TAPS: Partial<Record<Step, string[]>> = { start: ['svc'], service: ['svc'], language: ['lang'], timeline: ['tl'], returning: ['ret'], details: ['skip'], refs: ['skip'], contact: ['skip'] };
function optionFor(c: Contact, text: string): Option | null {
  const o = c.fields.opts;
  if (!o || o.step !== c.step || !text || !o.list.length) return null;
  if (!(STEP_TAPS[c.step] ?? []).includes(o.list[0].id.split(':')[0])) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const n = /^(?:option\s*|no\.?\s*)?(\d{1,2})[.)]?$/i.exec(text.trim())?.[1];
  if (n) return o.list.length > 1 ? o.list[Number(n) - 1] ?? null : null;
  return o.list.find((x) => norm(x.title) === norm(text)) ?? null;
}
const writer = (lang: string | null): Provider[] => (indic(lang) ? ['gemini'] : ['groq', 'gemini']);

interface Extract {
  kind: 'answer' | 'question' | 'person' | 'off_topic' | 'unclear'; name: string; business: string; need_en: string; detail_en: string; timeline: string;
  question_en: string; commitment: boolean; price: boolean; mood: 'calm' | 'upset' | 'urgent'; abusive: boolean;
}
type Alert = 'complete' | 'person' | 'call' | 'upset' | 'urgent';
type How = 'wa' | 'ph' | 'meet';
const HOW: How[] = ['wa', 'ph', 'meet'];
const HOW_LABEL: Record<How, string> = { wa: 'WhatsApp call', ph: 'phone call', meet: 'Google Meet' };
/** "Thu, 16 Oct, 11:30 am" the client's way, India time. */
const slotFormat = (lang: string) => new Intl.DateTimeFormat(LOCALE[lang as Lang] ?? 'en-IN',
  { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const slotTime = (lang: string) => new Intl.DateTimeFormat(LOCALE[lang as Lang] ?? 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const slotDay = (lang: string) => new Intl.DateTimeFormat(LOCALE[lang as Lang] ?? 'en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' });
interface CallRow { id: number; wa_id: string; event_id: string | null; start_at: string; how: How; meet: string | null }

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
const brief = (c: Contact) => `Brief so far: ${serviceLabel(c)} · need: ${clip(c.fields.need || '-', 140)}${shown(c.fields.details) ? ` · details: ${clip(c.fields.details!, 100)}` : ''} · timeline: ${c.fields.timeline || '-'}`;

class Turn {
  constructor(readonly env: Env, readonly c: Contact, readonly now: number) {}
  private say(text: string) { return sendText(this.env, this.c.wa_id, text); }

  erased = false;
  private wamid = '';                                                      // the message being handled (questions key on it)
  private spoken = false;                                                  // ...a voice note's words (never switch the language)
  private at = 0;                                                          // ...and when the client sent it

  async handle(msg: Msg) {
    const c = this.c, lang = c.lang ?? 'en';
    this.spoken = false;
    const pick = msg.reply_id ? null : optionFor(c, (msg.body ?? '').trim());
    const m = pick ? { ...msg, reply_id: pick.id, body: pick.title } : msg;
    delete c.fields.opts;                                                   // any answer: the buttons are used up
    let text = (m.body ?? '').trim();
    const [kind, value, id, name] = (m.reply_id ?? '').split(':');
    this.wamid = m.wamid; this.at = Date.parse(m.at) || this.now;
    // A voice note becomes its words first (and is stored as them), so a spoken "delete my data"
    // or STOP works like a typed one. A blocked chat's audio never reaches the AI. If it can't be
    // understood, the recording is kept for the team instead.
    let file: 'saved' | 'big' | null = null;
    if (kind === 'media' && value === 'voice' && c.mode !== 'blocked') {
      const { heard, got } = await this.listen(id);
      if (heard) {
        text = heard;
        this.spoken = true;
        await sb(this.env, 'PATCH', `messages?wamid=eq.${q(m.wamid)}`, { body: clip(`🎤 ${heard}`, 4000) }, 'return=minimal');
      } else file = await this.keep('voice', id, undefined, got);
    }
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
    if (STOP.test(text)) { c.last_in_at = m.at; c.mode = 'stopped'; await this.say(t(c.lang, 'stopped')); return; }
    const askedForReview = !!c.review_at && Date.parse(c.review_at) > this.now - 30 * DAY;   // their reply to it is not a "return"
    const paused = (await settingsOf(this.env)).paused === '1';                         // (paused: everything goes to the team)
    if (!paused && Date.parse(c.last_in_at) < this.now - 30 * DAY && !askedForReview && this.welcomeBack()) {
      c.last_in_at = m.at;
      if (kind === 'media' && value !== 'voice') await this.keep(value, id, name);   // a photo sent first is still kept
      await sendButtons(this.env, c.wa_id, t(lang, 'welcomeBack'), TEXT[lang].retBtn.map((title, i) => ({ id: `ret:${i ? 'new' : 'same'}`, title })));
      return;
    }
    c.last_in_at = m.at;
    if (c.mode === 'stopped') c.mode = 'bot';                               // any later message restarts the chat
    if (kind === 'media' && value !== 'voice') file = await this.keep(value, id, name);
    if (c.quote_at && c.mode !== 'human' && !paused && Date.parse(m.at) >= Date.parse(c.quote_at)) {   // (a person on the chat, or the paused forward, has it anyway)
      // cleared only if no newer quote went out meanwhile (this turn's copy is left as it was)
      const [mine] = await sb(this.env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&quote_at=eq.${q(c.quote_at)}`, { quote_at: null });
      if (mine) await toTeam(this.env, this.now, `#${c.code} replied after the quote: "${clip(text || (file ? '📎 a file' : m.reply_id ?? ''), 300)}"`,
        { wa_id: c.wa_id }, (await route(this.env, this.now, c.service)).all);
    }
    if (c.step === 'start') {                                              // kept even when the bot is paused
      c.fields.page ??= channelOf(c.wa_id) === 'whatsapp' ? pageFrom(text, await greetingOf(this.env)) : CHANNEL_LABEL[channelOf(c.wa_id)];
    }
    if (c.mode === 'human' || paused) {
      // With a person on the chat (or the bot paused) the bot stays quiet and forwards: to whoever
      // took it, or to the whole team while nobody has (an upset or urgent client waiting for anyone).
      const team = new Set((await roster(this.env, this.now)).map((m) => m.id));
      if (c.taken_by && !team.has(c.taken_by)) c.taken_by = null;           // that person left the team
      const to = c.taken_by ? [c.taken_by] : (await route(this.env, this.now, c.service)).all;   // nobody who is off
      const what = value === 'voice' ? 'a voice note' : 'a file';
      const said = kind !== 'media' ? text || m.reply_id : value === 'voice' && text ? `🎤 ${text}`
        : `📎 sent ${what}${file === 'saved' ? ' (Admin → Leads)' : ' I could not save (too big or unavailable): ask for a link'}${text ? `: ${text}` : ''}`;
      const reached = to.length ? await toTeam(this.env, this.now, `#${c.code}${paused && c.mode !== 'human' ? ' (bot paused)' : ''} ${who(c)}: ${said}`, { wa_id: c.wa_id }, to) : 0;
      if (paused && (c.mode !== 'human' || !reached)) {                     // (a taker nobody could reach: the away message too)
        // the away message (Admin → WhatsApp → Settings) once every 12 hours, in their language
        const away = (await settingsOf(this.env)).away;
        if (away && (!c.fields.away_at || Date.parse(c.fields.away_at) < this.now - 12 * HOUR)) {
          c.fields.away_at = iso(this.now);
          await this.say(await inTheirWords(this.env, c.lang, away));
        }
        if (reached || away) return;                                         // nobody and no away message: the bot answers after all
        if (c.mode === 'human') { c.mode = 'bot'; c.taken_by = null; }
      } else if (reached) return;
      if (c.mode === 'human') { c.mode = 'bot'; c.taken_by = null; }         // nobody could be reached: the bot carries on
    }
    if (file && value === 'voice' && !text) { await this.say(t(c.lang, 'pleaseType')); return; }   // (the recording is kept for the team)
    if (file) {
      // One "saved" notice a minute (an album arrives as many messages); "not saved" every time.
      const quiet = file === 'saved' && !!c.fields.file_ack_at && Date.parse(c.fields.file_ack_at) > this.now - MIN;
      if (file === 'saved') c.fields.file_ack_at = iso(this.now);
      if (!text) {
        if (quiet) return;
        if (c.step === 'start') c.step = 'service';
        await this.ask('', t(c.lang, file === 'saved' ? 'fileSaved' : 'fileBig'));
        return;
      }
      if (file === 'big') await this.say(t(c.lang, 'fileBig'));                // then the caption is read as a message
    }
    if (!text) { await this.say(t(c.lang, 'pleaseType')); return; }

    // Typed commands, in their language: change the language, the menu, back, cancel, a person.
    if (!m.reply_id) {
      if (LANG_ASK.test(text)) {
        if (c.step !== 'language') c.fields.resume = c.step === 'start' ? 'service' : c.step;
        c.step = 'language';
        await this.ask();
        return;
      }
      if (MENU_ASK.test(text)) { if (c.step === 'done' || c.step === 'returning') c.fields.resume = c.step; c.step = 'service'; await this.ask(); return; }
      if (BACK_ASK.test(text) && (c.step === 'language' || (FIELDS as string[]).includes(c.step))) { await this.back(); return; }
      // only while the brief is being asked, and never over a call or a quote (that "cancel" is for the team)
      if (CANCEL_ASK.test(text) && ['service', 'language', ...FIELDS].includes(c.step) && !c.fields.call_at && !c.quote_at) {
        this.restart(); await this.say(t(c.lang, 'cancelled')); return;
      }
      if (PERSON_ASK.test(text)) {
        if (!c.fields.person_at || Date.parse(c.fields.person_at) < this.now - DAY) { c.fields.person_at = iso(this.now); await this.alertTeam('person', text); }
        await this.say(t(c.lang, 'person'));
        return;
      }
    }

    // Taps work at any step (an old menu tapped later just updates the answer).
    if (['ret', 'call', 'how', 'slot'].includes(kind) && c.step === 'start') { c.step = 'service'; await this.ask(text); return; }   // an old button on a fresh chat
    if (kind === 'ret') {
      if (c.step !== 'returning') { await this.ask(); return; }            // an old welcome-back button: ignore it
      if (value === 'new') { this.restart(); c.step = 'service'; await this.ask(text); return; }
      // a brief the team already has stays done (one from before the newer questions included)
      c.step = !c.lang ? 'language' : c.alerted_at ? 'done' : nextStep(c);
      if (c.step === 'done') await this.say(t(c.lang, 'sameProject')); else await this.ask();
      return;
    }
    if (kind === 'call') {
      if (value !== 'y') { await this.ask('', t(c.lang, 'keepGoing')); return; }
      if (!c.fields.call_at || Date.parse(c.fields.call_at) < this.now - DAY) {   // the team hears at once (once a day)
        c.fields.call_at = iso(this.now);
        await this.alertTeam('call');
      }
      if (!c.phone) {                                                        // no number to call (a username): Google Meet
        c.fields.call_how = 'meet';
        if (!(await this.offerSlots())) await this.callByTeam();
        return;
      }
      const asked = await sendButtons(this.env, c.wa_id, t(lang, 'howAsk'), TEXT[lang].howBtn.map((title, i) => ({ id: `how:${HOW[i]}`, title })));
      if (!asked) await this.say(t(c.lang, 'callSoon'));
      return;
    }
    if (kind === 'how' && (HOW as string[]).includes(value)) {
      c.fields.call_how = c.phone ? value as How : 'meet';
      if (!(await this.offerSlots())) await this.callByTeam();
      return;
    }
    if (kind === 'slot') {
      if (!c.fields.call_how) await this.callByTeam();
      else if (value === 'other') await this.otherTime();
      else await this.book(Number(value) * MIN);
      return;
    }
    if (kind === 'svc' && serviceByKey(value)) {
      if (value !== c.service) { delete c.fields.details; delete c.fields.refs; }   // the new service's own questions
      c.service = value as ServiceKey;
      if (c.step === 'start' || c.step === 'service') { await this.toLanguage(); return; }
      else if ((FIELDS as string[]).includes(c.step)) { await this.advance(''); return; }   // the questions follow the new service
      await this.ask();
      return;
    }
    if (kind === 'skip') {
      if (!(FIELDS as string[]).includes(c.step)) {                         // an old Skip outside the brief
        if (c.step === 'start') c.step = 'service';
        await this.ask(text);
        return;
      }
      if ((value === 'details' || value === 'refs' || value === 'contact') && !c.fields[value]) c.fields[value] = '-';
      await this.advance('');
      return;
    }
    // A second timeline tap (or one at another step) is not an answer to the current question.
    if (kind === 'tl' && c.step !== 'done' && (!TIMELINES[Number(value)] || c.fields.timeline)) { await this.ask(); return; }
    if (kind === 'lang' && LANGS.some((l) => l.key === value)) {
      c.lang = value as Lang;
      c.fields.lang_auto = false;                                          // their choice: kept, whatever they type later
      if (c.step === 'language' && c.fields.resume) { c.step = c.fields.resume; delete c.fields.resume; }
      else if (c.step === 'start' || c.step === 'service' || c.step === 'language') c.step = nextStep(c);
      await this.ask();
      return;
    }
    if (kind === 'tl' && TIMELINES[Number(value)] && !c.fields.timeline) { c.fields.timeline = TIMELINES[Number(value)]; await this.advance(''); return; }

    switch (c.step) {
      case 'start': {
        const pre = prefilledService(text), site = !!pre || /^hi legit forge/i.test(text);   // the site's own words say nothing of theirs
        const guess = site ? undefined : guessLang(text);
        if (guess) c.fields.lang_guess = guess;
        if (pre) { c.service = pre; await this.toLanguage(); return; }
        if (!ACK.test(text) && !site) c.fields.notes = join(c.fields.notes, text);
        if (!site && PRICE_ASK.test(text)) c.fields.price_asked = clip(text, 300);
        // "Enikku oru website venam": the service is clear, so no menu (and no language list if that is clear too)
        const said = !site && words(text) >= 3 ? clearService(text) : undefined;
        if (said) { c.service = said; await this.toLanguage(true); return; }
        c.step = 'service';
        await this.ask(text);
        return;
      }
      case 'service': {
        if (ACK.test(text)) { await this.ask(text); return; }             // a second "hello": the menu again
        const guess = guessLang(text);
        if (guess && !c.lang) c.fields.lang_guess = guess;
        if (c.fields.resume === 'done' && serviceFromText(text) === 'other') {   // "menu" after the brief, then a question
          c.step = 'done'; delete c.fields.resume;
          await this.field(text);
          return;
        }
        c.service = serviceFromText(text);
        if (c.service === 'other' || words(text) > 3) c.fields.notes = join(c.fields.notes, text);
        await this.toLanguage();
        return;
      }
      case 'language':
        c.lang = langFromText(text);
        c.fields.lang_auto = false;
        if (words(text) > 3) c.fields.notes = join(c.fields.notes, text);
        c.step = c.fields.resume ?? nextStep(c);
        delete c.fields.resume;
        await this.ask();
        return;
      case 'returning':                                                     // typed instead of tapped: the same project
        c.step = !c.lang ? 'language' : c.alerted_at ? 'done' : nextStep(c);
        if (c.step === 'language') await this.ask(); else await this.field(text);
        return;
      default:
        await this.field(text);
    }
  }

  /** After the service: their language, unless their own words already showed it (then one line
   *  on how to change it), or they chose one before. `noted`: their first message went to the team. */
  private async toLanguage(noted = false) {
    const c = this.c, lines: string[] = [];
    if (!c.lang && c.fields.lang_guess) {
      c.lang = c.fields.lang_guess;
      c.fields.lang_auto = true;
      lines.push(fill(t(c.lang, 'langSet'), { lang: langTitle(c.lang) }));
    }
    delete c.fields.lang_guess;
    if (!c.lang) { c.step = 'language'; await this.ask(); return; }
    if (noted && c.fields.notes) lines.unshift(t(c.lang, 'noted'));
    delete c.fields.resume;
    c.step = nextStep(c);
    if (c.step === 'done') { await this.say([...lines, t(c.lang, 'sameProject')].join('\n')); return; }   // nothing left to ask
    await this.ask('', lines.join('\n'));
  }

  /** "back": the question before this one again, its answer cleared (from the first, the language list). */
  private async back() {
    const c = this.c;
    if (c.step === 'language') c.step = 'service';
    else {
      const prev = FIELDS.slice(0, FIELDS.indexOf(c.step as Field)).reverse().find((f) => applies(c, f));
      if (prev) { delete c.fields[prev]; c.step = prev; } else c.step = 'language';
    }
    await this.ask();
  }

  /** A detected language follows how they write: two clear messages in a row in another one switch it. */
  private async follow(text: string) {
    const c = this.c;
    if (!c.fields.lang_auto || this.spoken || words(text) < 3) return;
    const guess = guessLang(text);
    if (!guess || guess === c.lang) { delete c.fields.lang_next; return; }
    if (c.fields.lang_next !== guess) { c.fields.lang_next = guess; return; }
    c.lang = guess;
    delete c.fields.lang_next;
    await this.say(fill(t(guess, 'langSet'), { lang: langTitle(guess) }));
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
    // the team is told only if it has something of theirs (an alert or a question on its phones)
    const told = !!c.alerted_at || (await sb(this.env, 'GET', `messages?wa_id=eq.${q(c.wa_id)}&team=not.is.null&select=wamid&limit=1`)).length > 0;
    count(this.env);
    await this.env.DB.prepare(`DELETE FROM leads WHERE source = 'whatsapp' AND (id IN (${ids.map(() => '?').join(',')}) OR (phone IS NOT NULL AND phone = ?))`)
      .bind(...ids, c.phone && channelOf(c.wa_id) === 'whatsapp' ? `+${c.phone}` : null).run();   // a typed number is not proof it is theirs
    const theirs = await sb<Question>(this.env, 'GET', `questions?wa_id=eq.${q(c.wa_id)}&select=id`);
    if (theirs.length) await sb(this.env, 'DELETE', `knowledge?status=eq.pending&question_id=in.(${theirs.map((x) => x.id).join(',')})`, undefined, 'return=minimal');
    await sb(this.env, 'DELETE', `questions?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    for (const id of ids) await dropFiles(this.env, `leads/${id}/`);
    const stuck: number[] = [];                                             // calendar events Google would not delete
    for (const call of await sb<CallRow>(this.env, 'GET', `calls?wa_id=eq.${q(c.wa_id)}&select=id,event_id,start_at`)) {
      if (call.event_id && !(await cancelCall(this.env, call.event_id))) stuck.push(Date.parse(call.start_at));
    }
    await sb(this.env, 'DELETE', `calls?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    if (c.mode === 'blocked') {
      Object.assign(c, { profile_name: null, lead_id: crypto.randomUUID(), lead_saved: true, step: 'start', taken_by: null, lang: null, service: null, fields: {}, alerted_at: null,
        quote_at: null, review_at: null, referred_at: null, revived_at: null, pay_at: null });
    } else {
      await sb(this.env, 'DELETE', `contacts?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    }
    await sb(this.env, 'DELETE', `alerts?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');      // (a blocked record keeps its row)
    await sb(this.env, 'DELETE', `messages?wa_id=eq.${q(c.wa_id)}`, undefined, 'return=minimal');
    this.erased = true;
    this.env.run?.gone?.add(c.wa_id);
    c.lead_saved = true;                                                    // nothing re-creates the lead this turn
    if (told || stuck.length) {
      await toTeam(this.env, this.now, `#${c.code} asked to delete their data. Their chat, details and WhatsApp leads are erased; please also delete #${c.code}'s messages in your own WhatsApp`
        + (channelOf(c.wa_id) === 'fb' || channelOf(c.wa_id) === 'ig' ? ` and the conversation in the Page's ${CHANNEL_LABEL[channelOf(c.wa_id)]} inbox.` : '.')
        + (stuck.length ? ` Also delete the call on the calendar at ${stuck.map(istTime).join(', ')} (Google did not let me).` : ''), {});
    }
    await this.say(channelOf(c.wa_id) === 'fb' || channelOf(c.wa_id) === 'ig' ? `${t(c.lang, 'deleted')} ${t(c.lang, 'deletedInbox')}` : t(c.lang, 'deleted'));
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
      fields: { ...(prev.length ? { prev_leads: prev } : {}), since: iso(this.now),
        ...(channelOf(this.c.wa_id) !== 'whatsapp' ? { page: CHANNEL_LABEL[channelOf(this.c.wa_id)] } : {}) }, alerted_at: null, nudged_at: null,
      quote_at: null, revived_at: null,                                     // a review request is once per client
    });
  }

  /** Whatever the current step asks (with anything said first). `seen` picks the menu's language
   *  before the client has chosen one. */
  private async ask(seen = '', prefix = '') {
    const c = this.c, lang = c.lang ?? 'en', lead = prefix ? `${prefix}\n\n` : '';
    switch (c.step) {
      case 'start': case 'service': {
        const l = c.lang ?? c.fields.lang_guess ?? (seen ? guessLang(seen) : undefined);
        if (prefix) await this.say(prefix);
        await sendList(this.env, c.wa_id, t(l, 'welcome'), t(l, 'menu'),
          SERVICES.map((s) => ({ id: `svc:${s.key}`, title: s.title, description: s.description })), footer(this.env));
        return;
      }
      case 'language':
        if (prefix) await this.say(prefix);
        await sendList(this.env, c.wa_id, LANG_PROMPT, 'Language', LANGS.map((l) => ({ id: `lang:${l.key}`, title: l.title })), footer(this.env));
        return;
      case 'done':
        if (prefix) await this.say(prefix);
        return;
      case 'returning':                                                     // (again after "language")
        if (prefix) await this.say(prefix);
        await sendButtons(this.env, c.wa_id, t(lang, 'welcomeBack'), TEXT[lang].retBtn.map((title, i) => ({ id: `ret:${i ? 'new' : 'same'}`, title })));
        return;
      case 'timeline':
        await sendButtons(this.env, c.wa_id, lead + TEXT[lang].timeline, TEXT[lang].tl.map((title, i) => ({ id: `tl:${i}`, title })));
        return;
      case 'details': case 'refs': case 'contact': {
        const asked = c.step === 'contact' ? t(lang, 'contact') : c.step === 'refs' ? t(lang, 'refs') : DETAILS[lang][c.service as Exclude<ServiceKey, 'other'>];
        await sendButtons(this.env, c.wa_id, lead + asked, [{ id: `skip:${c.step}`, title: t(lang, 'skip') }]);
        return;
      }
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
      if (c.fields.price_asked && !c.fields.call_at) {                    // they asked the price first: the call offer now
        delete c.fields.price_asked;
        await sendButtons(this.env, c.wa_id, t(c.lang, 'price'), TEXT[c.lang ?? 'en'].callBtn.map((title, i) => ({ id: `call:${i ? 'n' : 'y'}`, title })));
      }
      await this.showWork().catch((e) => console.error('[bot] work list failed', String(e)));
      return;
    }
    await this.ask('', prefix);
  }

  /** A typed answer to name / business / need / timeline, or anything after the brief is done. */
  private async field(text: string) {
    await this.follow(text);
    const c = this.c, step = c.step as Field | 'done', lang = c.lang ?? 'en';
    if (step === 'contact') {                                              // read here: a number or email never goes to an AI
      const got = contactFrom(text);
      if (got.phone) c.phone = got.phone;
      if (got.email) c.fields.email = got.email;
      if (!got.phone && !got.email && !c.fields.contact_tries) { c.fields.contact_tries = 1; await this.ask('', t(lang, 'contactBad')); return; }
      c.fields.contact = got.phone || got.email ? [got.phone && `+${got.phone}`, got.email].filter(Boolean).join(' · ') : clip(text, 120);
      await this.advance('');
      return;
    }
    const before = JSON.stringify(FIELDS.map((f) => c.fields[f]));
    const asked = step === 'details' && c.service && c.service !== 'other' ? DETAILS.en[c.service] : undefined;
    const x = await this.ai<Extract>({ system: extractPrompt(step, asked), user: text, schema: EXTRACT_SCHEMA, name: 'extract' }, reader(c.lang, text));
    let prefix = '';
    if (x) {
      if (x.name && !c.fields.name) c.fields.name = clip(x.name, 80);
      if (x.business && !c.fields.business) c.fields.business = clip(x.business, 200);
      if (x.need_en && step !== 'details' && step !== 'refs') c.fields.need = join(c.fields.need, x.need_en, 1000);
      if (x.timeline && !c.fields.timeline) c.fields.timeline = clip(x.timeline, 120);
      if (x.detail_en && (step === 'details' || step === 'refs') && !c.fields[step]) c.fields[step] = clip(x.detail_en, 600);
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
        if (step !== 'done') {
          c.step = nextStep(c);
          if (c.step === 'done') { await this.alertTeam('complete'); await this.showWork().catch((e) => console.error('[bot] work list failed', String(e))); }
        }
        return;
      }
      if (x.kind === 'unclear') {
        // Not understood: ask them once, in their own style; a second time, the team reads it (and
        // can teach the bot the words: "phrase mg: … = …"), and their answer is learned as usual.
        if (!c.fields.unclear) { c.fields.unclear = 1; await this.say(t(lang, 'unclear')); return; }
        delete c.fields.unclear;
        await this.escalate(text, `Not understood (twice): "${clip(text, 300)}". What do they mean, and what should we reply?`, { kind: 'question' });
        prefix = t(lang, 'checking');
      } else delete c.fields.unclear;
      if (x.kind === 'question' && x.question_en) prefix = await this.answerOrAsk(text, x.question_en, x.commitment);
      else if (x.kind === 'person') { c.fields.person_at = iso(this.now); await this.alertTeam('person'); prefix = t(lang, 'person'); }
      else if (x.kind === 'off_topic') prefix = t(lang, 'offTopic');
    }
    const plain = (!x || x.kind === 'answer') && !ACK.test(text);
    const filled = JSON.stringify(FIELDS.map((f) => c.fields[f])) !== before;
    // With no AI (or when it found nothing), the message answers the question we asked.
    // ...also at the service question and websites, even when it filled something else too
    const own = step === 'details' || step === 'refs';
    if (plain && (!filled || own) && step !== 'done' && !c.fields[step]) c.fields[step] = clip(text, step === 'need' ? 1000 : own ? 600 : 200);
    if (step === 'done') {
      if (plain) { c.fields.notes = join(c.fields.notes, text); prefix ||= t(lang, 'noted'); }
      if (!c.alerted_at) await this.alertTeam('complete');                  // an earlier alert that didn't go out
      if (prefix) await this.say(prefix);
      await this.refer().catch((e) => console.error('[bot] referral not sent', String(e)));
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
      client_told_at: o.kind === 'price' ? iso(this.now) : null,
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
    const sent = await alertTurns(this.env, this.now, { wa_id: c.wa_id, question_id: question.id, service: c.service }, body,
      { wa_id: c.wa_id, question_id: question.id },
      o.draft ? [{ id: `dr:s:${question.id}`, title: 'Send' }, { id: `dr:w:${question.id}`, title: 'Write my own' }] : undefined);
    if (!sent) console.error(`[bot] question #${c.code} reached no team member (TEAM_WHATSAPP, template?)`);
    else await this.alerted();
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

  /** Free half hours from the team's calendar as a list (and "Another time"); false when there is
   *  no calendar, no free time, or the list could not be sent (the team arranges it then). The
   *  time is the row's title (24 characters in every language), the weekday its description. */
  private async offerSlots(prefix = '') {
    const c = this.c, lang = c.lang ?? 'en';
    if (!calendarOn(this.env)) return false;
    const slots = await freeSlots(this.env, this.now);
    if (!slots?.length) return false;
    const time = slotTime(lang), day = slotDay(lang);
    return !!(await sendList(this.env, c.wa_id, (prefix ? `${prefix}\n\n` : '') + t(lang, 'slotAsk'), t(lang, 'slotBtn'), [
      ...slots.map((ms) => ({ id: `slot:${Math.round(ms / MIN)}`, title: clip(time.format(new Date(ms)), 24), description: clip(day.format(new Date(ms)), 72) })),
      { id: 'slot:other', title: t(lang, 'otherTime') },
    ]));
  }

  /** No calendar, no free time, "Another time" or a refused booking: the team arranges the call.
   *  (They were alerted when the client said yes; this says how, and anything to know.) */
  private async callByTeam(note = '') {
    const c = this.c, how = c.fields.call_how;
    if (note || !c.fields.arrange_at || Date.parse(c.fields.arrange_at) < this.now - DAY) {   // once a day, unless there is news
      c.fields.arrange_at = iso(this.now);
      await toTeam(this.env, this.now, `#${c.code} 📞 ${who(c)} wants ${how ? `a ${HOW_LABEL[how]}` : 'a call'}: please arrange the time with them.`
        + `${note ? ` ${note}` : ''}${c.phone ? `\nWhatsApp: wa.me/${c.phone}` : ''}`, { wa_id: c.wa_id }, (await route(this.env, this.now, c.service)).all);
    }
    await this.say(t(c.lang, 'callSoon'));
  }

  /** This client's future calls taken off the calendar (another time, or a newer booking), but
   *  not the one at `keep`; returns their times. */
  private async dropCalls(keep?: number) {
    const rows = await sb<CallRow>(this.env, 'GET', `calls?wa_id=eq.${q(this.c.wa_id)}&reminded=eq.false&start_at=gt.${iso(this.now)}&select=id,event_id,start_at`);
    const gone: number[] = [];
    for (const r of rows) {
      if (Date.parse(r.start_at) === keep) continue;
      if (r.event_id) await cancelCall(this.env, r.event_id);
      await sb(this.env, 'DELETE', `calls?id=eq.${r.id}`, undefined, 'return=minimal');
      gone.push(Date.parse(r.start_at));
    }
    return gone;
  }

  /** The chosen half hour: claimed in Supabase first (one call per half hour: two clients never
   *  share it), checked on the calendar and booked there, confirmed in their language with the
   *  way to join; a newer booking replaces an older one; the team is told. A double tap or a
   *  retried turn finds it already theirs and only confirms it again. */
  private async book(start: number) {
    const c = this.c, lang = c.lang ?? 'en', how = c.fields.call_how!;
    if (!(start > this.now + HOUR) || !offerable(start, this.now)) { if (!(await this.offerSlots())) await this.callByTeam(); return; }   // an old list
    const at = `calls?wa_id=eq.${q(c.wa_id)}&start_at=eq.${q(iso(start))}`;
    let [mine] = await sb<CallRow>(this.env, 'GET', `${at}&select=id,event_id,how,meet`);
    if (mine?.event_id) { await this.sayBooked(start, mine.how, mine.meet); return; }
    if (!mine) {
      [mine] = await sb<CallRow>(this.env, 'POST', 'calls?on_conflict=start_at', { wa_id: c.wa_id, start_at: iso(start), how }, 'resolution=ignore-duplicates,return=representation');
      if (!mine) { if (!(await this.offerSlots(t(lang, 'slotTaken')))) await this.callByTeam(); return; }   // another client has it
    }
    const ev = await bookCall(this.env, start, {
      title: `Call: ${who(c)} (#${c.code}) · ${HOW_LABEL[how]}`, meet: how === 'meet', key: `${c.code}-${start / MIN}-${mine.id}`,
      description: [brief(c), c.phone ? `WhatsApp: wa.me/${c.phone}` : '', `Language: ${langName(c.lang)}. Booked by the WhatsApp bot.`].filter(Boolean).join('\n'),
    });
    if (ev === 'taken' || !ev) {
      await sb(this.env, 'DELETE', `calls?id=eq.${mine.id}`, undefined, 'return=minimal');
      if (ev === 'taken') { if (!(await this.offerSlots(t(lang, 'slotTaken')))) await this.callByTeam(); }
      else await this.callByTeam(`They chose ${istTime(start)}, but the calendar did not take it.`);
      return;
    }
    await sb(this.env, 'PATCH', `calls?id=eq.${mine.id}`, { event_id: ev.id, meet: ev.meet, how }, 'return=minimal');
    const replaced = await this.dropCalls(start);
    await this.sayBooked(start, how, ev.meet);
    await this.saveLead();
    await toTeam(this.env, this.now, [`#${c.code} 📅 call booked: ${istTime(start)} · ${HOW_LABEL[how]}`, `Name: ${who(c)}`,
      c.phone ? `WhatsApp: wa.me/${c.phone}` : '', ev.meet ? `Meet: ${ev.meet}` : how === 'meet' ? 'No Meet link was made: please send them one.' : '',
      replaced.length ? `(Instead of ${replaced.map(istTime).join(', ')}: taken off the calendar.)` : '',
      ev.link ? `Calendar: ${ev.link}` : ''].filter(Boolean).join('\n'), { wa_id: c.wa_id }, (await route(this.env, this.now, c.service)).all);
  }

  private async sayBooked(start: number, how: How, meet: string | null) {
    const lang = this.c.lang ?? 'en';
    const join = how === 'meet' ? (meet ? fill(t(lang, 'howMeet'), { link: meet }) : t(lang, 'meetLater')) : t(lang, how === 'wa' ? 'howWa' : 'howPhone');
    await this.say(`${fill(t(lang, 'booked'), { time: slotFormat(lang).format(new Date(start)) })}\n${join}`);
  }

  /** "Another time": the team arranges it, and a time they had booked comes off the calendar. */
  private async otherTime() {
    const was = await this.dropCalls();
    await this.callByTeam(was.length ? `They want another time instead of ${was.map(istTime).join(', ')} (taken off the calendar).` : '');
  }

  /** After a Google review request, their next ordinary message gets one referral ask (only when
   *  Admin → Company has the WhatsApp number to share). */
  async refer() {
    const c = this.c;
    if (!c.review_at || c.referred_at || c.mode !== 'bot') return;
    const link = await shareLink(this.env);
    if (!link) return;
    c.referred_at = iso(this.now);
    await this.say(fill(t(c.lang, 'referral'), { link }));
  }

  /** One more AI call within the client's daily cap (and this invocation's budget)? */
  private allow() {
    const c = this.c, today = iso(this.now).slice(0, 10);
    if (c.turns_day !== today) { c.turns_day = today; c.turns = 0; }
    if (c.turns >= AI_PER_DAY || !room(this.env, 14)) return false;
    c.turns++;
    return true;
  }

  /** AI with a daily cap per client; null means "use the fixed path". */
  private async ai<T>(o: { system: string; user: string; schema: Parameters<typeof chat>[1]['schema']; name: string }, prefer: Provider[]) {
    if (!this.allow()) return null;
    return chat<T>(this.env, { ...o, system: o.system + glossary(o.user, await phrasesOf(this.env)), prefer });
  }

  /** A voice note's words (Groq Whisper, hinted with their language), and the recording itself. */
  private async listen(id: string) {
    if (!this.allow()) return { heard: null, got: undefined };
    const got = await media(this.env, id, VOICE_MAX);
    if (!got || got === 'big' || got === 'retry') return { heard: null, got: undefined };
    return { heard: await transcribe(this.env, got.bytes, got.type, (this.c.lang && SPOKEN[this.c.lang]) ?? this.c.lang ?? undefined), got };
  }

  /** A photo, document, video, audio file or voice note, kept privately for the team under this
   *  enquiry. 'big' when it can't be kept (too big, too many, unavailable, the lead was deleted). */
  private async keep(kind: string, id: string, name?: string, had?: { bytes: ArrayBuffer; type: string }): Promise<'saved' | 'big' | null> {
    const c = this.c, files = c.fields.files ?? [];
    if (!this.env.MEDIA) return null;
    if (files.length >= FILES_MAX || c.fields.lead_gone) return 'big';
    const got = had ?? await media(this.env, id, FILE_MAX);
    if (got === 'retry') {
      // Meta busy: the message is retried by the cron (media ids last 30 days), for half an hour
      if (this.now - this.at < 30 * MIN) throw new Error('media not available yet');
      return 'big';
    }
    if (!got || got === 'big') return 'big';
    const type = got.type.split(';')[0].trim().toLowerCase();
    const base = (name ?? kind).replace(/\.[\w]{1,5}$/, '').slice(0, 60) || kind;
    // the media id makes the key its own: a retried message rewrites the same file, never another
    const key = `leads/${c.lead_id}/${files.length + 1}-${id.replace(/[^\w-]/g, '').slice(-8)}-${base}.${EXT[type] ?? /\.([\w]{1,5})$/.exec(name ?? '')?.[1] ?? 'bin'}`;
    if (files.includes(key)) return 'saved';
    count(this.env);
    await this.env.MEDIA.put(key, got.bytes, { httpMetadata: { contentType: type } });
    c.fields.files = [...files, key];
    return 'saved';
  }

  /** 2-3 published projects for their service (Admin → Projects), after the brief is done. */
  private async showWork() {
    const c = this.c, category = c.service && WORK[c.service];
    if (!category) return;
    count(this.env);
    const { results } = await this.env.DB.prepare(
      'SELECT slug, title, client_type FROM projects WHERE is_published = 1 AND category = ? ORDER BY is_featured DESC, sort_order LIMIT 10',
    ).bind(category).all<{ slug: string; title: string; client_type: string }>();
    const real = results.filter((p) => !/\[[^\]]+\]/.test(p.title)).slice(0, 3);   // never a [placeholder]
    if (!real.length) return;
    await this.say([t(c.lang, 'work'), ...real.map((p) => `• ${p.title}${p.client_type && !/\[[^\]]+\]/.test(p.client_type) ? ` (${p.client_type})` : ''}: https://${host(this.env)}/work/${p.slug}`)].join('\n'));
  }

  /** The one-page English brief on the lead (Admin → Leads) once the brief is complete. */
  private async briefDoc() {
    const c = this.c, f = c.fields, line = (label: string, v?: string) => `${label}: ${shown(v) || '-'}`;
    const asked = (await sb<Question>(this.env, 'GET', `questions?wa_id=eq.${q(c.wa_id)}${f.since ? `&created_at=gte.${q(f.since)}` : ''}`
      + '&order=created_at.desc&limit=10&select=question_en,status').catch(() => [] as Question[])).reverse();
    const doc = [
      `Enquiry brief #${c.code} · ${iso(this.now).slice(0, 10)} · ${CHANNEL_LABEL[channelOf(c.wa_id)]} · ${langName(c.lang)}`, '',
      line('Client', f.name || c.profile_name || undefined), line('Business', f.business), line('Service', serviceLabel(c)), '',
      line('What they need', f.need),
      ...(applies(c, 'details') ? [line('Details', f.details)] : []),
      ...(applies(c, 'refs') ? [line('Websites they like', f.refs)] : []),
      line('Timeline', f.timeline),
      ...(applies(c, 'contact') || f.contact ? [line('Contact', f.contact)] : []),
      ...(f.files?.length ? [`Files: ${f.files.length} (listed below)`] : []),
      ...(asked.length ? ['', 'Questions they asked:', ...asked.map((x) => `- ${clip(x.question_en, 200)} (${x.status})`)] : []),
      ...(f.notes ? ['', line('Notes', clip(f.notes, 600))] : []),
    ].join('\n');
    if (!c.lang || c.lang === 'en') return doc;
    // Answers the AI could not read stay in the client's words: one translation makes it English.
    // The contact line (a number, an email) is left out and put back: redact() would blank it.
    const contact = doc.split('\n').find((l) => l.startsWith('Contact: ')), rest = contact ? doc.replace(`${contact}\n`, '') : doc;
    const r = await this.ai<{ text: string }>({ system: BRIEF_PROMPT, user: rest, schema: TEXT_SCHEMA, name: 'translate' }, reader(c.lang, rest));
    return r?.text.trim() ? `${r.text.trim()}${contact ? `\n${contact}` : ''}` : doc;
  }

  private async alertTeam(why: Alert, said = '') {
    const c = this.c;
    if (why === 'complete' && c.alerted_at) return 1;
    await this.saveLead(why === 'complete' ? await this.briefDoc() : undefined);   // stored before its notification
    const f = c.fields, hot = leadScore(c) === 'hot', urgent = why === 'upset' || why === 'urgent';
    const everyone = urgent || (why !== 'call' && hot);                      // hot leads: everyone at once (the bot carries on)
    const sent = await alertTurns(this.env, this.now, { wa_id: c.wa_id, service: c.service }, [
      `#${c.code} ${hot ? '🔥 ' : ''}${ALERT_HEAD[why]}`,
      `Name: ${f.name || c.profile_name || '-'}`, `Business: ${f.business || '-'}`, `Service: ${serviceLabel(c)}`,
      c.phone ? `${channelOf(c.wa_id) === 'whatsapp' ? '' : `${CHANNEL_LABEL[channelOf(c.wa_id)]} · `}WhatsApp: wa.me/${c.phone}`
        : channelOf(c.wa_id) === 'whatsapp' ? 'WhatsApp: no phone number shared (username)'
        : `${CHANNEL_LABEL[channelOf(c.wa_id)]}: no phone number (reply to this message: the bot passes it on)`,
      ...(f.email ? [`Email: ${f.email}`] : []),
      ...(said ? [`Message: "${clip(said, 300)}"`] : []),
      `Timeline: ${f.timeline || '-'}`, `Language: ${langName(c.lang)}`,
      ...(f.files?.length ? [`Files: ${f.files.length} (Admin → Leads)`] : []),
      ...(why === 'call' && f.call_how ? [`Call: ${HOW_LABEL[f.call_how]}`] : []),
      `Need: ${clip(f.need || '-', 400)}`,
      ...(shown(f.details) ? [`Details: ${clip(f.details!, 200)}`] : []), ...(shown(f.refs) ? [`Websites they like: ${clip(f.refs!, 200)}`] : []),
      ...(f.notes ? [`Notes: ${clip(f.notes, 300)}`] : []),
      `Full Record: https://${host(this.env)}/admin/leads`,
      '', urgent
        ? `The bot has stopped. Reply to this message to talk to them; "#${c.code} bot" hands back to the bot.`
        : 'Reply to this message to write to the client.',
    ].join('\n'), { wa_id: c.wa_id }, undefined, everyone);
    if (!sent) console.error(`[bot] lead #${c.code} reached no team member (TEAM_WHATSAPP, template?); retried on their next message`);
    else if (why === 'complete') c.alerted_at = iso(this.now);
    if (sent) await this.alerted();
    return sent;
  }

  /** The 2-hour promise is measured from the team's first alert about this enquiry (Admin → Leads). */
  private async alerted() {
    count(this.env);
    await this.env.DB.prepare(`UPDATE leads SET wa_alerted_at = COALESCE(wa_alerted_at, datetime('now')) WHERE id = ?`).bind(this.c.lead_id).run()
      .catch((e) => console.error('[bot] alert time not saved', String(e)));
  }

  /** The enquiry in the website's D1, where Admin → Leads reads it (same table as the form).
   *  Inserted once per enquiry; later turns only update it, so a lead deleted in the admin stays deleted. */
  async saveLead(doc?: string) {
    const c = this.c, f = c.fields;
    const message = [f.business && `Business: ${f.business}`, f.need && `Need: ${f.need}`, shown(f.details) && `Details: ${f.details}`,
      shown(f.refs) && `Websites they like: ${f.refs}`, f.timeline && `Timeline: ${f.timeline}`, f.email && `Email: ${f.email}`, f.notes && `Notes: ${f.notes}`]
      .filter(Boolean).join('\n') || null;
    const values = [f.name || c.profile_name || null, c.phone ? `+${c.phone}` : null, serviceByKey(c.service ?? '')?.lead ?? null, message,
      c.lang ? langName(c.lang) : null, f.files?.length ? JSON.stringify(f.files) : null, leadScore(c), f.page ?? null, doc ?? null];
    count(this.env);
    const r = await (c.lead_saved
      ? this.env.DB.prepare('UPDATE leads SET name = ?, phone = ?, service = ?, message = ?, language = ?, files = ?, score = ?, page = COALESCE(page, ?), brief = COALESCE(?, brief) WHERE id = ?').bind(...values, c.lead_id)
      : this.env.DB.prepare(`INSERT OR IGNORE INTO leads (name, phone, service, message, language, files, score, page, brief, id, source, whatsapp_consent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?)`).bind(...values, c.lead_id, channelOf(c.wa_id) === 'whatsapp' ? 1 : 0)).run();   // (consent: they wrote on WhatsApp)
    if (c.lead_saved && !r.meta.changes && !f.lead_gone) {
      // Deleted in Admin → Leads: it stays deleted, and files sent since go too (none are kept from now on).
      f.lead_gone = true;
      if (f.files?.length) { await dropFiles(this.env, `leads/${c.lead_id}/`); delete f.files; }
    }
    c.lead_saved = true;
  }
}

/* =================================================================================== team */

/** A message to team members (all by default), each checked against their 24-hour window:
 *  free-form when they wrote to the bot in the last 23 hours, else the approved template.
 *  Each copy is stored so a swipe-reply to it finds the client / question / answer it is about.
 *  Returns how many members it reached. */
async function toTeam(env: Env, now: number, text: string, link: { wa_id?: string; question_id?: number; knowledge_id?: number },
  members?: string[], buttons?: { id: string; title: string }[]) {
  const rst = await roster(env, now);
  const targetMembers = members ?? rst.map((m) => m.id);
  let sent = 0;
  const windows = targetMembers.length ? await openWindows(env, now, targetMembers) : new Set<string>();
  for (const member of targetMembers) {
    const open = windows.has(member);
    const code = /^#([A-Z0-9]{5})/.exec(text)?.[1] ?? '-';
    // Outside the 24-hour window only the template goes out (no buttons): a text reply still works.
    const id = !open ? await sendTemplate(env, member, 'team_alert', [code, text])
      : buttons ? await sendButtons(env, member, text, buttons) : await sendText(env, member, text);
    if (id) { sent++; if (link.wa_id || link.question_id || link.knowledge_id) await storeOut(env, now, id, member, text, link); }
  }
  return sent;
}

/** Team members who wrote to the bot in the last 23 hours (free-form messages reach them): one
 *  query per run. */
async function openWindows(env: Env, now: number, rosterList?: string[]) {
  if (env.run?.open) return env.run.open;
  const team = rosterList ?? (await roster(env, now)).map((m) => m.id);
  if (viaGateway(env)) return new Set(team);                // WhatsApp Web has no 24-hour window: always a plain message
  const rows = team.length ? await sb<{ team: string }>(env, 'GET', `messages?team=in.${q(`(${team.map((m) => `"${m}"`).join(',')})`)}`
    + `&dir=eq.in&at=gt.${iso(now - 23 * HOUR)}&select=team&order=at.desc&limit=500`) : [];
  const open = new Set(rows.map((r) => r.team));
  if (env.run) env.run.open = open;
  return open;
}

type Link = { wa_id?: string; question_id?: number; knowledge_id?: number };
type Button = { id: string; title: string };
interface Seat { id: string; name: string; services: string[]; status: 'free' | 'busy' | 'off'; until: string | null }
interface Pass { id: number; wa_id: string | null; lead_id: string | null; question_id: number | null; body: string; link: Link; buttons: Button[] | null; later: string[]; created_at: string }

/** The team as the bot routes it: TEAM_WHATSAPP with Admin → Team's names, services and status
 *  (D1 bot_team); a busy or off that has run out is free again. */
async function roster(env: Env, now: number): Promise<Seat[]> {
  if (env.run?.roster) return env.run.roster as Seat[];                     // once a run ("busy" clears it)
  count(env);
  const rows = (await env.DB.prepare('SELECT whatsapp, name, services, status, status_until FROM bot_team')
    .all<{ whatsapp: string; name: string; services: string; status: Seat['status']; status_until: string | null }>()
    .catch(() => ({ results: [] as never[] }))).results;                   // before migration 0013: everyone free
  const by = new Map(rows.map((r) => [r.whatsapp, r]));
  const allIds = new Set([...teamIds(env), ...rows.map((r) => r.whatsapp)]);
  const team: Seat[] = [...allIds].map((id) => {
    const r = by.get(id), over = !!r?.status_until && Date.parse(r.status_until) <= now;
    let services: string[] = [];
    try { const v: unknown = JSON.parse(r?.services ?? '[]'); if (Array.isArray(v)) services = v.map(String); } catch { /* none */ }
    return { id, name: r?.name || `+${id}`, services, status: !r || over ? 'free' : r.status, until: over ? null : r?.status_until ?? null };
  });
  if (env.run) env.run.roster = team;
  return team;
}

/** Who hears about a client first: free members who handle their service, then other free
 *  members, then busy ones; nobody who is off (unless everyone is). */
async function route(env: Env, now: number, service: string | null) {
  const team = await roster(env, now), on = team.filter((m) => m.status !== 'off'), pool = on.length ? on : team;
  const rank = (m: Seat) => (m.status === 'busy' ? 2 : 0) + (service && m.services.includes(service) ? 0 : 1);
  const best = Math.min(...pool.map(rank));
  return {
    all: pool.map((m) => m.id), first: pool.filter((m) => rank(m) === best).map((m) => m.id),
    later: pool.filter((m) => rank(m) !== best).sort((a, b) => rank(a) - rank(b)).map((m) => m.id),
  };
}

/** A client's alert in turns: the first members now, the rest 10 minutes later if nobody has
 *  taken it up (cron passOn()). Upset or urgent clients reach everyone at once. Returns how many got it. */
async function alertTurns(env: Env, now: number, about: { wa_id?: string; lead_id?: string; question_id?: number; service: string | null },
  text: string, link: Link, buttons?: Button[], urgent = false) {
  const r = await route(env, now, about.service);
  let later = urgent ? [] : r.later;
  let sent = await toTeam(env, now, text, link, urgent ? r.all : r.first, buttons);
  if (!sent && later.length) { sent = await toTeam(env, now, text, link, later, buttons); later = []; }   // the first could not be reached
  if (sent && later.length) {
    await sb(env, 'POST', 'alerts', {
      wa_id: about.wa_id ?? null, lead_id: about.lead_id ?? null, question_id: about.question_id ?? null,
      body: text, link, buttons: buttons ?? null, later, next_at: iso(now + 10 * MIN),
    }, 'return=minimal').catch((e) => console.error('[bot] pass-on not stored; the first members have it', String(e)));
  }
  return sent;
}

/** Alerts nobody took up in 10 minutes go to the rest of the team (unless they went off since). */
async function passOn(env: Env, now: number) {
  const due = await sb<Pass>(env, 'GET', `alerts?next_at=lt.${iso(now)}&order=next_at.asc&limit=5`);
  if (!due.length) return;
  const rst = await roster(env, now);
  const off = new Set(rst.filter((m) => m.status === 'off').map((m) => m.id)), team = new Set(rst.map((m) => m.id));
  for (const a of due) {
    if (!room(env, 3 * a.later.length + 6)) return;
    const [mine] = await sb(env, 'DELETE', `alerts?id=eq.${a.id}`);            // claimed by deleting: once, and nothing kept
    if (!mine || (await picked(env, a))) continue;
    const to = a.later.filter((m) => team.has(m) && !off.has(m));
    if (to.length) await toTeam(env, now, `${a.body}\n\n(Passed on: nobody replied in 10 minutes.)`, a.link, to, a.buttons ?? undefined);
  }
}

/** Has someone taken this alert up: answered the question, replied about the client, taken the
 *  chat, or (a form lead) contacted them or moved it on in Admin → Leads? */
async function picked(env: Env, a: Pass) {
  if (a.question_id) {
    const [x] = await sb<Question>(env, 'GET', `questions?id=eq.${a.question_id}&select=status`);
    if (!x || x.status !== 'pending') return true;
  }
  if (a.wa_id) {
    // (Meta's times are whole seconds: a reply in the alert's own second counts too)
    const since = iso(Math.floor(Date.parse(a.created_at) / 1000) * 1000);
    const replied = await sb(env, 'GET', `messages?wa_id=eq.${q(a.wa_id)}&team=not.is.null&dir=eq.in&at=gte.${q(since)}&select=wamid&limit=1`);
    if (replied.length) return true;
    const [c] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(a.wa_id)}&select=taken_by,mode`);
    return !c || (c.mode === 'human' && !!c.taken_by) || c.mode === 'stopped' || c.mode === 'blocked';
  }
  if (a.lead_id) {
    count(env);
    const l = await env.DB.prepare('SELECT status, last_contact_at FROM leads WHERE id = ?').bind(a.lead_id).first<{ status: string; last_contact_at: string | null }>();
    return !l || l.status !== 'new' || !!l.last_contact_at;
  }
  return false;
}

/** "busy" (2 hours), "busy 30m", "off" (until "free"), "off 3d", "free": who the bot alerts first. */
async function setStatus(env: Env, now: number, member: string, st: RegExpExecArray, reply: Reply) {
  const word = st[1].toLowerCase(), status = word === 'busy' ? 'busy' : word === 'off' ? 'off' : 'free';
  const n = Number(st[2] ?? 0), unit = (st[3] ?? 'h')[0].toLowerCase();
  const ms = n ? n * (unit === 'm' ? MIN : unit === 'd' ? DAY : HOUR) : status === 'busy' ? 2 * HOUR : 0;
  const until = status !== 'free' && ms ? iso(now + Math.min(ms, 30 * DAY)) : null;
  count(env);
  await env.DB.prepare(`INSERT INTO bot_team (whatsapp, status, status_until, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(whatsapp) DO UPDATE SET status = excluded.status, status_until = excluded.status_until, updated_at = excluded.updated_at`)
    .bind(member, status, until).run();
  if (env.run) env.run.roster = undefined;
  const when = until ? ` until ${istTime(Date.parse(until))}` : '';
  return reply(status === 'free' ? 'You are free: you get client alerts as usual.'
    : status === 'busy' ? `Busy${when}: the others are alerted first.` : `Off${when}: you get no client alerts. Send "free" when you are back.`);
}

const istFormat = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const istTime = (ms: number) => istFormat.format(new Date(ms));

/** "who": everyone's status and the services they get first. */
async function whoIsOn(env: Env, now: number) {
  const team = await roster(env, now);
  return team.length ? ['Team alerts:', ...team.map((m) => `• ${m.name}: ${m.status}${m.until ? ` until ${istTime(Date.parse(m.until))}` : ''}`
    + (m.services.length ? ` · first for ${m.services.join(', ')}` : ''))].join('\n') : 'No team numbers are set (TEAM_WHATSAPP).';
}

async function storeOut(env: Env, now: number, wamid: string, member: string, body: string, link: { wa_id?: string; question_id?: number; knowledge_id?: number }) {
  await sb(env, 'POST', 'messages', {
    wamid, wa_id: link.wa_id ?? null, team: member, dir: 'out', body: clip(body, 4000), reply_id: null, ctx_id: null, profile: null,
    question_id: link.question_id ?? null, knowledge_id: link.knowledge_id ?? null, handled_at: iso(now), at: iso(now),
  }, 'return=minimal');
}

const HELP = 'Reply (swipe right) to a question or lead message to answer it, or start with #CODE then your message.\n"#CODE take" = chat with the client yourself, "#CODE bot" = hand back to the bot, "#CODE unblock" = undo a block, "#CODE update: …" = a project update in their language.\n"#CODE quote <link>", "#CODE pay 5000" = send a quote or an advance payment link.\n"busy", "busy 1h", "off", "free" = who gets alerts first; "who" = everyone\'s status.\n"phrase mg: ethra aakum = how much will it cost" = teach the bot a regional phrase; "phrases" = the list.';

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
    const [ok] = await sb(env, 'PATCH', `knowledge?id=eq.${tr[2]}&status=in.(approved,pending)`, { translations_ok: true });
    return reply(ok ? 'Translations saved ✅ The bot uses them word for word.' : 'That answer has a newer version: its own translations come with it.');
  }
  // [Yes, send] on a payment card (the team approves every amount): one link, however many taps.
  const pb = /^pay:(y|n)(?::([A-Z0-9]{5}):(\d+(?:\.\d{1,2})?))?$/.exec(m.reply_id ?? '');
  if (pb) {
    if (pb[1] === 'n' || !pb[2]) return reply('Cancelled: nothing was sent.');
    const [contact] = await sb<Contact>(env, 'GET', `contacts?code=eq.${pb[2]}`);
    if (!contact) return reply('That client is gone (they may have deleted their data).');
    about.wa_id = contact.wa_id;
    const amount = Number(pb[3]), lang = contact.lang ?? 'en';
    if (contact.mode === 'stopped' || contact.mode === 'blocked') return reply(`#${contact.code} ${contact.mode === 'stopped' ? 'opted out' : 'is blocked'}, so no payment link was made.`);
    const [mine] = await sb(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}&or=(pay_at.is.null,pay_at.lt.${iso(now - MIN)})`, { pay_at: iso(now) });
    if (!mine) return reply(`A payment link went to #${contact.code} less than a minute ago, so this one (${inr(amount)}) was not sent. Tap again in a minute to send it.`);
    const giveBack = () => sb(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}&pay_at=eq.${q(iso(now))}`, { pay_at: contact.pay_at ?? null }, 'return=minimal');
    const link = await paymentLink(env, amount, { code: contact.code, name: who(contact), phone: contact.phone, reference: `${contact.code}-${now}` });
    const text = link ? fill(t(lang, 'pay'), { amount: inr(amount), link })
      : env.UPI_ID ? fill(t(lang, 'payUpi'), { amount: inr(amount), upi: env.UPI_ID, code: `#${contact.code}` }) : null;
    if (!text) { await giveBack(); return reply('Razorpay did not make the link, so nothing was sent. Try again in a minute.'); }
    const sent = await relay(env, now, contact, text, true, { template: true });
    if (sent.ok) about.sent = sent.note; else await giveBack();
    return reply(sent.ok ? `${sent.note} ${inr(amount)}${link ? `: ${link}` : ' by UPI'}` : sent.note, { wa_id: contact.wa_id });
  }
  const dr = /^dr:([sw]):(\d+)$/.exec(m.reply_id ?? '');
  if (dr) {
    const [question] = await sb<Question>(env, 'GET', `questions?id=eq.${dr[2]}`);
    if (!question) return reply('That question is gone (the client may have deleted their data).');
    about.wa_id = question.wa_id;
    if (dr[1] === 's') return sendDraft(env, now, member, question, reply, about);
    return reply('Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  }

  // Status words, sent on their own (not as a reply to an alert).
  const st = /^(busy|off|free|back|available)(?:\s+(\d{1,3})\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?))?[\s.!]*$/i.exec(text);
  if (st && !m.ctx_id) return setStatus(env, now, member, st, reply);
  if (/^(who|status)[\s?!.]*$/i.test(text) && !m.ctx_id) return reply(await whoIsOn(env, now));
  const ph = /^phrase\s+(en|ml|mg|hi|hg|kn|kg|ta|tg)\s*:\s*([\s\S]+?)\s*=\s*([\s\S]+)$/i.exec(text);
  if (ph && !m.ctx_id) return reply(await addPhrase(env, member, ph[1].toLowerCase(), ph[2], ph[3]));
  if (/^phrases[\s?!.]*$/i.test(text) && !m.ctx_id) return reply(await listPhrases(env));

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
  if (!contact && st && !code) return setStatus(env, now, member, st, reply);   // "free" as a reply to the bot's own note
  if (!contact || !rest) return reply(HELP);

  if (/^unblock$/i.test(rest)) {
    const [done] = await sb<Contact>(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}&mode=eq.blocked`, { mode: 'bot' });
    return reply(done ? `#${contact.code} is unblocked; the bot answers them again.` : `#${contact.code} was not blocked (now: ${contact.mode}), so nothing changed.`);
  }
  if (/^delete$/i.test(rest)) {
    // A client asked the team to delete their data: they confirm it themselves with the buttons.
    if (!canText(contact, now, env)) return reply(`#${contact.code}'s 24-hour ${CHANNEL_LABEL[channelOf(contact.wa_id)]} window has closed; ask them to send "delete my data".`);
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

  // "#CODE /portfolio": a saved reply (Admin → WhatsApp → Settings), in their language; "/list" shows them.
  const saved = /^\/([a-z0-9-]{2,24})$/i.exec(rest);
  if (saved) {
    count(env);
    const all = (await env.DB.prepare('SELECT key, text FROM bot_replies ORDER BY key').all<{ key: string; text: string }>().catch(() => ({ results: [] as { key: string; text: string }[] }))).results;
    const hit = saved[1].toLowerCase() === 'list' ? undefined : all.find((r) => r.key === saved[1].toLowerCase());
    if (!hit) return reply(all.length ? `Saved replies: ${all.map((r) => `/${r.key}`).join(', ')}` : 'No saved replies yet (Admin → WhatsApp → Settings).');
    const sent = await relay(env, now, contact, hit.text);
    if (sent.ok) {
      about.sent = sent.note;
      // it answers the question they are waiting on (the oldest open one), like a typed reply
      const [open] = questionId ? await sb<Question>(env, 'GET', `questions?id=eq.${questionId}&status=eq.pending&select=id`)
        : await sb<Question>(env, 'GET', `questions?wa_id=eq.${q(contact.wa_id)}&status=eq.pending&order=created_at.asc&limit=1&select=id`);
      if (open) await sb(env, 'PATCH', `questions?id=eq.${open.id}&status=eq.pending`, { status: 'answered', answer: clip(hit.text, 2000), answered_by: member, answered_at: iso(now) }, 'return=minimal');
    }
    return reply(sent.note, { wa_id: contact.wa_id });
  }
  // "quote <link>": the word, then a link (anything else, e.g. "quote ready", is an ordinary message)
  const quote = /^quote\b[\s:,-]*(\S+:\/\/\S*)([\s\S]*)$/i.exec(rest);
  if (quote) {
    const link = quote[1];
    if (!/^https:\/\//i.test(link) || quote[2].trim()) return reply(`Send just the quote's https link after the word, e.g. "#${contact.code} quote https://…".`);
    const sent = await relay(env, now, contact, fill(t(contact.lang, 'quote'), { link }), true, { template: true });
    if (!sent.ok) return reply(sent.note, { wa_id: contact.wa_id });
    about.sent = sent.note;
    count(env);
    await env.DB.prepare(`UPDATE leads SET status = CASE WHEN status IN ('new', 'contacted') THEN 'quoted' ELSE status END WHERE id = ?`).bind(contact.lead_id).run();
    await sb(env, 'PATCH', `contacts?wa_id=eq.${q(contact.wa_id)}`, { quote_at: iso(now) }, 'return=minimal');
    return reply(`${sent.note} The lead is marked Quoted; I'll pass on their reply.`, { wa_id: contact.wa_id });
  }
  // "pay 5000" (an amount, nothing else) asks the member to confirm; "pay the balance later" is just a message
  const pay = /^pay\b[\s:]*(.*)$/i.exec(rest), amount = pay ? rupees(pay[1]) : null;
  if (amount) {
    if (!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) && !env.UPI_ID) return reply('No payment method is set up: add the Razorpay keys or UPI_ID to the bot (SETUP.md).');
    const body = `Send #${contact.code} (${who(contact)}) a payment link for ${inr(amount)}?`;
    const id = await sendButtons(env, member, body, [{ id: `pay:y:${contact.code}:${amount}`, title: 'Yes, send' }, { id: 'pay:n', title: 'Cancel' }]);
    if (!id) return reply('I could not send the confirm card. Please send it again.');
    await storeOut(env, now, id, member, body, { wa_id: contact.wa_id });
    return;
  }
  if (o?.body?.startsWith('Send #') && o.body.includes('a payment link for')) {
    return reply(`Tap "Yes, send" on the card, or send "#${contact.code} pay <amount>" again.`);
  }

  const up = code ? /^update\s*:\s*/i.exec(rest) : null;                   // only "#CODE update: …" (a reply may start with "Update")
  if (up) {
    const news = rest.slice(up[0].length).trim();
    if (!news) return reply(`Write the update after the word, e.g. "#${contact.code} update: the first design is ready".`);
    const sent = await relay(env, now, contact, news, false, { prefix: t(contact.lang, 'update'), template: true });
    if (sent.ok) about.sent = sent.note;
    return reply(sent.note, { wa_id: contact.wa_id });
  }

  // A reply to a question's alert answers that question; "#CODE text" answers their oldest open
  // one; a reply to anything else (a lead alert, a forwarded message) just goes to the client.
  const [pending] = questionId ? await sb<Question>(env, 'GET', `questions?id=eq.${questionId}`)
    : code ? await sb<Question>(env, 'GET', `questions?wa_id=eq.${q(contact.wa_id)}&status=eq.pending&order=created_at.asc&limit=1`) : [];
  if (pending && pending.status !== 'pending') return reply(`Already answered by ${answeredBy(pending.answered_by, member)}.`);
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
/** A general Q&A from a client's question and the team's answer (no names, dates or one client's
 *  promises), or null for small talk. The team's WhatsApp answers and Admin → Questions both use it. */
export async function generalise(env: Env, question: string, answer: string) {
  const qa = await chat<{ question_en: string; answer_en: string }>(env, {
    system: generalisePrompt, schema: QA_SCHEMA, name: 'faq', prefer: ['groq', 'gemini'],
    user: JSON.stringify({ client_message: question, team_reply: answer }),
  });
  return qa?.question_en.trim() && qa.answer_en.trim() ? qa : null;
}

async function suggest(env: Env, now: number, member: string, contact: Contact, question: string, answer: string, note: string,
  questionId: number | null, reply: Reply) {
  const qa = await generalise(env, question, answer);
  if (!qa) return reply(note, { wa_id: contact.wa_id });
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
  for (const half of [TRANSLATED.slice(0, 4), TRANSLATED.slice(4)]) {
    await sendText(env, member, [`Translations of: ${k.question_en}`, ...half.map((l) => `${langName(l)}:\n${translations[l]}`)].join('\n\n'));
  }
  await sendButtons(env, member, 'Use these translations for this answer?', [{ id: `tr:a:${k.id}`, title: 'Approve all' }, { id: `tr:s:${k.id}`, title: 'Skip' }]);
}
const toneOf = async (env: Env) => (await sb<{ value: string }>(env, 'GET', 'settings?key=eq.tone&select=value').catch(() => []))[0]?.value ?? null;

/** The team's words to the client, in the client's language. Translated only when nothing would
 *  be removed on the way to the AI (numbers, emails): otherwise sent exactly as written. A project
 *  update (`o.template`) still goes out after their 24-hour window, as the `project_update` template. */
export async function relay(env: Env, now: number, c: Contact, text: string, asIs = false, o: { prefix?: string; template?: boolean; human?: boolean } = {}): Promise<{ ok: boolean; note: string }> {
  const direct = c.phone ? ` Message them directly: wa.me/${c.phone}` : '';
  if (c.mode === 'stopped') return { ok: false, note: `#${c.code} opted out, so nothing was sent.` };
  if (c.mode === 'blocked') return { ok: false, note: `#${c.code} is blocked, so nothing was sent. "#${c.code} unblock" first.` };
  const ch = channelOf(c.wa_id);
  // Meta's human agent tag: a person's own words only, up to 7 days (never the bot's draft)
  const tagged = o.human !== false && !canText(c, now, env) && (ch === 'fb' || ch === 'ig') && Date.parse(c.last_in_at) > now - 7 * DAY;
  const closed = !canText(c, now, env) && !tagged;
  if (closed && (!o.template || ch !== 'whatsapp')) {
    return { ok: false, note: `#${c.code}'s ${ch === 'whatsapp' ? '24-hour WhatsApp' : `${CHANNEL_LABEL[ch]} (7 days for a person's reply)`} window has closed, so I can't send this.${direct}` };
  }
  let out = text, asWritten = false;
  if (c.lang && c.lang !== 'en' && !asIs) {
    if (redact(text) !== text) asWritten = true;
    else {
      const r = await chat<{ text: string }>(env, { system: translatePrompt(c.lang), user: text, schema: TEXT_SCHEMA, name: 'translate', prefer: writer(c.lang) });
      if (r?.text.trim()) out = r.text.trim(); else asWritten = true;
    }
  }
  if (closed && out.length > 800) return { ok: false, note: `#${c.code}'s 24-hour window has closed: the project_update template takes 800 characters at most, so please shorten it.` };
  const id = closed ? await sendTemplate(env, c.wa_id, 'project_update', [c.fields.name || c.profile_name || 'there', out])
    : await (tagged ? sendHumanText : sendText)(env, c.wa_id, o.prefix ? `${o.prefix}\n${out}` : out);
  const sentOut = env.run?.out?.find((x) => x.wamid === id);
  if (sentOut) sentOut.team = true;                                          // the chat viewer shows it as the team's
  if (!id) {
    return { ok: false, note: closed ? `#${c.code}'s 24-hour window has closed and the project_update template did not go out (is it approved?).${direct}` : `Sending to #${c.code} failed.${direct}` };
  }
  count(env);
  // the first human reply is what Admin → Leads measures against the 2-hour promise
  await env.DB.prepare(`UPDATE leads SET last_contact_at = datetime('now'), first_reply_at = COALESCE(first_reply_at, datetime('now')) WHERE id = ?`).bind(c.lead_id).run()
    .catch((e) => console.error('[bot] contact time not saved', String(e)));       // the client has it: never "send it again"
  return { ok: true, note: `Sent to #${c.code} ✅${closed ? ' (as the project_update template: their 24-hour window had closed)' : ''}${asWritten ? ' (as you wrote it: numbers and emails are never sent for translation)' : ''}`
    + (ch === 'web' ? ' (in their website chat: they see it while it is open, or when they come back to the site)' : '') };
}

type Reply = (body: string, link?: { wa_id?: string; knowledge_id?: number; question_id?: number }) => Promise<void>;
const answeredBy = (by: string | null, member: string) => (by === member ? 'you' : by?.startsWith('admin:') ? `an admin (${by.slice(6)}) in Admin → WhatsApp` : `+${by}`);

/** [Send] on a draft: the bot's reply goes to the client as written (it is already in their
 *  language). A draft of an approved answer teaches nothing new; any other becomes a suggested
 *  answer that the member reads in full and approves, like a typed one. */
async function sendDraft(env: Env, now: number, member: string, question: Question, reply: Reply, about: About = {}) {
  if (question.status !== 'pending') return reply(`Already answered by ${answeredBy(question.answered_by, member)}.`);
  if (!question.draft) return reply('There is no draft for this one. Reply to this message with your answer.', { wa_id: question.wa_id, question_id: question.id });
  const [contact] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(question.wa_id)}`);
  if (!contact) return reply('That client deleted their data, so nothing was sent.');
  const [won] = await sb<Question>(env, 'PATCH', `questions?id=eq.${question.id}&status=eq.pending`,
    { status: 'answered', answer: question.draft, answered_by: member, answered_at: iso(now) });
  if (!won) return reply('Someone answered this a moment ago.');
  const sent = await relay(env, now, contact, question.draft, true, { human: false });
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
  const v = await embed(env, k.question_en, true);
  if (!v) return reply('I could not save it right now. Tap Approve again in a minute.');
  const [ok] = await sb(env, 'PATCH', `knowledge?id=eq.${id}&status=eq.pending`, { status: 'approved', embedding: vec(v), decided_by: member, decided_at: iso(now) });
  const replaced = ok ? await supersedeNear(env, id, v, member, now).catch(() => [] as Knowledge[]) : [];
  await reply(!ok ? 'This one was already decided.' : `Saved ✅ I will answer this myself next time.${replaced.length
    ? ` It replaces the earlier answer "${clip(replaced[0].answer_en, 120)}" (kept in Admin → WhatsApp → Answers).` : ''}`);
  // the answer is saved: a failure from here on never asks the member to tap again
  if (ok) await offerTranslations(env, member, k, await toneOf(env)).catch((e) => console.error('[bot] translations not offered', String(e)));
}

/** An answer just approved replaces the approved ones for (nearly) the same question: they are
 *  kept as superseded (Admin → Answers can switch one back on), so two answers never compete. */
export async function supersedeNear(env: Env, id: number, v: number[], by: string, now: number) {
  const near = (await sb<Knowledge>(env, 'POST', 'rpc/match_knowledge', { query_embedding: vec(v), match_threshold: SURE, match_count: 5 })).filter((k) => k.id !== id);
  if (!near.length) return near;
  await sb(env, 'PATCH', `knowledge?id=in.(${near.map((k) => k.id).join(',')})&status=eq.approved`, { status: 'superseded', decided_by: clip(by, 120), decided_at: iso(now) }, 'return=minimal');
  await sb(env, 'PATCH', `knowledge?id=eq.${id}`, { supersedes: near[0].id }, 'return=minimal');
  return near;
}

async function saveEdit(env: Env, now: number, member: string, id: number, text: string, reply: Reply) {
  const [k] = await sb<Knowledge & { source: string; version?: number; review_at?: string | null }>(env, 'GET', `knowledge?id=eq.${id}`);
  if (!k || !text) return reply(HELP);
  if (k.status === 'superseded' || k.status === 'archived') return reply('That answer has a newer version (or was archived): edit the current one in Admin → WhatsApp → Answers.');
  const v = await embed(env, k.question_en, true);
  if (!v) return reply('I could not save it right now. Reply with the answer again in a minute.', { knowledge_id: id });
  if (k.status === 'approved') {                                            // an answer in use: a new version, the old one kept
    const nv = await newVersion(env, k, { question_en: k.question_en, answer_en: clip(text, 700), embedding: vec(v), by: member, at: iso(now), review_at: k.review_at ?? null, keep: false });
    await reply('Saved your answer as a new version ✅ I will use it next time (the old one is kept in Admin → WhatsApp → Answers).');
    if (nv) await offerTranslations(env, member, { id: nv.id, question_en: k.question_en, answer_en: clip(text, 700) }, await toneOf(env)).catch((e) => console.error('[bot] translations not offered', String(e)));
    return;
  }
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
  await beat(env, 'cron', now);
  await pingGateway(env, now);
  try { await cron(env, now); } finally { await flushOut(env, now); }
}

/** Every 2 minutes: is the WhatsApp Web gateway there? (It also keeps a free Render service awake,
 *  which sleeps after 15 minutes without a request.) Admin → WhatsApp → Live shows the answer. */
async function pingGateway(env: Env, now: number) {
  if (!viaGateway(env)) return;
  const base = await gatewayBase(env);
  if (!base) return;
  count(env);
  const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (r) await beat(env, r.ok ? 'gw' : 'gwdown', now);         // 503: running, WhatsApp not linked
}

/** When something last happened, for Admin → WhatsApp's live view (D1 bot_limits `beat:<what>`,
 *  n = how many times since the row was made): the cron, a signed webhook, a refused signature,
 *  Supabase refusing to store. Never fails the caller. */
export async function beat(env: Env, what: 'cron' | 'hook' | 'badsig' | 'sbfail' | 'gw' | 'gwdown', now = clock.now()) {
  await env.DB?.prepare('INSERT INTO bot_limits (key, n, at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = n + 1, at = excluded.at')
    .bind(`beat:${what}`, now).run().catch(() => {});
}

async function cron(env: Env, now: number) {
  const d = new Date(now);
  if (d.getUTCHours() === 21 && d.getUTCMinutes() >= 30 && d.getUTCMinutes() < 32) {   // ~03:00 IST, once a day
    await Promise.all([
      sb(env, 'DELETE', `messages?at=lt.${iso(now - 90 * DAY)}`, undefined, 'return=minimal'),
      sb(env, 'DELETE', `contacts?last_in_at=lt.${iso(now - 180 * DAY)}`, undefined, 'return=minimal'),
      // learned answers nobody approved; a switched-off one 90 days after it was switched off (the site's own answers stay)
      sb(env, 'DELETE', `knowledge?source=eq.team&status=eq.pending&created_at=lt.${iso(now - 90 * DAY)}`, undefined, 'return=minimal'),
      sb(env, 'DELETE', `knowledge?source=eq.team&status=eq.rejected&decided_at=lt.${iso(now - 90 * DAY)}`, undefined, 'return=minimal'),
      sb(env, 'DELETE', `alerts?created_at=lt.${iso(now - DAY)}`, undefined, 'return=minimal'),        // a pass-on needs 10 minutes
      env.DB.prepare('DELETE FROM bot_limits WHERE at < ?').bind(now - DAY).run(),                     // the website chat's limits
    ]).catch((e) => console.error('[bot] purge failed', String(e)));
    await purgeFiles(env, now).catch((e) => console.error('[bot] file purge failed', String(e)));
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
    if (!c || c.mode === 'stopped' || c.mode === 'blocked' || !canText(c, now, env)) continue;
    const s = await settingsOf(env);
    if (s.paused === '1') continue;                                            // they had the away message
    const own = !isOpenNow(new Date(now)) && s.after_hours;
    await sendText(env, c.wa_id, own ? await inTheirWords(env, c.lang, own) : t(c.lang, isOpenNow(new Date(now)) ? 'teamSoon' : 'teamLater'));
  }
  const stale = await sb<Msg>(env, 'GET', `messages?dir=eq.in&handled_at=is.null&at=lt.${iso(now - 2 * MIN)}&order=at.asc&limit=20`);
  for (const m of stale.filter((m) => m.team)) {
    if (!room(env, 20)) break;
    await runTeam(env, m);
  }
  for (const waId of new Set(stale.filter((m) => m.wa_id && !m.team).map((m) => m.wa_id!))) {
    if (!room(env, 24)) break;
    await runClient(env, waId).catch((e) => console.error('[bot] retry failed', String(e)));
  }
  if (room(env, 12)) await remind(env, now).catch((e) => console.error('[bot] call reminders failed', String(e)));
  if (ist.getUTCDate() === 1 && ist.getUTCHours() === 10 && room(env, 10 + teamIds(env).size)) {      // the 1st of the month, 10 a.m.
    await monthly(env, now, ist.toISOString().slice(0, 7)).catch((e) => console.error('[bot] monthly report failed', String(e)));
  }
  // then alerts: passed on after 10 minutes, website form enquiries, the 10 a.m. summary
  if (room(env, 10)) await passOn(env, now).catch((e) => console.error('[bot] pass-on failed', String(e)));
  if (room(env, 12)) await formLeads(env, now).catch((e) => console.error('[bot] form leads failed', String(e)));
  if (isOpenNow(new Date(now))) {                                          // sales asks: working hours, after the alerts
    if (room(env, 12)) await reviews(env, now).catch((e) => console.error('[bot] review requests failed', String(e)));
    if (room(env, 12)) await revive(env, now).catch((e) => console.error('[bot] revivals failed', String(e)));
  }
  if (ist.getUTCHours() === 10 && isOpenNow(new Date(now)) && room(env, 9 + teamIds(env).size)) {   // 10 a.m. on working days
    await morning(env, now, ist.toISOString().slice(0, 10)).catch((e) => console.error('[bot] morning summary failed', String(e)));
  }
  // reminders last: stuck messages come first, and a client whose message is unhandled is not quiet
  if (room(env, 6)) await nudge(env, now).catch((e) => console.error('[bot] reminders failed', String(e)));
}

/** The weekly report, once per Monday: any tick in the 10 o'clock hour may claim it (a failed
 *  tick is retried by the next one), and the settings row 'weekly_at' records the week sent. */
async function weeklyOnce(env: Env, now: number, monday: string) {
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'weekly_at', value: '2000-01-01', updated_at: iso(now) }, 'resolution=ignore-duplicates,return=minimal');
  const [mine] = await sb(env, 'PATCH', `settings?key=eq.weekly_at&value=lt.${monday}`, { value: monday, updated_at: iso(now) });
  if (mine) await weekly(env, now);
}

/** Can a client get a plain message now: the website chat always; WhatsApp, Messenger and
 *  Instagram within 24 hours of their last message. */
const canText = (c: Pick<Contact, 'wa_id' | 'last_in_at'>, now: number, env?: Env) =>
  channelOf(c.wa_id) === 'web' || (!!env && viaGateway(env) && channelOf(c.wa_id) === 'whatsapp') || Date.parse(c.last_in_at) > now - 24 * HOUR;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAP = /^(?!media:)[a-z]{2,6}:[\w.-]{1,40}(:[\w.-]{1,60})?$/;

/** The website chat's limits, counted in D1 (bot_limits, migration 0016: atomic, and DELETE MY
 *  DATA does not reset them): 10 messages a minute per chat; new chats 20 an hour per address
 *  and 100 an hour in all. An address is kept only as a salted hash, for a day.
 *  ponytail: a busy hour can still be filled from many addresses; Turnstile on a chat's first
 *  message if that ever happens. */
async function limited(env: Env, session: string, ip: string, now: number): Promise<'rate-limited' | 'busy' | null> {
  const bump = (key: string) => env.DB.prepare('INSERT INTO bot_limits (key, n, at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n').bind(key, now);
  const minute = Math.floor(now / MIN), hour = Math.floor(now / HOUR);
  count(env);
  const [chat, seen] = await env.DB.batch<{ n: number }>([bump(`m:${session}:${minute}`), env.DB.prepare('SELECT n FROM bot_limits WHERE key = ?').bind(`s:${session}`)]);
  if ((chat.results[0]?.n ?? 0) > 10) return 'rate-limited';
  if (seen.results.length) return null;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${env.WA_APP_SECRET ?? ''}`)));
  const where = [...hash.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  count(env);
  const [mine, all] = await env.DB.batch<{ n: number }>([bump(`a:${where}:${hour}`), bump(`h:${hour}`)]);
  if ((mine.results[0]?.n ?? 0) > 20 || (all.results[0]?.n ?? 0) > 100) return 'busy';
  count(env);
  await env.DB.prepare('INSERT OR IGNORE INTO bot_limits (key, n, at) VALUES (?, 1, ?)').bind(`s:${session}`, now).run();
  return null;
}

/** A request body of at most `max` bytes, read no further (null when it is longer). */
async function capped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? 0) > max) return null;
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return new TextDecoder().decode(all);
}

/** The website's chat bubble (components/chat → the site's /api/chat → the BOT service binding →
 *  BotAdmin.fetch: the bot's own address is never on the site): POST a message (or a tap on a
 *  button the bot sent there, never one made up), GET the chat (the newest 50 first, then whatever came after
 *  a time, with two minutes of overlap: a run stores its replies when it ends, and the bubble
 *  drops what it already has). The session id (a random UUID kept in that browser) is the
 *  chat's only key. Limits: limited() above; the flood rule, AI cap and DELETE MY DATA apply as
 *  on WhatsApp. */
export async function webChat(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  const now = clock.now(), e = withRun(env);
  if (req.method === 'GET') {
    const u = new URL(req.url), session = u.searchParams.get('session') ?? '', after = Date.parse(u.searchParams.get('after') ?? '');
    if (!UUID.test(session)) return reply({ error: 'bad-session' }, 400);
    const first = !Number.isFinite(after), dir = first ? 'desc' : 'asc';
    const rows = await sb(e, 'GET', `messages?wa_id=eq.${q(`web:${session}`)}&team=is.null${first ? '' : `&at=gt.${q(iso(after - 2 * MIN))}`}`
      + `&order=at.${dir},wamid.${dir}&limit=${first ? 50 : 200}&select=wamid,at,dir,body,options`).catch(() => null);
    return rows ? reply({ messages: first ? rows.reverse() : rows }) : reply({ error: 'unavailable' }, 503);
  }
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const raw = await capped(req, 4000).catch(() => null);
  if (raw === null) return reply({ error: 'too-large' }, 413);
  let b: { session?: unknown; text?: unknown; reply?: { id?: unknown; title?: unknown } };
  try { b = JSON.parse(raw); } catch { return reply({ error: 'bad-request' }, 400); }
  const session = String(b?.session ?? ''), text = typeof b?.text === 'string' ? b.text.trim().slice(0, 1000) : '';
  const tap = b?.reply && TAP.test(String(b.reply.id ?? '')) ? { id: String(b.reply.id), title: clip(String(b.reply.title ?? ''), 60) } : null;
  if (!UUID.test(session) || (!text && !tap)) return reply({ error: 'bad-request' }, 400);
  const waId = `web:${session}`;
  try {
    const hit = await limited(e, session, req.headers.get('cf-connecting-ip') ?? '', now);
    if (hit) return reply({ error: hit }, 429);
    let notice: string | undefined;
    if (tap) {
      // only a button of the bot's latest message here (WhatsApp sends only ids the bot made)
      const [latest] = await sb<{ options: Option[] | null }>(e, 'GET', `messages?wa_id=eq.${q(waId)}&team=is.null&dir=eq.out&options=not.is.null&order=at.desc,wamid.desc&limit=1&select=options`);
      if (!latest?.options?.some((o) => o.id === tap.id)) return reply({ error: 'old-button' }, 409);
      if (tap.id === 'del:y') {                                    // the confirmation: nothing of theirs is kept to show it later
        const [c] = await sb<{ lang: string | null }>(e, 'GET', `contacts?wa_id=eq.${q(waId)}&select=lang`);
        notice = t(c?.lang, 'deleted');
      }
    }
    const row: Msg = { wamid: `web.${crypto.randomUUID()}`, wa_id: waId, team: null, dir: 'in', body: tap ? tap.title || tap.id : text,
      reply_id: tap?.id ?? null, ctx_id: null, profile: null, question_id: null, knowledge_id: null, handled_at: null, at: iso(now) };
    await sb(e, 'POST', 'messages', row, 'return=minimal');
    ctx.waitUntil(processFresh(e, [row]).catch((err) => console.error('[bot] web turn failed', String(err))).finally(() => flushOut(e, clock.now())));
    return reply({ ok: true, id: row.wamid, at: row.at, ...(notice ? { erased: true, notice } : {}) }, 202);
  } catch (err) {
    console.error('[bot] web chat unavailable', String(err));
    return reply({ error: 'unavailable' }, 503);
  }
}

/** The 1st of the month: last month's enquiries (by source, service and outcome), the 2-hour
 *  promise, and what the bot answered by itself. Once a month (settings 'monthly_at'). */
async function monthly(env: Env, now: number, month: string) {
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'monthly_at', value: '2000-01', updated_at: iso(now) }, 'resolution=ignore-duplicates,return=minimal');
  const [last] = await sb<{ value: string }>(env, 'GET', 'settings?key=eq.monthly_at&select=value');
  if (!last || last.value >= month) return;
  const [y, m] = month.split('-').map(Number), from = `${new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)} 00:00:00`, to = `${month}-01 00:00:00`;
  count(env);
  const rows = (await env.DB.prepare(`SELECT ${CHANNEL_SQL} AS source, service, status, score, created_at, wa_alerted_at, first_reply_at FROM leads
    WHERE source != 'demo' AND created_at >= ? AND created_at < ? LIMIT 5000`).bind(from, to)
    .all<{ source: string; service: string | null; status: string; score: string | null; created_at: string; wa_alerted_at: string | null; first_reply_at: string | null }>()).results;
  // the 2-hour promise (in working hours, from when the team was told), as Admin → Leads counts it
  const d1 = (t: string) => Date.parse(`${t.replace(' ', 'T')}Z`);
  const owed = rows.filter((r) => r.source === 'form' || r.wa_alerted_at);
  const met = owed.filter((r) => r.first_reply_at && d1(r.first_reply_at) <= replyDeadline(new Date(d1(r.wa_alerted_at ?? r.created_at))).getTime()).length;
  const window = `questions?created_at=gte.${q(`${from.slice(0, 10)}T00:00:00Z`)}&created_at=lt.${q(`${month}-01T00:00:00Z`)}`;
  const [asked, auto] = await Promise.all([sbCount(env, window), sbCount(env, `${window}&kind=eq.auto`)]);
  const tally = (pick: (r: (typeof rows)[number]) => string | null, list = rows) => {
    const n = new Map<string, number>();
    for (const r of list) { const k = pick(r) ?? '—'; n.set(k, (n.get(k) ?? 0) + 1); }
    return [...n].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  };
  const text = [
    `Monthly report: ${new Date(Date.UTC(y, m - 2, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
    `Enquiries: ${rows.length} (${tally((r) => r.source)}). Won: ${rows.filter((r) => r.status === 'won').length}, lost: ${rows.filter((r) => r.status === 'lost').length}.`,
    `By service: ${tally((r) => r.service)}.`, `Lead score (chats): ${tally((r) => r.score, rows.filter((r) => r.source !== 'form'))}.`,
    `First reply within the 2-hour promise: ${met} of ${owed.length}.`,
    `Questions: ${asked}, answered by the bot: ${auto}.`,
    'Details: Admin → WhatsApp.',
  ].join('\n');
  const [mine] = await sb(env, 'PATCH', `settings?key=eq.monthly_at&value=eq.${q(last.value)}`, { value: month, updated_at: iso(now) });
  if (mine) await toTeam(env, now, text, {}, (await route(env, now, null)).all);
}

/** 30 minutes before a booked call: the client (the call_reminder template after their 24-hour
 *  window) and the team. */
async function remind(env: Env, now: number) {
  const due = await sb<CallRow>(env, 'GET', `calls?reminded=eq.false&start_at=gt.${iso(now)}&start_at=lt.${iso(now + 35 * MIN)}&limit=5`);
  for (const call of due) {
    if (!room(env, 3 * teamIds(env).size + 6)) return;
    const [mine] = await sb(env, 'PATCH', `calls?id=eq.${call.id}&reminded=eq.false`, { reminded: true });
    if (!mine) continue;
    const [c] = await sb<Contact>(env, 'GET', `contacts?wa_id=eq.${q(call.wa_id)}`);
    if (!c || c.mode === 'stopped' || c.mode === 'blocked') continue;
    let start = Date.parse(call.start_at);
    if (call.event_id) {                                                     // moved or cancelled in Google Calendar since?
      const ev = await callEvent(env, call.event_id);
      if (ev === 'gone') continue;
      if (ev) start = ev.start;
      if (start - now > 35 * MIN || start < now) { if (start > now) await sb(env, 'PATCH', `calls?id=eq.${call.id}`, { start_at: iso(start), reminded: false }, 'return=minimal'); continue; }
    }
    const lang = c.lang ?? 'en';
    const join = call.how === 'meet' ? (call.meet ? fill(t(lang, 'howMeet'), { link: call.meet }) : '') : t(lang, call.how === 'wa' ? 'howWa' : 'howPhone');
    const text = `${fill(t(lang, 'reminder'), { time: slotFormat(lang).format(new Date(start)) })}\n${join}`.trim();
    const reminded = canText(c, now, env) ? await sendText(env, c.wa_id, text)
      : await sendTemplate(env, c.wa_id, 'call_reminder', [c.fields.name || c.profile_name || 'there', text]);
    await toTeam(env, now, `#${c.code} 📅 call in 30 minutes: ${istTime(start)} · ${HOW_LABEL[call.how]}${c.phone ? ` · wa.me/${c.phone}` : ''}${call.meet ? `\nMeet: ${call.meet}` : ''}`
      + (reminded ? '' : `\n(They were not reminded: ${channelOf(c.wa_id) === 'whatsapp' ? 'the call_reminder template did not go out' : `their ${CHANNEL_LABEL[channelOf(c.wa_id)]} window has closed`}.)`),
      { wa_id: c.wa_id });
  }
}

/** The greeting the site's own WhatsApp buttons open with (Admin → Company), once a run. */
async function greetingOf(env: Env) {
  return (await settingsOf(env)).site_greeting || "Hi Legit Forge, I'd like to talk about a project.";   // lib/site.ts COMPANY_DEFAULTS
}

/** The studio's WhatsApp link to share (Admin → Company), else the website. */
async function shareLink(env: Env) {
  count(env);
  const row = await env.DB.prepare('SELECT data FROM company WHERE id = 1').first<{ data: string }>().catch(() => null);
  let digits = '';
  try { digits = String((JSON.parse(row?.data ?? '{}') as { whatsapp?: string }).whatsapp ?? '').replace(/\D/g, ''); } catch { /* none */ }
  return digits ? `https://wa.me/${digits}` : '';
}

/** A WhatsApp lead marked Won in Admin → Leads gets one polite Google review request (the
 *  review_request template after their 24-hour window). Off until GOOGLE_REVIEW_URL is set. */
async function reviews(env: Env, now: number) {
  if (!env.GOOGLE_REVIEW_URL || (await settingsOf(env)).paused === '1') return;
  count(env);
  const won = (await env.DB.prepare(`SELECT id FROM leads WHERE source = 'whatsapp' AND status = 'won' AND review_asked_at IS NULL
    ORDER BY created_at DESC LIMIT 3`).all<{ id: string }>()).results;
  for (const l of won) {
    if (!room(env, 6)) return;
    count(env);
    const mine = await env.DB.prepare(`UPDATE leads SET review_asked_at = datetime('now') WHERE id = ? AND review_asked_at IS NULL`).bind(l.id).run();
    if (!mine.meta.changes) continue;
    let [c] = await sb<Contact>(env, 'GET', `contacts?lead_id=eq.${q(l.id)}`);
    if (!c) [c] = await sb<Contact>(env, 'GET', `contacts?fields->prev_leads=cs.${q(JSON.stringify([l.id]))}`);   // an earlier enquiry
    if (!c || c.review_at || c.mode === 'stopped' || c.mode === 'blocked' || Date.parse(c.last_in_at) < now - 60 * DAY) continue;
    const sent = canText(c, now, env)
      ? await sendText(env, c.wa_id, fill(t(c.lang, 'review'), { link: env.GOOGLE_REVIEW_URL }))
      : await sendTemplate(env, c.wa_id, 'review_request', [c.fields.name || c.profile_name || 'there', env.GOOGLE_REVIEW_URL]);
    if (sent) await sb(env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}`, { review_at: iso(now) }, 'return=minimal');
  }
}

/** One approved marketing template to a lead that went quiet 30 days ago and was not won or
 *  lost. Off until REVIVE_TEMPLATE is set (each message costs money: Meta's marketing rate). */
async function revive(env: Env, now: number) {
  if (!env.REVIVE_TEMPLATE || (await settingsOf(env)).paused === '1') return;
  const cold = await sb<Contact>(env, 'GET', `contacts?mode=eq.bot&revived_at=is.null&step=neq.start&last_in_at=lt.${iso(now - 30 * DAY)}`
    + `&last_in_at=gt.${iso(now - 37 * DAY)}&select=wa_id,lead_id,fields,profile_name&limit=3`);
  for (const c of cold) {
    if (!room(env, 4)) return;
    const [mine] = await sb(env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&revived_at=is.null`, { revived_at: iso(now) });
    if (!mine) continue;
    count(env);
    const lead = await env.DB.prepare('SELECT status FROM leads WHERE id = ?').bind(c.lead_id).first<{ status: string }>();
    if (!lead || lead.status === 'won' || lead.status === 'lost') continue;
    await sendTemplate(env, c.wa_id, env.REVIVE_TEMPLATE, [c.fields.name || c.profile_name || 'there']);
  }
}

const sqlTime = (ms: number) => iso(ms).replace('T', ' ').slice(0, 19);       // D1's datetime('now') format (UTC)
interface FormLead { id: string; name: string | null; phone: string | null; service: string | null; budget: string | null; message: string | null; status: string; source: string; first_reply_at: string | null; created_at: string }

/** Website form enquiries reach the team here too (in turns, like the bot's own), once each. */
async function formLeads(env: Env, now: number) {
  count(env);
  const { results } = await env.DB.prepare(`SELECT id, name, phone, service, budget, message FROM leads
    WHERE source = 'form' AND status = 'new' AND last_contact_at IS NULL AND wa_alerted_at IS NULL AND created_at > ?
    ORDER BY created_at LIMIT 3`).bind(sqlTime(now - DAY)).all<FormLead>();
  for (const l of results) {
    if (!room(env, 6 * teamIds(env).size + 6)) return;
    count(env);
    const mine = await env.DB.prepare(`UPDATE leads SET wa_alerted_at = datetime('now') WHERE id = ? AND wa_alerted_at IS NULL`).bind(l.id).run();
    if (!mine.meta.changes) continue;                                        // another run has it
    const digits = (l.phone ?? '').replace(/\D/g, '');
    const sent = await alertTurns(env, now, { lead_id: l.id, service: serviceOfLabel(l.service) }, [
      'New website enquiry (the form)', `Name: ${l.name ?? '-'}`, `Service: ${l.service ?? '-'}`, ...(l.budget ? [`Budget: ${l.budget}`] : []),
      `Message: ${clip(l.message ?? '-', 600)}`, digits ? `WhatsApp: wa.me/${digits}` : 'WhatsApp: no number given', '',
      'Message them yourself (the bot cannot start a chat). Admin → Leads has the details.',
    ].join('\n'), {});
    if (!sent) {                                                             // nobody got it: not "alerted", and the next run tries again
      console.error(`[bot] form lead ${l.id} reached no team member (TEAM_WHATSAPP, template?)`);
      count(env);
      await env.DB.prepare('UPDATE leads SET wa_alerted_at = NULL WHERE id = ?').bind(l.id).run();
    }
  }
}

/** 10 a.m. on working days, once: enquiries since the last summary, open questions, hot leads and
 *  anyone still waiting for a first reply. The settings row 'morning_at' holds the last day sent. */
async function morning(env: Env, now: number, day: string) {
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'morning_at', value: '2000-01-01', updated_at: iso(now) }, 'resolution=ignore-duplicates,return=minimal');
  const [last] = await sb<{ value: string }>(env, 'GET', 'settings?key=eq.morning_at&select=value');
  if (!last || last.value >= day) return;
  // since the last summary (a Monday covers Saturday too), at most 3 days; the very first covers a day
  const since = last.value === '2000-01-01' ? now - DAY : Math.max(now - 3 * DAY, Date.parse(`${last.value}T10:00:00+05:30`) || 0);
  count(env);
  const leads = (await env.DB.prepare(`SELECT id, name, service, ${CHANNEL_SQL} AS source, status, first_reply_at, created_at FROM leads
    WHERE created_at >= ? ORDER BY created_at LIMIT 30`).bind(sqlTime(since)).all<FormLead>()).results;
  count(env);
  // waiting = the team was told (or a form lead) and nobody has replied for 2 hours
  const waiting = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE status = 'new' AND first_reply_at IS NULL AND last_contact_at IS NULL
    AND (source = 'form' OR wa_alerted_at IS NOT NULL) AND COALESCE(wa_alerted_at, created_at) < ? AND created_at > ?`)
    .bind(sqlTime(now - 2 * HOUR), sqlTime(now - 7 * DAY)).first<number>('n')) ?? 0;
  const open = await sb<Question>(env, 'GET', 'questions?status=eq.pending&kind=neq.auto&select=wa_id,question_en&order=created_at.asc&limit=5');
  const recent = await sb<Contact>(env, 'GET', `contacts?mode=in.(bot,human)&last_in_at=gt.${iso(now - 2 * DAY)}&select=code,profile_name,fields&limit=100`);
  const hot = recent.filter((c) => c.fields.timeline === TIMELINES[0] || c.fields.call_at).slice(0, 5);
  const wa = leads.filter((l) => l.source === 'whatsapp').length, form = leads.filter((l) => l.source === 'form').length;
  const chats = leads.length - wa - form;                                    // the website chat, Messenger, Instagram
  // The counts and what to act on first: outside a member's window this goes as the template,
  // which stops at 900 characters, so only the lists at the end can be cut.
  const text = [
    `Good morning ☀️ Since ${istTime(since)}:`,
    `New enquiries: ${leads.length}${leads.length ? ` (WhatsApp ${wa}, ${chats ? `chat ${chats}, ` : ''}website form ${form})` : ''}. Open questions: ${open.length}${open.length === 5 ? '+' : ''}.`,
    ...(hot.length ? [`Hot: ${hot.map((c) => `#${c.code} ${c.fields.name || c.profile_name || ''}`.trim() + (c.fields.call_at ? ' (asked for a call)' : ' (as soon as possible)')).join(', ')}`] : []),
    ...(waiting ? [`Waiting over 2 hours for a first reply: ${waiting} (Admin → Leads)`] : []),
    ...leads.slice(0, 8).map((l) => `• ${l.name ?? 'No name'} · ${l.service ?? 'service not chosen'} · ${l.status}`),
    ...open.map((x) => `• "${clip(x.question_en, 80)}"`),
  ].join('\n');
  const [mine] = await sb(env, 'PATCH', `settings?key=eq.morning_at&value=eq.${q(last.value)}`, { value: day, updated_at: iso(now) });
  if (!mine) return;                                                         // another run has sent it
  await toTeam(env, now, text, {}, (await route(env, now, null)).all);
}

/** Files under `prefix` in R2 (uploaded before `before`, when given), deleted: up to 5 pages of
 *  1,000 from `cursor`. Returns where to go on next time ('' when it reached the end). */
async function dropFiles(env: Env, prefix: string, before = Infinity, cursor?: string) {
  if (!env.MEDIA) return '';
  for (let page = 0; page < 5; page++) {
    count(env);
    const list = await env.MEDIA.list({ prefix, cursor: cursor || undefined, limit: 1000 });
    const old = list.objects.filter((o) => o.uploaded.getTime() < before).map((o) => o.key);
    if (old.length) { count(env); await env.MEDIA.delete(old); }
    if (!list.truncated) return '';
    cursor = list.cursor;
  }
  return cursor ?? '';
}

/** The daily 90-day file purge, resuming each day where the last one stopped (Supabase settings
 *  'purge_cursor'), so every file is reached however many there are. */
async function purgeFiles(env: Env, now: number) {
  const [row] = await sb<{ value: string }>(env, 'GET', 'settings?key=eq.purge_cursor&select=value');
  const next = await dropFiles(env, 'leads/', now - 90 * DAY, row?.value);
  await sb(env, 'POST', 'settings?on_conflict=key', { key: 'purge_cursor', value: next, updated_at: iso(now) }, 'resolution=merge-duplicates,return=minimal');
}

/** One gentle reminder to a client who stopped answering mid-brief: 3 hours later, in working
 *  hours, inside their 24-hour window, never while they wait for the team. Once per enquiry. */
async function nudge(env: Env, now: number) {
  if (!isOpenNow(new Date(now)) || (await settingsOf(env)).paused === '1') return;
  const quiet = await sb<Contact>(env, 'GET', `contacts?mode=eq.bot&nudged_at=is.null&step=in.(service,language,name,business,need,details,refs,timeline)`
    + `&last_in_at=lt.${iso(now - 3 * HOUR)}&last_in_at=gt.${iso(now - 23 * HOUR)}&select=wa_id,lang,fields&limit=5`);
  for (const c of quiet) {
    if (!room(env, 4)) return;
    const [mine] = await sb(env, 'PATCH', `contacts?wa_id=eq.${q(c.wa_id)}&nudged_at=is.null&or=(busy_until.is.null,busy_until.lt.${iso(now)})`,
      { nudged_at: iso(now) });                                              // claimed first: never twice, never mid-turn
    // Waiting for the team (a question, a person, a call): no reminder, now or later (one would
    // land right after the team's reply).
    if (!mine || c.fields?.person_at || c.fields?.call_at) continue;
    if ((await sb(env, 'GET', `questions?wa_id=eq.${q(c.wa_id)}&status=eq.pending&select=id&limit=1`)).length) continue;
    await sendText(env, c.wa_id, t(c.lang, 'nudge'));
  }
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
    // a version replaced since: its newest version gets the win (three hops at most)
    for (let hop = 0, from = [...ids]; hop < 3 && from.length && room(env, 3); hop++) {
      const next = await sb<{ id: number; supersedes: number }>(env, 'GET', `knowledge?supersedes=in.(${from.slice(0, 20).join(',')})&select=id,supersedes`);
      for (const n of next) { ids.delete(n.supersedes); ids.add(n.id); }
      from = next.map((n) => n.id);
    }
    if (ids.size) for (const k of await sb<Knowledge>(env, 'GET', `knowledge?id=in.(${[...ids].slice(0, 20).join(',')})&select=id,wins`)) {
      if (!room(env, 2)) return;
      await sb(env, 'PATCH', `knowledge?id=eq.${k.id}`, { wins: (k.wins ?? 0) + 1 }, 'return=minimal');
    }
  }
}
