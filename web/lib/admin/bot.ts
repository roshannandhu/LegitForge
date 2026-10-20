import 'server-only';
import { CHANNEL_SQL } from '@/lib/wa-services';
import { getEnv } from '../cf';
import { adminDb } from './db';

/** Admin → WhatsApp. The bot's own data (chats, learned answers, questions) lives in Supabase and
 *  is read through the bot's private RPC entrypoint (bot/admin.ts BotAdmin, the service binding
 *  BOT in wrangler.jsonc): the website holds no Supabase key. The types are restated here because
 *  app/ and lib/ never import bot/. Settings and saved replies are D1 (migration 0015). */

export interface ChatLine { at: string; who: 'client' | 'bot' | 'team' | 'alert'; body: string }
export interface Answer {
  id: number; question_en: string; answer_en: string; status: 'pending' | 'approved' | 'rejected' | 'superseded' | 'archived'; source: 'site' | 'team';
  wins: number; translations_ok: boolean; created_at: string; version: number | null; supersedes: number | null; review_at: string | null;
  decided_by: string | null; decided_at: string | null;
}
export interface OpenQuestion { id: number; code: string; name: string | null; lang: string | null; lead_id: string | null; question: string; question_en: string; kind: string; created_at: string }
export interface Health {
  unhandled: number; oldestUnhandled: string | null; lastIn: string | null; openQuestions: number; pendingAnswers: number;
  pastReview: number; withPerson: number; aiToday: number; aiCap: number;
}
type Done = { ok: true } | { error: string };
export type WhatsAppLink = { mode: 'cloud' } | { mode: 'baileys'; reachable: false; error: string }
  | { mode: 'baileys'; reachable: true; connected: boolean; me: string | null; since: string | null; qr: string | null };
export interface Insights {
  days: number; questions: number; byBot: number; byTeam: number; open: number;
  top: { question: string; count: number; byBot: number }[];
  answers: { approved: number; pending: number; rejected: number };
}
export interface FeedLine { at: string; who: ChatLine['who']; code: string | null; name: string | null; leadId: string | null; body: string }
export interface Monitor {
  transport: 'cloud' | 'baileys';
  link: WhatsAppLink;
  keys: { supabase: boolean; secret: boolean; groq: boolean; gemini: boolean; metaToken: boolean };
  vault?: { keys: number; providers: string[] };
  team: number;
  beats: Partial<Record<'cron' | 'hook' | 'badsig' | 'sbfail' | 'gw' | 'gwdown', { at: string; n: number }>>;
  gateway: { where: 'render' | 'laptop' | 'other' | null; seen: string | null };
  leads: { today: number; month: number };
  store: { ok: true; steps: Record<string, number>; modes: Record<string, number>; inToday: number; outToday: number; health: Health; recent: FeedLine[] }
    | { ok: false; error: string };
}
interface BotRpc {
  monitor(): Promise<Monitor>;
  chat(leadId: string): Promise<{ code: string; name: string | null; mode: string; lang: string | null; lines: ChatLine[] } | null>;
  answers(status?: Answer['status']): Promise<Answer[]>;
  history(id: number): Promise<Answer[]>;
  saveAnswer(v: { id?: number; question_en: string; answer_en: string; by: string; review_at?: string | null }): Promise<{ ok: true; id: number } | { error: string }>;
  setAnswer(id: number, on: boolean, by: string): Promise<Done>;
  archive(id: number, by: string): Promise<Done>;
  insights(days?: number): Promise<Insights>;
  openQuestions(): Promise<OpenQuestion[]>;
  answerQuestion(id: number, text: string, by: string): Promise<{ ok: true; note: string } | { error: string }>;
  health(): Promise<Health>;
  setMode(leadId: string, mode: 'human' | 'bot'): Promise<Done>;
  setLang(leadId: string, lang: string): Promise<Done>;
  whatsapp(): Promise<WhatsAppLink>;
  whatsappAdmin(action: 'pair' | 'logout', phone?: string): Promise<{ ok: true; code?: string } | { error: string }>;
}

/** The bot's reply languages (bot/text.ts LANGS, restated: lib/ never imports bot/). */
export const BOT_LANGS = [
  { key: 'en', name: 'English' }, { key: 'ml', name: 'Malayalam' }, { key: 'mg', name: 'Manglish' }, { key: 'hi', name: 'Hindi' }, { key: 'hg', name: 'Hinglish' },
  { key: 'kn', name: 'Kannada' }, { key: 'kg', name: 'Kanglish' }, { key: 'ta', name: 'Tamil' }, { key: 'tg', name: 'Tanglish' },
] as const;

