export type AlertEnv = Pick<CloudflareEnv, 'DB' | 'N8N_LEAD_WEBHOOK_URL' | 'N8N_SHARED_KEY'>;

export function alertsConfigured(env: Partial<AlertEnv> | null | undefined) {
  if (!env?.N8N_SHARED_KEY?.trim() || !env.N8N_LEAD_WEBHOOK_URL) return false;
  try {
    const u = new URL(env.N8N_LEAD_WEBHOOK_URL);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch { return false; }
}

type Job = { lead_id: string; attempts: number };
type AlertLead = { id: string; source: string; name: string | null; phone: string | null; service: string | null; budget: string | null; message: string | null; whatsapp_consent: number };
export const retryDelay = (attempt: number) => Math.min(3600_000, 60_000 * 2 ** Math.max(0, attempt - 1));

/** At-least-once delivery. n8n must upsert/deduplicate the stable lead ID: a response can be
 *  lost after it accepts the request. Atomic leases keep overlapping cron/request workers
 *  from actively sending the same job, and expire if a worker stops mid-delivery. */
export async function deliverLeadAlerts(env: AlertEnv, options: { now?: () => number; fetchImpl?: typeof fetch; limit?: number; leadId?: string } = {}) {
  const summary = { delivered: 0, failed: 0 };
  if (!alertsConfigured(env)) return summary;
  const clock = options.now ?? Date.now;
  const send = options.fetchImpl ?? fetch;
  // A worker can stop after taking its final lease. Exhausted expired leases must not
  // become a ninth send; the admin can explicitly reset a failed alert for another cycle.
  await env.DB.prepare(`UPDATE lead_alert_outbox SET status = 'dead', lease_token = NULL,
    lease_until = 0, last_error = 'attempts_exhausted', updated_at = ?
    WHERE status = 'pending' AND attempts >= 8 AND lease_until <= ?`)
    .bind(clock(), clock()).run();
  for (let n = 0; n < (options.limit ?? 5); n++) {
    const now = clock(), token = crypto.randomUUID();
    const claimed = await env.DB.prepare(`UPDATE lead_alert_outbox
      SET lease_token = ?, lease_until = ?, attempts = attempts + 1, updated_at = ?
      WHERE lead_id = (SELECT lead_id FROM lead_alert_outbox
        WHERE status = 'pending' AND attempts < 8 AND next_attempt_at <= ? AND lease_until <= ?
          AND (? IS NULL OR lead_id = ?) ORDER BY next_attempt_at,lead_id LIMIT 1)
      RETURNING lead_id,attempts`)
      .bind(token, now + 60_000, now, now, now, options.leadId ?? null, options.leadId ?? null).all<Job>();
    const job = claimed.results[0];
    if (!job) break;
    const lead = await env.DB.prepare('SELECT id,source,name,phone,service,budget,message,whatsapp_consent FROM leads WHERE id = ?').bind(job.lead_id).first<AlertLead>();
    if (!lead) continue; // deletion cascades the outbox job; never resurrect a removed enquiry
    let status = 0;
    try {
      const r = await send(env.N8N_LEAD_WEBHOOK_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'content-type': 'application/json', 'x-lf-key': env.N8N_SHARED_KEY, 'idempotency-key': lead.id },
        body: JSON.stringify({ ...lead, whatsapp_consent: lead.whatsapp_consent === 1 }),
      });
      status = r.status;
      await r.body?.cancel();
    } catch { /* record a bounded code, never response bodies, URLs, phones or credentials */ }
    const delivered = status >= 200 && status < 300;
    const retryable = status === 0 || status === 429 || status >= 500;
    const dead = !delivered && (!retryable || job.attempts >= 8);
    const at = clock();
    await env.DB.prepare(`UPDATE lead_alert_outbox SET status = ?, next_attempt_at = ?, lease_token = NULL,
      lease_until = 0, delivered_at = ?, last_error = ?, updated_at = ? WHERE lead_id = ? AND lease_token = ?`)
      .bind(delivered ? 'delivered' : dead ? 'dead' : 'pending', at + retryDelay(job.attempts), delivered ? at : null,
        delivered ? null : status ? `http_${status}` : 'network_error', at, lead.id, token).run();
    summary[delivered ? 'delivered' : 'failed']++;
  }
  return summary;
}
