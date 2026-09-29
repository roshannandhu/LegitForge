import 'server-only';
import { getEnv } from '@/lib/cf';
import { SITE } from '@/lib/site';
import { getGithubApp, saveGithubApp } from '@/lib/admin/db';
import type { RepoRef } from '@/lib/admin/github';

/** Private repos for "Add from GitHub": a GitHub App that each team member installs on their own
 *  GitHub account, choosing the repos it may read (code and details, read-only). They can remove
 *  it any time in GitHub → Settings → Applications. An owner creates the app once from Admin →
 *  Projects with GitHub's manifest flow: GitHub hands its ID and private key straight to this
 *  server, which keeps the key in D1 encrypted with ADMIN_SESSION_KEY; nobody copies a key.
 *  Reading a private repo: a JWT signed with the key → the owner account's installation → a
 *  one-hour token for that one repo (5,000 API requests an hour per installation). */

const API = 'https://api.github.com';
const enc = new TextEncoder();
const b64u = (b: Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

/* ---------------------------------------------------------------- keys (pure: secrets passed in) */

/** GitHub hands out PKCS#1 keys ("BEGIN RSA PRIVATE KEY"); WebCrypto imports only PKCS#8, which is
 *  the same key wrapped in a fixed ASN.1 header: SEQUENCE { 0, rsaEncryption, OCTET STRING key }. */
export function pkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const der = unb64u(pem.replace(/-----[^-]+-----|\s/g, ''));
  if (!/BEGIN RSA PRIVATE KEY/.test(pem)) return der;
  const len = (n: number) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]);
  const rsa = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const body = [0x02, 0x01, 0x00, ...rsa, 0x04, ...len(der.length), ...der];
  return Uint8Array.from([0x30, ...len(body.length), ...body]);
}

/** The app's own 9-minute JWT (RS256), how GitHub knows a request comes from the app. */
export async function appJwt(appId: number, pem: string, now = Date.now()) {
  const key = await crypto.subtle.importKey('pkcs8', pkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const t = Math.floor(now / 1000);
  const data = `${b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64u(JSON.stringify({ iat: t - 60, exp: t + 540, iss: String(appId) }))}`;
  return `${data}.${b64u(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(data))))}`;
}

const aesKey = async (secret: string) =>
  crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(`github-app|${secret}`)), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(text: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `${b64u(iv)}.${b64u(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(text))))}`;
}

export async function unseal(sealed: string, secret: string) {
  const [iv, ct] = sealed.split('.').map(unb64u);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(secret), ct));
}

const hmacKey = (secret: string) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** The manifest flow's `state`: time + HMAC of (who, time), so GitHub's redirect back is only
 *  accepted for the owner who started it, within an hour. No cookie needed. */
export async function signState(who: string, secret: string, now = Date.now()) {
  return `${now}.${b64u(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`github-app|${who}|${now}`))))}`;
}

export async function checkState(state: string, who: string, secret: string, now = Date.now()) {
  const [t, sig, extra] = state.split('.');
  const at = Number(t);
  if (!sig || extra !== undefined || !Number.isInteger(at) || now - at > 3600_000 || at - now > 60_000) return false;
  try { return await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(sig), enc.encode(`github-app|${who}|${at}`)); }
  catch { return false; }
}

/* ---------------------------------------------------------------- GitHub */

async function secret() {
  const s = (await getEnv())?.ADMIN_SESSION_KEY;
  if (!s) throw new Error('ADMIN_SESSION_KEY is not set');
  return s;
}

async function api<T>(path: string, auth?: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json', 'user-agent': 'legitforge-admin', 'x-github-api-version': '2022-11-28',
      ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}

type App = { id: number; slug: string; owner: string; pem: string };

/** The connected app, or null (not connected yet, or ADMIN_SESSION_KEY changed: connect again). */
async function loadApp(): Promise<App | null> {
  const row = await getGithubApp().catch(() => null);
  if (!row) return null;
  try { return { id: row.app_id, slug: row.slug, owner: row.owner, pem: await unseal(row.key_enc, await secret()) }; }
  catch { return null; }
}

export const installUrl = (slug: string) => `https://github.com/apps/${slug}/installations/new`;

