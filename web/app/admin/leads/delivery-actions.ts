'use server';

import { revalidatePath } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireAdmin } from '@/lib/admin/auth';
import { adminDb } from '@/lib/admin/db';
import { alertsConfigured, deliverLeadAlerts } from '@/lib/server/lead-delivery';

/** Only an authenticated admin explicitly starts another delivery cycle. */
export async function retryLeadAlertAction(id: string) {
  await requireAdmin();
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!alertsConfigured(env)) throw new Error('Lead notifications are not configured. The enquiry remains saved here.');
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO lead_alert_outbox(lead_id,next_attempt_at,updated_at)
    SELECT id, ?, ? FROM leads WHERE id = ?
    ON CONFLICT(lead_id) DO UPDATE SET status = 'pending', attempts = 0, next_attempt_at = excluded.next_attempt_at,
      last_error = NULL, lease_token = NULL, lease_until = 0, updated_at = excluded.updated_at
    WHERE lead_alert_outbox.status = 'dead' OR
      (lead_alert_outbox.status = 'pending' AND lead_alert_outbox.lease_until <= ?)`)
    .bind(now, now, id, now).run();
  ctx.waitUntil(deliverLeadAlerts(env, { leadId: id, limit: 1 }).catch(() => console.error('[lead-alert] manual retry interrupted')));
  revalidatePath('/admin/leads');
}

/** Manual contact evidence; changing a pipeline status alone does not claim a conversation. */
export async function markLeadContactedAction(id: string) {
  await requireAdmin();
  await (await adminDb()).prepare("UPDATE leads SET last_contact_at = datetime('now') WHERE id = ?").bind(id).run();
  revalidatePath('/admin/leads');
}
