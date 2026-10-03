import { getCloudflareContext, type CloudflareContext } from '@opennextjs/cloudflare';
import { getCompany } from '@/lib/company';
import { shownEmail } from '@/lib/site';
import { handleLeadRequest } from '@/lib/server/lead-http';
import { deliverLeadAlerts } from '@/lib/server/lead-delivery';
import { recordEvent } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let cf: CloudflareContext | null = null;
  try { cf = await getCloudflareContext({ async: true }); } catch { /* standalone Next has no bindings */ }
  const company = await getCompany().catch(() => null);
  return handleLeadRequest(req, {
    env: cf?.env ?? null,
    contact: company ? { whatsapp: company.whatsapp, email: shownEmail(company) } : undefined,
    onStored: (id, service) => {
      if (!cf) return;
      cf.ctx.waitUntil(deliverLeadAlerts(cf.env, { leadId: id, limit: 1 }).catch(() => console.error('[lead-alert] delivery interrupted; cron will retry')));
      const country = (req as Request & { cf?: { country?: string } }).cf?.country ?? null;
      cf.ctx.waitUntil(recordEvent(cf.env.DB, 'form_submit', { service }, country).catch(() => console.error('[analytics] form event unavailable')));
    },
  });
}
