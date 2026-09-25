/** POST /api/leads — the contact form (PLAN §6.11, §8.12).
 *
 *  Never silently drop a lead: with no database binding this returns 503 in production,
 *  so the visitor sees the error and the WhatsApp fallback instead of a false "Sent".
 *  Turnstile verification (§13.3) plugs in where marked once the widget exists. */

import { HONEYPOT, validateLead } from '@/lib/lead';

type D1 = {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } };
};

async function getDb(): Promise<D1 | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return ((env as Record<string, unknown>).DB as D1 | undefined) ?? null;
  } catch {
    return null;                                     // plain `next dev` has no bindings
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

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

  // TODO(§13.3): verify the Turnstile token here before touching the database.

  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === 'production') return json({ error: 'not-configured' }, 503);
    console.info('[leads] dev mode, no DB binding — lead validated but not stored:', { ...lead, phone: '***' });
    return json({ ok: true, stored: false });
  }

  // rate limit: 5 submissions per IP per hour (rate_events table, §8.8)
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const key = `lead:${ip}`;
  const hourAgo = Date.now() - 3_600_000;
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?')
    .bind(key, hourAgo).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return json({ error: 'rate-limited' }, 429);
  await db.prepare('INSERT INTO rate_events (key, at) VALUES (?, ?)').bind(key, Date.now()).run();

  await db.prepare(
    `INSERT INTO leads (id, source, name, phone, service, budget, message, whatsapp_consent)
     VALUES (?, 'form', ?, ?, ?, ?, ?, 1)`,
  ).bind(crypto.randomUUID(), lead.name, lead.phone, lead.need, lead.budget || null, lead.message || null).run();

  return json({ ok: true, stored: true });
}
