#!/usr/bin/env node
/** First-time Cloudflare setup for the deploy workflow (.github/workflows/deploy-cloudflare.yml).
 *  Idempotent: finds or creates what wrangler.jsonc names, so every run can call it.
 *
 *    node scripts/cf-setup.mjs            before the build: D1, R2, the site URL
 *    node scripts/cf-setup.mjs --post     after the deploy: the HASH_SALT Worker secret, once
 *    node scripts/cf-setup.mjs --dry-run  print what it would do (no token needed)
 *
 *  Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Writes the D1 id and SITE_URL into
 *  wrangler.jsonc in the CI checkout only (never committed), and NEXT_PUBLIC_SITE_URL /
 *  NEXT_PUBLIC_NOINDEX to $GITHUB_ENV for the build. Never prints a secret. */

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { cf, putSecret, requireCredentials, WORKER } from './cf-api.mjs';

const D1 = 'legitforge';
const BUCKETS = ['legitforge-media', 'legitforge-next-cache'];
const ZERO_ID = '00000000-0000-0000-0000-000000000000';

const post = process.argv.includes('--post');
const dry = process.argv.includes('--dry-run');
const { GITHUB_ENV, SITE_URL } = process.env;

if (dry) {
  console.log(post
    ? `would set the HASH_SALT secret on ${WORKER} if it is missing`
    : `would find or create D1 "${D1}" and R2 ${BUCKETS.join(', ')}, write the D1 id and SITE_URL into wrangler.jsonc,\n` +
      `and export NEXT_PUBLIC_SITE_URL (${SITE_URL || `https://${WORKER}.<subdomain>.workers.dev`}) to the build`);
  process.exit(0);
}
requireCredentials();

if (post) {
  const secrets = await cf('GET', `/workers/scripts/${WORKER}/secrets`);
  if (secrets.some((s) => s.name === 'HASH_SALT')) console.log('HASH_SALT: already set');
  else {
    await putSecret('HASH_SALT', randomBytes(32).toString('hex'));
    console.log('HASH_SALT: set (random, never printed)');
  }
  process.exit(0);
}

// D1
let db = (await cf('GET', `/d1/database?name=${D1}`)).find((d) => d.name === D1);
if (db) console.log(`D1 ${D1}: exists`);
else { db = await cf('POST', '/d1/database', { name: D1 }); console.log(`D1 ${D1}: created`); }

// R2 (the account must have R2 enabled once in the dashboard)
const have = new Set(((await cf('GET', '/r2/buckets'))?.buckets ?? []).map((b) => b.name));
for (const name of BUCKETS) {
  if (have.has(name)) console.log(`R2 ${name}: exists`);
  else { await cf('POST', '/r2/buckets', { name }); console.log(`R2 ${name}: created`); }
}

// The site's address: the real domain once the SITE_URL repo variable is set, else workers.dev
let url = (SITE_URL ?? '').replace(/\/+$/, '');
if (!url) {
  const sub = (await cf('GET', '/workers/subdomain'))?.subdomain;
  if (!sub) throw new Error('This account has no workers.dev subdomain yet: open Workers & Pages once in the dashboard to create it.');
  url = `https://${WORKER}.${sub}.workers.dev`;
}
const noindex = url.endsWith('.workers.dev');

let cfg = await readFile('wrangler.jsonc', 'utf8');
cfg = cfg.replaceAll(ZERO_ID, db.uuid).replace(/("SITE_URL":\s*")[^"]*(")/, `$1${url}$2`);
await writeFile('wrangler.jsonc', cfg);
console.log(`wrangler.jsonc: D1 id and SITE_URL set (${url})`);

if (GITHUB_ENV) await appendFile(GITHUB_ENV, `NEXT_PUBLIC_SITE_URL=${url}\nNEXT_PUBLIC_NOINDEX=${noindex ? '1' : ''}\nLIVE_URL=${url}\n`);
console.log(noindex ? 'Search engines: kept out (temporary workers.dev address)' : 'Search engines: allowed');
