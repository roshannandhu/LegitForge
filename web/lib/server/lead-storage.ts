import type { Lead } from '../lead';

export const RECEIPT_TTL = 24 * 3600_000;
const WINDOW = 3600_000;
const enc = new TextEncoder();

/** Domain-separated HMACs: neither raw IPs nor guessable unsalted personal-data hashes. */
export async function leadHash(secret: string, purpose: string, value: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, enc.encode(`${purpose}|${value}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const leadSignature = (lead: Lead) => JSON.stringify([lead.name, lead.phone, lead.need, lead.budget, lead.message]);
export const validSubmissionId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export type Receipt = { request_hash: string; lead_id: string; expires_at: number };

export async function readReceipt(db: D1Database, key: string, now: number) {
  return db.prepare('SELECT request_hash, lead_id, expires_at FROM lead_receipts WHERE submission_key = ? AND expires_at > ?')
    .bind(key, now).first<Receipt>();
}

export type StoreResult = { accepted: true; duplicate: boolean; id: string } | { accepted: false; conflict: boolean };

/** A single transaction: the count is part of the write, so simultaneous requests cannot all
 *  pass a detached rate check. An attempt UUID gates each dependent write; a replay creates
 *  no extra lead, rate event or outbox job. Keep legacy rate_events in the same hourly count. */
export async function storeLead(db: D1Database, lead: Lead, key: string, hash: string, rateKey: string, now: number, alert: boolean): Promise<StoreResult> {
  const attempt = crypto.randomUUID();
  const results = await db.batch([
    db.prepare('DELETE FROM lead_receipts WHERE submission_key = ? AND expires_at <= ?').bind(key, now),
    db.prepare(`INSERT INTO leads (id,source,name,phone,service,budget,message,whatsapp_consent)
      SELECT ?, 'form', ?, ?, ?, ?, ?, 1
      WHERE NOT EXISTS (SELECT 1 FROM lead_receipts WHERE submission_key = ?)
        AND (SELECT COUNT(*) FROM rate_events WHERE key = ? AND at > ?) < 5`)
      .bind(attempt, lead.name, lead.phone, lead.need, lead.budget || null, lead.message || null, key, rateKey, now - WINDOW),
    db.prepare(`INSERT INTO lead_receipts(submission_key,request_hash,lead_id,accepted_at,expires_at)
      SELECT ?, ?, id, ?, ? FROM leads WHERE id = ?`)
      .bind(key, hash, now, now + RECEIPT_TTL, attempt),
    db.prepare(`INSERT INTO rate_events(key,at,receipt_id)
      SELECT ?, ?, lead_id FROM lead_receipts WHERE lead_id = ?`)
      .bind(rateKey, now, attempt),
    db.prepare(`INSERT INTO lead_alert_outbox(lead_id,next_attempt_at,updated_at)
      SELECT id, ?, ? FROM leads WHERE id = ? AND ? = 1`)
      .bind(now, now, attempt, alert ? 1 : 0),
    db.prepare('SELECT request_hash,lead_id,expires_at FROM lead_receipts WHERE submission_key = ?').bind(key),
  ]);
  const receipt = results[5].results[0] as Receipt | undefined;
  if (!receipt) return { accepted: false, conflict: false };
  if (receipt.request_hash !== hash) return { accepted: false, conflict: true };
  return { accepted: true, duplicate: !results[1].meta.changes, id: receipt.lead_id };
}