/** The bot, or null where the binding is missing (`next dev`, or the bot not deployed yet). */
export async function bot(): Promise<BotRpc | null> {
  return ((await getEnv()) as unknown as { BOT?: BotRpc } | null)?.BOT ?? null;
}

/* ------------------------------------------------------------------ settings and saved replies */

export interface BotSettings { paused: boolean; away: string; afterHours: string }

export async function botSettings(): Promise<BotSettings> {
  const rows = (await (await adminDb()).prepare('SELECT key, value FROM bot_settings').all<{ key: string; value: string }>().catch(() => ({ results: [] }))).results;
  const v = new Map(rows.map((r) => [r.key, r.value]));
  return { paused: v.get('paused') === '1', away: v.get('away') ?? '', afterHours: v.get('after_hours') ?? '' };
}

export async function saveBotSettings(s: BotSettings) {
  const db = await adminDb();
  const put = db.prepare(`INSERT INTO bot_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  await db.batch([put.bind('paused', s.paused ? '1' : ''), put.bind('away', s.away), put.bind('after_hours', s.afterHours)]);
}

export interface SavedReply { key: string; text: string }
export const listReplies = async () =>
  (await (await adminDb()).prepare('SELECT key, text FROM bot_replies ORDER BY key').all<SavedReply>().catch(() => ({ results: [] as SavedReply[] }))).results;
export async function saveReply(r: SavedReply) {
  await (await adminDb()).prepare(`INSERT INTO bot_replies (key, text, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`).bind(r.key, r.text).run();
}
export async function deleteReply(key: string) {
  await (await adminDb()).prepare('DELETE FROM bot_replies WHERE key = ?').bind(key).run();
}

/* ------------------------------------------------------------------ regional phrases (D1 0017) */

export interface Phrase { id: number; lang: string; phrase: string; meaning: string; created_by: string | null }
export const listPhrases = async () =>
  (await (await adminDb()).prepare('SELECT id, lang, phrase, meaning, created_by FROM bot_phrases ORDER BY lang, phrase').all<Phrase>().catch(() => ({ results: [] as Phrase[] }))).results;
export async function savePhrase(p: { lang: string; phrase: string; meaning: string; by: string }) {
  await (await adminDb()).prepare(`INSERT INTO bot_phrases (lang, phrase, meaning, created_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(lang, phrase) DO UPDATE SET meaning = excluded.meaning, created_by = excluded.created_by`).bind(p.lang, p.phrase, p.meaning, p.by).run();
}
export async function deletePhrase(id: number) {
  await (await adminDb()).prepare('DELETE FROM bot_phrases WHERE id = ?').bind(id).run();
}

/* ------------------------------------------------------------------ the dashboard */

export interface Count { label: string; n: number }
/** The Monday a lead's week starts on (a Monday stays itself: 'weekday 1' alone would keep it,
 *  '-6 days' first makes Tuesday to Sunday go back to their Monday). Eight whole weeks. */
export const WEEK = "strftime('%Y-%m-%d', created_at, '-6 days', 'weekday 1')";
export interface Dashboard {
  total: number; won: number; lost: number;
  by: { service: Count[]; language: Count[]; source: Count[]; score: Count[]; status: Count[]; page: Count[] };
  weeks: { week: string; n: number; won: number }[];
}

/** Enquiries over the last `days` (demo leads left out): by service, language, source, score,
 *  status and page, and week on week. */
export async function dashboard(days = 90): Promise<Dashboard> {
  const db = await adminDb(), since = `-${Math.min(Math.max(Math.round(days), 1), 730)} days`;
  const by = async (col: string) => (await db.prepare(`SELECT COALESCE(${col}, '—') AS label, COUNT(*) AS n FROM leads
    WHERE source != 'demo' AND created_at > datetime('now', ?) GROUP BY 1 ORDER BY n DESC LIMIT 12`).bind(since).all<Count>()).results;
  const [service, language, source, score, status, page] = await Promise.all(['service', 'language', CHANNEL_SQL, 'score', 'status',
    "COALESCE(page, CASE source WHEN 'form' THEN 'Site form' END)"].map(by));
  const weeks = (await db.prepare(`SELECT ${WEEK} AS week, COUNT(*) AS n, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won
    FROM leads WHERE source != 'demo' AND created_at >= date('now', '-6 days', 'weekday 1', '-49 days') GROUP BY 1 ORDER BY 1`).all<{ week: string; n: number; won: number }>()).results;
  const n = (s: string) => status.find((x) => x.label === s)?.n ?? 0;
  return { total: status.reduce((a, x) => a + x.n, 0), won: n('won'), lost: n('lost'), by: { service, language, source, score, status, page }, weeks };
}
