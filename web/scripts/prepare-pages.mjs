#!/usr/bin/env node
/** Assemble the Pages front door from this same Worker build, cross-platform. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const target = resolve('.open-next/pages');
if (!target.startsWith(resolve('.open-next') + sep)) throw new Error('Pages directory escaped build output');
await rm(target, { recursive: true, force: true });
await mkdir('.open-next/pages', { recursive: true });
await cp('.open-next/assets', '.open-next/pages', { recursive: true });
await cp('cf-pages/_routes.json', '.open-next/pages/_routes.json');
// the front door's page cache is keyed by this build, so a deploy never serves the last build's pages
const build = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!/^[A-Za-z0-9_-]+$/.test(build)) throw new Error('Invalid build ID');
await writeFile('.open-next/pages/_worker.js', (await readFile('cf-pages/_worker.js', 'utf8')).replace('__BUILD_ID__', build));
