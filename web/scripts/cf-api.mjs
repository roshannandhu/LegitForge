/** The Cloudflare REST API for the deploy scripts (cf-setup.mjs, cf-access.mjs), with
 *  CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from the environment. Never logs a body. */

export const WORKER = 'legitforge-web';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;

export function requireCredentials() {
  if (token && account) return;
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (GitHub → Settings → Secrets → Actions).');
  process.exit(1);
}

/** One call under /accounts/<id>; throws with Cloudflare's own error messages. */
export async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const why = (json.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${why}`);
  }
  return json.result;
}

/** A Worker secret (encrypted at Cloudflare, never printed). */
export const putSecret = (name, text) =>
  cf('PUT', `/workers/scripts/${WORKER}/secrets`, { name, text, type: 'secret_text' });
