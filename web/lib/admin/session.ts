/** Session cryptography and live access checks, independent of Next's request context. */
export const SESSION_HOURS = 12;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const hmacKey = (secret: string) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signSession(email: string, secret: string, now = Date.now()) {
  const payload = b64u(enc.encode(JSON.stringify({ e: email, i: now, x: now + SESSION_HOURS * 3600_000 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${b64u(sig)}`;
}

export async function readSession(value: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!value || value.length > 4096 || !secret) return null;
  const [payload, sig, extra] = value.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(sig), enc.encode(payload)))) return null;
    const { e, i, x } = JSON.parse(dec.decode(unb64u(payload))) as { e?: unknown; i?: unknown; x?: unknown };
    return typeof e === 'string' && typeof i === 'number' && Number.isFinite(i) && i <= now &&
      typeof x === 'number' && Number.isFinite(x) && x > now && x > i && x - i <= SESSION_HOURS * 3600_000
      ? { email: e, issued: i } : null;
  } catch { return null; }
}

export async function authorizedSession(db: D1Database, value: string | undefined, secret: string | undefined, owners: readonly string[], now = Date.now()) {
  const session = await readSession(value, secret, now);
  if (!session) return null;
  const after = (await db.prepare('SELECT sessions_after FROM admin_security WHERE id = 1').first<number>('sessions_after')) ?? 0;
  if (session.issued <= after) return null;
  if (owners.includes(session.email)) return session.email;
  return await db.prepare('SELECT 1 FROM admin_emails WHERE email = ?').bind(session.email).first() ? session.email : null;
}
