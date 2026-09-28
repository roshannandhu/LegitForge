/** Admin sign-in with Google (lib/admin/auth.ts).
 *  GET: a fresh nonce for Google's button, with its HttpOnly cookie. Google signs it into the ID
 *       token, so a token can't be replayed and only the page that asked can use it.
 *  POST { credential }: Google's ID token in; for an allowed email, the session cookie out.
 *       Same-origin only, and once per token. Signing out is signOutAction (app/admin/actions.ts). */

import { cookies } from 'next/headers';
import { getEnv } from '@/lib/cf';
import { isAllowed, NONCE_COOKIE, SESSION_COOKIE, SESSION_HOURS, signSession, verifyGoogleIdToken } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const COOKIE = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' };

export async function GET() {
  const nonce = crypto.randomUUID();
  (await cookies()).set(NONCE_COOKIE, nonce, { ...COOKIE, maxAge: 600 });
  return json({ nonce });
}

export async function POST(req: Request) {
  // only our own sign-in page may post here: another site's form or fetch carries its Origin
  const origin = req.headers.get('origin') ?? '';
  if (origin.replace(/^https?:\/\//, '') !== req.headers.get('host')) return json({ error: 'forbidden' }, 403);
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  jar.set(NONCE_COOKIE, '', { ...COOKIE, maxAge: 0 });      // single use, whatever happens next

  let credential: unknown;
  try {
    credential = ((await req.json()) as { credential?: unknown }).credential;
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  if (typeof credential !== 'string' || credential.length > 4096) return json({ error: 'bad-request' }, 400);

  const email = await verifyGoogleIdToken(credential, nonce);
  if (!email) return json({ error: 'invalid' }, 401);
  if (!(await isAllowed(email))) {
    console.warn('[admin] Google sign-in refused:', email);
    return json({ error: 'not-allowed' }, 403);
  }
  const env = await getEnv();
  if (!env?.ADMIN_SESSION_KEY || !env.DB) return json({ error: 'not-configured' }, 503);
  // each Google token signs in once: its nonce is the key of the sign-in log, so a copied token
  // is refused after the first use (old log rows are pruned in the same batch)
  const [logged] = await env.DB.batch([
    env.DB.prepare('INSERT INTO admin_sign_ins (nonce, email) VALUES (?, ?) ON CONFLICT (nonce) DO NOTHING').bind(nonce, email),
    env.DB.prepare("DELETE FROM admin_sign_ins WHERE at < datetime('now', '-90 days')"),
  ]);
  if (!logged.meta.changes) return json({ error: 'invalid' }, 401);
  jar.set(SESSION_COOKIE, await signSession(email, env.ADMIN_SESSION_KEY), { ...COOKIE, maxAge: SESSION_HOURS * 3600 });
  return json({ ok: true });
}
