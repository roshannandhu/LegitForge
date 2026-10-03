#!/usr/bin/env node
/** First-time Cloudflare setup for the deploy workflow (.github/workflows/deploy-cloudflare.yml).
 *  Idempotent: finds or creates what wrangler.jsonc names, so every run can call it.
 *
 *    node scripts/cf-setup.mjs            after local release gates, before deploy: D1, R2, Pages, site URL
 *    node scripts/cf-setup.mjs --post     after the deploy: the HASH_SALT and ADMIN_SESSION_KEY Worker secrets, once
 *    node scripts/cf-setup.mjs --dry-run  print what it would do (no token needed)
 *
 *  Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Writes the D1 id and SITE_URL into
 *  wrangler.jsonc in the CI checkout only (never committed). The workflow supplies the same
 *  canonical NEXT_PUBLIC_SITE_URL before its checked build; exported values must agree with it.
 *  Never prints a secret. */

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { cf, putSecret, requireCredentials, WORKER } from './cf-api.mjs';

const D1 = 'legitforge';
const BUCKETS = ['legitforge-media', 'legitforge-next-cache'];
const PAGES = 'legitforge';                       // the frontend, cf-pages/wrangler.jsonc "name"
const ZERO_ID = '00000000-0000-0000-0000-000000000000';

const post = process.argv.includes('--post');
const dry = process.argv.includes('--dry-run');
const { GITHUB_ENV, SITE_URL } = process.env;

if (dry) {
  console.log(post
    ? `would set the HASH_SALT and ADMIN_SESSION_KEY secrets on ${WORKER} if they are missing`
    : `would find or create D1 "${D1}", R2 ${BUCKETS.join(', ')} and Pages "${PAGES}", write the D1 id and SITE_URL into wrangler.jsonc,\n` +
      `and export NEXT_PUBLIC_SITE_URL (${SITE_URL || `https://${PAGES}.pages.dev`}) to the build`);
  process.exit(0);
}
requireCredentials();

if (post) {
  const set = new Set((await cf('GET', `/workers/scripts/${WORKER}/secrets`)).map((s) => s.name));
  // random, set once: HASH_SALT (rate limiter), ADMIN_SESSION_KEY (signs the admin sign-in cookie)
  for (const name of ['HASH_SALT', 'ADMIN_SESSION_KEY']) {
    if (set.has(name)) console.log(`${name}: already set`);
    else {
      await putSecret(name, randomBytes(32).toString('hex'));
      console.log(`${name}: set (random, never printed)`);
    }
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

// Pages: the frontend (cf-pages/), deployed after the Worker by the workflow
let pages;
try { pages = await cf('GET', `/pages/projects/${PAGES}`); console.log(`Pages ${PAGES}: exists`); }
catch { pages = await cf('POST', '/pages/projects', { name: PAGES, production_branch: 'main' }); console.log(`Pages ${PAGES}: created`); }

// The site's address: the real domain once the SITE_URL repo variable is set, else <project>.pages.dev
const url = (SITE_URL || `https://${pages.subdomain}`).replace(/\/+$/, '');
if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '') !== url) {
  throw new Error('Build canonical URL differs from deploy URL; rebuild and rerun release gates.');
}
const noindex = url.endsWith('.workers.dev');

let cfg = await readFile('wrangler.jsonc', 'utf8');
cfg = cfg.replaceAll(ZERO_ID, db.uuid).replace(/("SITE_URL":\s*")[^"]*(")/, `$1${url}$2`);
await writeFile('wrangler.jsonc', cfg);
console.log(`wrangler.jsonc: D1 id and SITE_URL set (${url})`);

if (GITHUB_ENV) await appendFile(GITHUB_ENV, `NEXT_PUBLIC_SITE_URL=${url}\nNEXT_PUBLIC_NOINDEX=${noindex ? '1' : ''}\nLIVE_URL=${url}\n`);
console.log(noindex ? 'Search engines: kept out (temporary workers.dev address)' : 'Search engines: allowed');
