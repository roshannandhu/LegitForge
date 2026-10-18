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
  id: number; question_en: string; answer_en: string; status: 'pending' | 'approved' | 'rejected'; source: 'site' | 'team';
  wins: number; translations_ok: boolean; created_at: string;
}
export interface Insights {
  days: number; questions: number; byBot: number; byTeam: number; open: number;
  top: { question: string; count: number; byBot: number }[];
  answers: { approved: number; pending: number; rejected: number };
}
interface BotRpc {
  chat(leadId: string): Promise<{ code: string; name: string | null; lines: ChatLine[] } | null>;
  answers(status?: Answer['status']): Promise<Answer[]>;
  saveAnswer(v: { id?: number; question_en: string; answer_en: string; by: string }): Promise<{ ok: true; id: number } | { error: string }>;
  setAnswer(id: number, on: boolean, by: string): Promise<{ ok: true } | { error: string }>;
  insights(days?: number): Promise<Insights>;
}

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
