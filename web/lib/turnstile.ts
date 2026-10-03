/** Cloudflare Turnstile, server side (PLAN §8.12, §13.3). The widget's token arrives in the
 *  form as `cf-turnstile-response`; it is single-use and valid for 5 minutes. */

export const TURNSTILE_FIELD = 'cf-turnstile-response';

export async function verifyTurnstile(secret: string, token: string, ip?: string, options: {
  hostname?: string; action?: string; idempotencyKey?: string; fetchImpl?: typeof fetch;
} = {}) {
  if (!token || token.length > 2048) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  if (options.idempotencyKey) body.append('idempotency_key', options.idempotencyKey);
  try {
    const res = await (options.fetchImpl ?? fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
    return data.success === true && (!options.hostname || data.hostname === options.hostname)
      && (!options.action || data.action === options.action);
  } catch {
    return false;                                   // fail closed: the visitor still has WhatsApp
  }
}
