#!/usr/bin/env node
/** Exercise the built Worker with isolated local bindings before any remote mutation. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import ts from 'typescript';

const dir = resolve('.release');
await mkdir(dir, { recursive: true });
const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', await readFile('wrangler.jsonc', 'utf8'));
if (parsed.error) throw new Error('Cannot parse wrangler.jsonc');
const config = parsed.config;
config.name = 'legitforge-preflight';
config.main = resolve(config.main);
config.assets.directory = resolve(config.assets.directory);
config.services = [{ binding: 'WORKER_SELF_REFERENCE', service: config.name }];
config.d1_databases = config.d1_databases.map((db) => ({
  ...db, database_name: 'legitforge-preflight', database_id: '00000000-0000-0000-0000-000000000001',
  ...(db.migrations_dir ? { migrations_dir: resolve(db.migrations_dir) } : {}), remote: false,
}));
config.r2_buckets = config.r2_buckets.map((bucket) => ({ ...bucket, bucket_name: `preflight-${bucket.binding.toLowerCase().replaceAll('_', '-')}`, remote: false }));
// Cover capture is optional and calls a paid external service; it is tested manually, never here.
delete config.browser;
delete config.routes;
delete config.env;
delete config.triggers;
// OpenNext's cache-population subprocess currently shell-concatenates --config. A relative
// path keeps workspaces with spaces safe while all binding paths inside remain absolute.
const configPath = '.release/wrangler.local.json';
await writeFile(configPath, JSON.stringify(config, null, 2));
await writeFile(resolve(dir, '.dev.vars'), 'HASH_SALT=local-preflight-only\nADMIN_SESSION_KEY=local-preflight-session-key-no-production-use\n');
await writeFile(resolve(dir, 'empty.env'), '');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' };
delete env.CLOUDFLARE_API_TOKEN;
delete env.CLOUDFLARE_ACCOUNT_ID;
const run = (file, args, extra = {}) => new Promise((done, fail) => {
  const child = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit', ...extra });
  child.once('error', fail);
  child.once('exit', (code) => code === 0 ? done() : fail(new Error(`${file} exited ${code}`)));
});
// OpenNext populates R2 under the workspace's default persistence directory. Use the same
// directory explicitly; unique local IDs and bucket names keep these test bindings isolated.
await run('node_modules/wrangler/bin/wrangler.js', ['d1', 'migrations', 'apply', 'legitforge-preflight', '--local', '--persist-to', '.wrangler/state', '--config', configPath, '--env-file', resolve(dir, 'empty.env')]);
await run('node_modules/wrangler/bin/wrangler.js', ['d1', 'execute', 'legitforge-preflight', '--local', '--persist-to', '.wrangler/state', '--config', configPath, '--file', 'scripts/preflight-content.sql', '--env-file', resolve(dir, 'empty.env')]);
const port = Number(process.env.PREFLIGHT_PORT || 8788);
const base = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'preview', '--config', configPath,
  '--port', String(port), '--ip', '127.0.0.1', '--persist-to', '.wrangler/state', '--env-file', resolve(dir, 'empty.env')], { env, stdio: 'inherit', detached: process.platform !== 'win32' });
let exited = false;
preview.once('exit', () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 120 && !exited; i++) {
    try { ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await new Promise((done) => setTimeout(done, 1000));
  }
  if (!ready) throw new Error('Local Worker did not become ready');
  const build = (await readFile('.next/BUILD_ID', 'utf8')).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(build)) throw new Error('Invalid build ID');
  const now = Date.now();
  const values = ['projects', 'team', 'testimonials', 'company'].map((tag) => `('${build}/${tag}', ${now}, ${now}, NULL)`).join(', ');
  // Cache population creates its own tag table with default config-relative persistence.
  // Explicitly initialise it in the preview's chosen local database as well.
  await writeFile(resolve(dir, 'local-tags.sql'), `CREATE TABLE IF NOT EXISTS revalidations(tag TEXT PRIMARY KEY, revalidatedAt INTEGER, stale INTEGER, expire INTEGER); INSERT OR REPLACE INTO revalidations(tag,revalidatedAt,stale,expire) VALUES ${values};`);
  await run('node_modules/wrangler/bin/wrangler.js', ['d1', 'execute', 'legitforge-preflight', '--local', '--persist-to', '.wrangler/state', '--config', configPath, '--file', '.release/local-tags.sql', '--env-file', resolve(dir, 'empty.env')]);
  // Only synthetic work/team fixtures; no customer/contact data or production secrets.
  await run('scripts/smoke.mjs', [], { env: { ...env, BASE: base, ALLOW_EMPTY_COMPANY: '1' } });
  await run('scripts/check-enquiries.mjs', [], { env: { ...env, BASE: base } });
  await run('scripts/check-access.mjs', [], { env: { ...env, BASE: base } });
  await run('scripts/check.mjs', [], { env: { ...env, BASE: base, SHOW_PLACEHOLDERS: '0', PRODUCTION_CHECK: '1' } });
} finally {
  if (process.platform === 'win32') await new Promise((done) => { const stop = spawn('taskkill', ['/pid', String(preview.pid), '/t', '/f'], { stdio: 'ignore' }); stop.once('exit', done); });
  else { try { process.kill(-preview.pid, 'SIGTERM'); } catch {} }
}
