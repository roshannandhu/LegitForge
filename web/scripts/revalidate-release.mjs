#!/usr/bin/env node
/** Refresh the four content tags for a specific deployed Next build; no customer data output. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const build = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!/^[A-Za-z0-9_-]+$/.test(build)) throw new Error('Invalid build ID');
const now = Date.now();
const values = ['projects', 'team', 'testimonials', 'company'].map((tag) => `('${build}/${tag}', ${now}, ${now}, NULL)`).join(', ');
await mkdir('.release', { recursive: true });
await writeFile('.release/revalidate.sql', `INSERT OR REPLACE INTO revalidations (tag, revalidatedAt, stale, expire) VALUES ${values};\n`);
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'legitforge', '--remote', '--file', '.release/revalidate.sql'], { stdio: 'inherit' });
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code || 0; });
