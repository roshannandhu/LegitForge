import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getEnv } from '@/lib/cf';

/** Who may use /admin (PLAN §7.8, §13.2). Cloudflare Access sits in front of /admin* and
 *  /api/admin* and adds a signed JWT to every request; we verify it again here, so a
 *  misconfigured Access policy never opens the admin.
 *
 *  Local development: ADMIN_DEV_BYPASS=1 in .dev.vars, and only on localhost or 127.0.0.1,
 *  so it can never pass on a real domain. */

type Jwk = JsonWebKey & { kid: string };
let certs: { at: number; team: string; keys: Jwk[] } | null = null;

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

async function accessKeys(team: string) {
  if (certs && certs.team === team && Date.now() - certs.at < 3600_000) return certs.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`access certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  certs = { at: Date.now(), team, keys };
  return keys;
}

/** The signed-in email when the Access JWT is valid for this app, else null. */
export async function verifyAccessJwt(token: string, team: string, aud: string): Promise<string | null> {
  try {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg: string; kid: string };
    const claims = JSON.parse(new TextDecoder().decode(b64url(p))) as { aud: string | string[]; exp: number; nbf?: number; iss: string; email?: string };
    if (header.alg !== 'RS256') return null;
    const jwk = (await accessKeys(team)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    const now = Date.now() / 1000;
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!ok || !auds.includes(aud) || claims.exp < now || (claims.nbf ?? 0) > now + 60 || claims.iss !== `https://${team}`) return null;
    return claims.email ?? 'access-user';
  } catch {
    return null;
  }
}

/** The admin's email, or null. For route handlers: answer 403 on null. */
export async function adminIdentity(): Promise<string | null> {
  const h = await headers();
  const env = await getEnv();
  const host = (h.get('host') ?? '').replace(/:\d+$/, '');
  const bypass = env?.ADMIN_DEV_BYPASS || process.env.ADMIN_DEV_BYPASS;
  if (bypass === '1' && (host === 'localhost' || host === '127.0.0.1')) return 'dev@localhost';

  const token = h.get('cf-access-jwt-assertion');
  const team = env?.ACCESS_TEAM_DOMAIN, aud = env?.ACCESS_AUD;
  if (!token || !team || !aud) return null;
  return verifyAccessJwt(token, team, aud);
}

/** For pages and Server Actions: a 404 for anyone else, so the admin's existence isn't shown. */
export async function requireAdmin(): Promise<string> {
  const who = await adminIdentity();
  if (!who) notFound();
  return who;
}