/** What an owner posts to GitHub to create the app (Admin → Projects → Connect GitHub). */
export async function connectForm(who: string) {
  return {
    action: `https://github.com/settings/apps/new?state=${encodeURIComponent(await signState(who, await secret()))}`,
    manifest: JSON.stringify({
      name: 'Legit Forge Projects',
      url: SITE.url,
      description: 'Reads the repos you choose so Legit Forge can add them to its portfolio. Read-only.',
      public: true,                                  // so each team member can install it on their own account
      redirect_url: `${SITE.url}/admin/github`,
      hook_attributes: { url: SITE.url, active: false },
      default_permissions: { contents: 'read', metadata: 'read' },
      default_events: [],
    }),
  };
}

export class ConnectError extends Error {}

/** GitHub's redirect back: turns the one-time `code` into the app's ID and key (the admin's browser
 *  may already have done it: `fetched`, since the server's shared IPs are often out of
 *  unauthenticated API requests), proves the key works (GET /app as the app), and stores it. */
export async function connectApp(code: string, fetched: string | undefined, who: string) {
  let conv: { id?: unknown; slug?: unknown; pem?: unknown } | null = null;
  try { conv = fetched ? JSON.parse(fetched) : null; } catch { conv = null; }
  if (!conv?.pem) {
    if (!/^[\w-]{1,100}$/.test(code)) throw new ConnectError('GitHub’s answer is missing. Press Connect GitHub again.');
    conv = (await api<typeof conv>(`/app-manifests/${code}/conversions`, undefined, { method: 'POST' })).data;
  }
  const id = Number(conv?.id), pem = typeof conv?.pem === 'string' ? conv.pem : '';
  if (!Number.isInteger(id) || id <= 0 || !/-----BEGIN (RSA )?PRIVATE KEY-----/.test(pem) || pem.length > 10_000) {
    throw new ConnectError('GitHub didn’t confirm the app (the link may have been used already). Press Connect GitHub again.');
  }
  const me = await api<{ id: number; slug: string; owner?: { login?: string } }>('/app', await appJwt(id, pem));
  if (me.data?.id !== id || !/^[a-z0-9-]{1,100}$/.test(me.data.slug)) throw new ConnectError('GitHub didn’t accept the new app’s key. Press Connect GitHub again.');
  await saveGithubApp({ app_id: id, slug: me.data.slug, owner: me.data.owner?.login ?? '', key_enc: await seal(pem, await secret()), connected_by: who });
}

/** For Admin → Projects: the link team members approve access with, and who already has. */
export async function githubAccess(): Promise<{ installUrl: string; accounts: string[] | null } | null> {
  const app = await loadApp();
  if (!app) return null;
  const list = await api<{ account?: { login?: string } }[]>('/app/installations?per_page=100', await appJwt(app.id, app.pem)).catch(() => null);
  return {
    installUrl: installUrl(app.slug),
    accounts: list?.data ? list.data.map((i) => i.account?.login ?? '').filter(Boolean) : null,
  };
}

export type PrivateAccess = { token: string } | { error: string; link?: string };

/** A one-hour, read-only token for one private repo, if its owner approved it; else what to do. */
export async function privateRepoAccess(ref: RepoRef): Promise<PrivateAccess> {
  const app = await loadApp().catch(() => null);
  if (!app) {
    return { error: `GitHub shows no public repository at ${ref.owner}/${ref.repo}. If it is private, an owner presses Connect GitHub under Private repos (below), then ${ref.owner} approves the repo.` };
  }
  const notYet = { error: `${ref.owner} hasn’t given Legit Forge access to ${ref.repo} yet (or the link is wrong). Send them this link: they choose ${ref.repo}, press Install (or Save), and you press Create project again.`, link: installUrl(app.slug) };
  try {
    const jwt = await appJwt(app.id, app.pem);
    const inst = await api<{ id: number }>(`/repos/${ref.owner}/${ref.repo}/installation`, jwt);
    if (inst.status === 404) return notYet;
    if (!inst.data) return { error: 'GitHub didn’t answer just now. Try again, or create the project from its name and fill in the rest.' };
    const tok = await api<{ token: string }>(`/app/installations/${inst.data.id}/access_tokens`, jwt, {
      method: 'POST', body: JSON.stringify({ repositories: [ref.repo], permissions: { contents: 'read', metadata: 'read' } }),
    });
    return tok.data?.token ? { token: tok.data.token } : notYet;
  } catch {
    return { error: 'GitHub didn’t answer just now. Try again, or create the project from its name and fill in the rest.' };
  }
}
