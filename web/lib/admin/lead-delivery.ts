import 'server-only';
import { replyDeadline } from '../business-hours';
import { adminDb, type LeadRow, type LeadStatus } from './db';

export type DeliveryLead = LeadRow & { last_contact_at: string | null; delivery_status: 'pending' | 'delivered' | 'dead' | null; attempts: number | null; last_error: string | null };
export const LEAD_PAGE_SIZE = 50;

/** "YYYY-MM-DD HH:MM:SS" (D1's datetime('now'), UTC) as a time. */
export const d1Time = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);
/** When a lead's reply clock starts: the team's first alert for a WhatsApp chat, the arrival of a form lead. */
export const replyStart = (l: { created_at: string; wa_alerted_at?: string | null }) => d1Time(l.wa_alerted_at ?? l.created_at);
/** Met the promise (a reply by replyDeadline), missed it, or still within it / never sent to the team. */
export function promise(l: { source: string; created_at: string; wa_alerted_at?: string | null; first_reply_at?: string | null }, now = Date.now()) {
  if (l.source !== 'form' && !l.wa_alerted_at) return null;               // a chat the team was never told about
  const due = replyDeadline(new Date(replyStart(l))).getTime();
  if (l.first_reply_at) return d1Time(l.first_reply_at) <= due ? 'met' : 'missed';
  return now > due ? 'missed' : null;
}

/** The 2-hour promise (in working hours) over the last 30 days: enquiries it applied to, and how
 *  many were met. */
export async function replyStats() {
  const rows = (await (await adminDb()).prepare(`SELECT source, created_at, wa_alerted_at, first_reply_at FROM leads
    WHERE source != 'demo' AND created_at > datetime('now', '-30 days') LIMIT 5000`).all<{ source: string; created_at: string; wa_alerted_at: string | null; first_reply_at: string | null }>()
    .catch(() => ({ results: [] }))).results;
  const states = rows.map((l) => promise(l)).filter(Boolean);
  return { total: states.length, fast: states.filter((s) => s === 'met').length };
}

export async function leadPage(status: LeadStatus | undefined, requestedPage: number) {
  const db = await adminDb();
  const total = (await db.prepare('SELECT COUNT(*) AS n FROM leads WHERE (? IS NULL OR status = ?)')
    .bind(status ?? null, status ?? null).first<number>('n')) ?? 0;
  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, requestedPage));
  const { results } = await db.prepare(`SELECT l.*, o.status AS delivery_status, o.attempts, o.last_error
    FROM leads l LEFT JOIN lead_alert_outbox o ON o.lead_id = l.id
    WHERE (? IS NULL OR l.status = ?) ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`)
    .bind(status ?? null, status ?? null, LEAD_PAGE_SIZE, (page - 1) * LEAD_PAGE_SIZE).all<DeliveryLead>();
  return { leads: results, page, pages, total };
}
