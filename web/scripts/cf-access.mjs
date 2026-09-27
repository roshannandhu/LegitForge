#!/usr/bin/env node
/** Locks /admin and /api/admin to the admin's own account with Cloudflare Access (PLAN §7.8),
 *  run by the deploy workflow after every deploy. Idempotent: creates or updates, never duplicates.
 *
 *    ADMIN_EMAIL=me@gmail.com SITE_URL=https://example.com node scripts/cf-access.mjs
 *    ... --dry-run    print what it would do (no token needed)
 *
 *  What it sets up, all named "Legit Forge admin":
 *   - the login method: Google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set (from
 *     Google Cloud Console, README "Admin"), else Cloudflare's One-time PIN (a code by email)
 *   - a policy that allows only ADMIN_EMAIL (comma-separate several)
 *   - a self-hosted Access application on <domain>/admin and <domain>/api/admin
 *   - the Worker secrets the app checks the login with: ACCESS_TEAM_DOMAIN, ACCESS_AUD and
 *     ADMIN_EMAILS (lib/admin/auth.ts; a second lock if the policy is ever widened)
 *
 *  Skips (and says why) without ADMIN_EMAIL, or while SITE_URL is a workers.dev address: Access
 *  can protect a path only on a domain in your Cloudflare account. The admin stays a 404 then.
 *  One manual step first: open Zero Trust once in the dashboard and pick a team name (free plan). */

import { cf, putSecret, requireCredentials } from './cf-api.mjs';

const NAME = 'Legit Forge admin';
const dry = process.argv.includes('--dry-run');
const { ADMIN_EMAIL = '', SITE_URL = '', GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

const emails = ADMIN_EMAIL.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const host = SITE_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const google = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (!emails.length) { console.log('Admin lock: skipped (set the repository variable ADMIN_EMAIL). /admin stays a 404.'); process.exit(0); }
if (!host || host.endsWith('.workers.dev')) {
  console.log('Admin lock: skipped until the site has its own domain (repository variable SITE_URL). /admin stays a 404.');
  process.exit(0);
}
const paths = [`${host}/admin`, `${host}/api/admin`];
if (dry) {
  console.log(`would allow only ${emails.join(', ')} on ${paths.join(' and ')}, signing in with ${google ? 'Google' : 'a one-time PIN by email'},\n` +
    'and set ACCESS_TEAM_DOMAIN, ACCESS_AUD and ADMIN_EMAILS on the Worker');
  process.exit(0);
}
requireCredentials();

// The Zero Trust team (its login domain signs the tokens the app verifies)
let team;
try { team = (await cf('GET', '/access/organizations')).auth_domain; } catch { /* no team yet */ }
if (!team) throw new Error('Zero Trust is not set up yet: open Zero Trust in the Cloudflare dashboard once and choose a team name (Free plan).');

// The login method: Google if its keys are given, else the one-time PIN
const idps = await cf('GET', '/access/identity_providers');
let idp;
if (google) {
  const body = { name: 'Google', type: 'google', config: { client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET } };
  const have = idps.find((i) => i.type === 'google');
  idp = have ? await cf('PUT', `/access/identity_providers/${have.id}`, body) : await cf('POST', '/access/identity_providers', body);
} else {
  idp = idps.find((i) => i.type === 'onetimepin') ?? await cf('POST', '/access/identity_providers', { name: 'One-time PIN', type: 'onetimepin', config: {} });
}
console.log(`Admin lock: sign-in with ${google ? 'Google' : 'a one-time PIN by email'}`);

// The policy: only these accounts
const policyBody = { name: NAME, decision: 'allow', include: emails.map((email) => ({ email: { email } })) };
const policies = await cf('GET', '/access/policies');
const oldPolicy = policies.find((p) => p.name === NAME);
const policy = oldPolicy ? await cf('PUT', `/access/policies/${oldPolicy.id}`, policyBody) : await cf('POST', '/access/policies', policyBody);
console.log(`Admin lock: allowed accounts: ${emails.length}`);

// The application on the two admin paths
const appBody = {
  name: NAME,
  type: 'self_hosted',
  domain: paths[0],
  destinations: paths.map((uri) => ({ type: 'public', uri })),
  allowed_idps: [idp.id],
  auto_redirect_to_identity: true,                 // straight to Google / the PIN form
  app_launcher_visible: false,
  session_duration: '24h',
  policies: [{ id: policy.id, precedence: 1 }],
};
const apps = await cf('GET', '/access/apps');
const oldApp = apps.find((a) => a.name === NAME);
const app = oldApp ? await cf('PUT', `/access/apps/${oldApp.id}`, appBody) : await cf('POST', '/access/apps', appBody);
console.log(`Admin lock: application on ${paths.join(' and ')}`);

// What the Worker checks every admin request against
await putSecret('ACCESS_TEAM_DOMAIN', team);
await putSecret('ACCESS_AUD', app.aud);
await putSecret('ADMIN_EMAILS', emails.join(','));
console.log('Admin lock: Worker secrets set (ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS)');
