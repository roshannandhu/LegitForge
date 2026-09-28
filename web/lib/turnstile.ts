/** Cloudflare Turnstile, server side (PLAN §8.12, §13.3). The widget's token arrives in the
 *  form as `cf-turnstile-response`; it is single-use and valid for 5 minutes. */

export const TURNSTILE_FIELD = 'cf-turnstile-response';

export async function verifyTurnstile(secret: string, token: string, ip?: string) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;                                   // fail closed: the visitor still has WhatsApp
  }
}
