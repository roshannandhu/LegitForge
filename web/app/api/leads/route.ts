/** POST /api/leads — the contact form (PLAN §6.11, §8.12).
 *
 *  Never silently drop a lead: with no database binding this returns 503 in production,
 *  so the visitor sees the error and the WhatsApp fallback instead of a false "Sent".
 *  The lead is stored first; the n8n alert (WF-2) runs after the response and can fail
 *  without losing it. Turnstile (§13.3) is enforced whenever TURNSTILE_SECRET_KEY is set. */

import { getCloudflareContext, type CloudflareContext } from '@opennextjs/cloudflare';
import { HONEYPOT, validateLead } from '@/lib/lead';
import { TURNSTILE_FIELD, verifyTurnstile } from '@/lib/turnstile';

async function getContext(): Promise<CloudflareContext | null> {
  try {
    return await getCloudflareContext({ async: true });
  } catch {
    return null;                                     // `next build` has no bindings
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'bad-request' }, 400);
  }

  // honeypot: pretend success so the bot moves on, store nothing
  if (String(form.get(HONEYPOT) ?? '').length > 0) return json({ ok: true });

  const { errors, lead } = validateLead(form);
  if (Object.keys(errors).length) return json({ errors }, 422);

  const cf = await getContext();
  // secrets are typed as strings by cf-typegen, but may be unset: every use has a fallback
  const env = cf?.env;
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';

  // Turnstile (§13.3): enforced as soon as the secret exists, before anything is stored
  if (env?.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, String(form.get(TURNSTILE_FIELD) ?? ''), ip);
    if (!ok) return json({ error: 'verification_failed' }, 400);
  }

  const db = env?.DB;
  if (!db) {
    if (process.env.NODE_ENV === 'production') return json({ error: 'not-configured' }, 503);
    console.info('[leads] dev mode, no DB binding — lead validated but not stored:', { ...lead, phone: '***' });
    return json({ ok: true, stored: false });
  }

  // rate limit: 5 submissions per IP per hour (rate_events, §8.8). The IP is hashed, never stored.
  const key = `lead:${await sha256Hex(ip + (env.HASH_SALT ?? ''))}`;
  const now = Date.now();
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?')
    .bind(key, now - 3_600_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return json({ error: 'rate-limited' }, 429);

  const id = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO rate_events (key, at) VALUES (?, ?)').bind(key, now),
    db.prepare(
      `INSERT INTO leads (id, source, name, phone, service, budget, message, whatsapp_consent)
       VALUES (?, 'form', ?, ?, ?, ?, ?, 1)`,
    ).bind(id, lead.name, lead.phone, lead.need, lead.budget || null, lead.message || null),
  ]);

  // WF-2 alert (§9): after the response, so a slow or broken n8n never costs a lead
  if (env.N8N_LEAD_WEBHOOK_URL) {
    cf!.ctx.waitUntil(
      fetch(env.N8N_LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-lf-key': env.N8N_SHARED_KEY ?? '' },
        body: JSON.stringify({ id, source: 'form', ...lead }),
      }).then(
        (r) => { if (!r.ok) console.error('[leads] alert webhook returned', r.status); },
        (err) => console.error('[leads] alert webhook failed', err),
      ),
    );
  }

  return json({ ok: true, stored: true });
}
