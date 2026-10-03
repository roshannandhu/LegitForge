import { HONEYPOT, validateLead } from '../lead';
import { TURNSTILE_FIELD, verifyTurnstile } from '../turnstile';
import { alertsConfigured } from './lead-delivery';
import { leadHash, leadSignature, readReceipt, storeLead, validSubmissionId } from './lead-storage';

type LeadEnv = Partial<Pick<CloudflareEnv, 'DB' | 'HASH_SALT' | 'TURNSTILE_SECRET_KEY' | 'N8N_LEAD_WEBHOOK_URL' | 'N8N_SHARED_KEY' | 'SITE_URL'>>;
type Options = { env: LeadEnv | null; now?: () => number; verify?: typeof verifyTurnstile;
  contact?: { whatsapp?: string; email?: string }; onStored?: (id: string, service: string) => void };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Separated from Next's binding lookup so native/JSON paths run against real local D1 in tests. */
export async function handleLeadRequest(req: Request, options: Options): Promise<Response> {
  const accept = req.headers.get('accept') ?? '';
  const html = accept.includes('text/html') && !accept.includes('application/json');
  const reply = (body: Record<string, unknown>, status = 200) => {
    if (status >= 400) body = { ok: false, error: 'invalid-request', ...body, ...(status === 429 ? { retryAfter: 3600 } : {}) };
    const headers: Record<string, string> = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'content-type': html ? 'text/html; charset=utf-8' : 'application/json' };
    if (status === 429) headers['retry-after'] = '3600';
    if (!html) return new Response(JSON.stringify(body), { status, headers });
    const received = body.ok === true && body.stored === true;
    const errors = body.errors && typeof body.errors === 'object' ? Object.values(body.errors).map(String) : [];
    const messages: Record<string, string> = {
      verification_failed: 'We could not verify this request. With JavaScript disabled, please contact us on WhatsApp or by email.',
      'rate-limited': 'You have sent several requests in the last hour. Please contact us directly instead.',
      conflict: 'This request changed during a retry. Please return to the form and send the updated details.',
      'not-configured': 'We could not confirm receipt of your details. Please try again later or contact us directly.',
      unavailable: 'We could not confirm receipt of your details. Please try again; your first request may already have been received.',
      'bad-request': 'We could not read this form. Please return to the contact page and try again.',
      'too-large': 'This request is too large. Please keep your message under 1,500 characters.',
    };
    const message = received ? 'Your project details have been received. We will reply during our working hours.'
      : errors.length ? errors.join(' ') : messages[String(body.error)] ?? 'We could not confirm receipt. Please contact us directly.';
    const phone = options.contact?.whatsapp?.replace(/\D/g, '');
    const email = options.contact?.email;
    const contact = `${phone && /^\d{8,15}$/.test(phone) ? `<p><a href="https://wa.me/${phone}">Message us on WhatsApp</a></p>` : ''}
      ${email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? `<p><a href="mailto:${escape(email)}">Email us</a></p>` : ''}`;
    return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${received ? 'Details received' : 'Contact request'} | Legit Forge</title></head><body><main><h1>${received ? 'Details received' : 'Contact request'}</h1><p>${escape(message)}</p>${contact}<p><a href="/contact#contact">Return to the contact page</a></p></main></body></html>`, { status, headers });
  };
  let form: FormData;
  try {
    // Bound chunked bodies too; checking Content-Length alone is insufficient.
    const reader = req.body?.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); return reply({ error: 'too-large' }, 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
    form = await new Response(bytes, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData();
  } catch { return reply({ error: 'bad-request' }, 400); }
  if (String(form.get(HONEYPOT) ?? '').length) return reply({ error: 'invalid-request' }, 400);
  const { errors, lead } = validateLead(form);
  if (Object.keys(errors).length) return reply({ error: 'validation-failed', errors }, 422);
  const submitted = String(form.get('submission_id') ?? '').trim();
  if (submitted && !validSubmissionId(submitted)) return reply({ error: 'bad-request' }, 400);
  const env = options.env;
  if (!env?.DB || !env.HASH_SALT) return reply({ error: 'not-configured' }, 503);
  const now = (options.now ?? Date.now)();
  try {
    const hash = await leadHash(env.HASH_SALT, 'lead-payload', leadSignature(lead));
    const key = submitted ? `uuid:${submitted.toLowerCase()}` : `native:${hash}`;
    const existing = await readReceipt(env.DB, key, now);
    if (existing) return existing.request_hash === hash ? reply({ ok: true, stored: true, duplicate: true }) : reply({ error: 'conflict' }, 409);
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    if (env.TURNSTILE_SECRET_KEY) {
      let hostname = new URL(req.url).hostname;
      if (env.SITE_URL && !env.SITE_URL.includes('.example')) hostname = new URL(env.SITE_URL).hostname;
      const ok = await (options.verify ?? verifyTurnstile)(env.TURNSTILE_SECRET_KEY, String(form.get(TURNSTILE_FIELD) ?? ''), ip === 'unknown' ? undefined : ip,
        { hostname, action: 'lead', idempotencyKey: submitted || undefined });
      if (!ok) {
        const concurrent = await readReceipt(env.DB, key, now);
        return concurrent?.request_hash === hash ? reply({ ok: true, stored: true, duplicate: true }) : reply({ error: 'verification_failed' }, 400);
      }
    }
    // Preserve the old salted key so pre-deploy hourly rate history still counts.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + env.HASH_SALT));
    const rateKey = `lead:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    const result = await storeLead(env.DB, lead, key, hash, rateKey, now, alertsConfigured(env));
    if (!result.accepted) return reply({ error: result.conflict ? 'conflict' : 'rate-limited' }, result.conflict ? 409 : 429);
    if (!result.duplicate) try { options.onStored?.(result.id, lead.need); } catch { /* a saved lead survives scheduling failure */ }
    return reply({ ok: true, stored: true, duplicate: result.duplicate });
  } catch {
    console.error('[leads] storage unavailable');
    return reply({ error: 'unavailable' }, 503);
  }
}
