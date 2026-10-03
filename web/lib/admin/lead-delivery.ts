import 'server-only';
import { adminDb, type LeadRow, type LeadStatus } from './db';

export type DeliveryLead = LeadRow & { last_contact_at: string | null; delivery_status: 'pending' | 'delivered' | 'dead' | null; attempts: number | null; last_error: string | null };
export const LEAD_PAGE_SIZE = 50;

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
