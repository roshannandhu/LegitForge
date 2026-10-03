#!/usr/bin/env node
/** Read secret names only. Provision/verify Turnstile securely before attesting the pair. */
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'list'], { encoding: 'utf8', env: process.env });
if (result.status !== 0) throw new Error('Cannot check Worker secret names; confirm the deployment account access.');
const names = new Set(JSON.parse(result.stdout).map((secret) => secret.name));
if (!names.has('HASH_SALT') || !names.has('ADMIN_SESSION_KEY')) throw new Error('Required existing Worker security secrets are missing.');
const site = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const secret = names.has('TURNSTILE_SECRET_KEY');
if (site !== secret) throw new Error('Turnstile site key and Worker secret must be enabled together. Rebuild only after securely verifying the matching pair.');
if (site && process.env.TURNSTILE_PAIR_VERIFIED !== '1') throw new Error('Set TURNSTILE_PAIR_VERIFIED only after verifying this site-key/secret pair, hostname and action.');
console.log(site ? '✓ verified Turnstile pair attested for this release' : '✓ Turnstile remains disabled; no unverified key pair enabled');
console.log(names.has('N8N_SHARED_KEY') && names.has('N8N_LEAD_WEBHOOK_URL') ? '✓ alert configuration names present; verify downstream n8n/Telegram separately' : '· Alerts not configured; enquiries remain in D1');
