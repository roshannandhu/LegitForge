import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/cf';
import { GOOGLE_CLIENT_ID } from './google';

/** Who may use /admin (PLAN §7.8): Google sign-in (the owner's call, 28 Sep).
 *
 *  /admin/sign-in shows Google's button; Google hands the browser a signed ID token, and
 *  POST /api/admin/session checks it (Google's keys, our client ID, a verified email, the nonce
 *  we issued) before it sets a signed session cookie, for an allowed email only. Every admin
 *  page, Server Action and route checks that cookie AND the allow-list again, so removing an
 *  email in Admin → Access ends that person's access on their next click.
 *
 *  Allowed: the owners in the ADMIN_EMAILS secret (comma-separated; they can't be removed from
 *  the admin) plus the emails added in Admin → Access (D1 admin_emails). Nobody when both are
 *  empty. The session key is the ADMIN_SESSION_KEY secret (random; scripts/cf-setup.mjs).
 *
 *  Each Google token signs in once only (D1 admin_sign_ins, also the sign-in log), and "Sign out
 *  everywhere" (D1 admin_security) ends every session at once. Only owners manage Access.
 *
 *  Local development: ADMIN_DEV_BYPASS=1 in .dev.vars, only under `next dev` and only on
 *  localhost or 127.0.0.1, so it can never pass on a real domain or in a production build. */

export const SESSION_COOKIE = '__Host-lf_admin';
export const NONCE_COOKIE = '__Host-lf_nonce';
export const SESSION_HOURS = 12;
const DEV_ADMIN = 'dev@localhost';

const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** The session cookie: base64url JSON { e: email, i: issued, x: expiry, both ms } + "." + its HMAC-SHA256. */
export async function signSession(email: string, secret: string, now = Date.now()) {
  const payload = b64u(enc.encode(JSON.stringify({ e: email, i: now, x: now + SESSION_HOURS * 3600_000 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${b64u(sig)}`;
}

/** A session cookie we signed and that has not expired: its email and when it was issued, else null. */
export async function readSession(value: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!value || !secret) return null;
  const [payload, sig, extra] = value.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(sig), enc.encode(payload)))) return null;
    const { e, i, x } = JSON.parse(dec.decode(unb64u(payload))) as { e?: unknown; i?: unknown; x?: unknown };
    return typeof e === 'string' && typeof x === 'number' && x > now ? { email: e, issued: typeof i === 'number' ? i : 0 } : null;
  } catch {
    return null;
  }
}

type Jwk = JsonWebKey & { kid: string };
let certs: { at: number; keys: Jwk[] } | null = null;

async function googleKey(kid: string) {
  const find = () => certs?.keys.find((k) => k.kid === kid) ?? null;
  const age = certs ? Date.now() - certs.at : Infinity;
  if (age < 3600_000 && find()) return find();
  // stale, or a key id we don't know (Google rotates its keys): refetch, but at most once a
  // minute, so forged tokens with made-up key ids can't make us hammer Google
  if (age > 60_000) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) throw new Error(`google certs ${res.status}`);
    certs = { at: Date.now(), keys: ((await res.json()) as { keys: Jwk[] }).keys };
  }
  return find();
}

/** The verified email in a Google ID token issued to OUR client for THIS nonce, else null. */
export async function verifyGoogleIdToken(token: string, nonce: string | undefined): Promise<string | null> {
  if (!nonce) return null;
  try {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(dec.decode(unb64u(h))) as { alg?: string; kid?: string };
    const c = JSON.parse(dec.decode(unb64u(p))) as {
      iss?: string; aud?: string; exp?: number; nbf?: number; iat?: number; email?: string; email_verified?: boolean; nonce?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;
    const jwk = await googleKey(header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`)))) return null;
    const now = Date.now() / 1000;
    if (c.aud !== GOOGLE_CLIENT_ID || (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com')) return null;
    if (typeof c.exp !== 'number' || c.exp < now || (c.nbf ?? 0) > now + 60 || (c.iat ?? 0) > now + 60) return null;
    if (c.email_verified !== true || typeof c.email !== 'string' || c.nonce !== nonce) return null;
    return c.email.toLowerCase();
  } catch {
    return null;
  }
}

/** The owners (ADMIN_EMAILS secret): always allowed, never removable in the admin. */
export async function ownerEmails() {
  const env = await getEnv();
  return (env?.ADMIN_EMAILS || process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Only owners may change who can sign in (Admin → Access). The dev bypass counts as one. */
export async function isOwner(email: string) {
  return (process.env.NODE_ENV === 'development' && email === DEV_ADMIN) || (await ownerEmails()).includes(email);
}

/** An owner, or an email added in Admin → Access. */
export async function isAllowed(email: string) {
  if ((await ownerEmails()).includes(email)) return true;
  const db = (await getEnv())?.DB;
  return !!(db && (await db.prepare('SELECT 1 FROM admin_emails WHERE email = ?').bind(email).first()));
}

/** The admin's email, or null. For route handlers: answer 403 on null. */
export const adminIdentity = cache(async (): Promise<string | null> => {
  const env = await getEnv();
  // `next dev` only. NODE_ENV is inlined at build time, so a production bundle has no bypass at
  // all, whatever .env files or variables it was built or deployed with.
  if (process.env.NODE_ENV === 'development') {
    const host = ((await headers()).get('host') ?? '').replace(/:\d+$/, '');
    const bypass = env?.ADMIN_DEV_BYPASS || process.env.ADMIN_DEV_BYPASS;
    if (bypass === '1' && (host === 'localhost' || host === '127.0.0.1')) return DEV_ADMIN;
  }

  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value, env?.ADMIN_SESSION_KEY);
  if (!session || !env?.DB) return null;
  // "Sign out everywhere" refuses every session issued before it
  const after = (await env.DB.prepare('SELECT sessions_after FROM admin_security WHERE id = 1').first<number>('sessions_after')) ?? 0;
  if (session.issued <= after) return null;
  return (await isAllowed(session.email)) ? session.email : null;
});

/** For pages and Server Actions: anyone not signed in goes to the Google sign-in page. */
export async function requireAdmin(): Promise<string> {
  const who = await adminIdentity();
  if (!who) redirect('/admin/sign-in');
  return who;
}
