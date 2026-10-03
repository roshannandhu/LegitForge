#!/usr/bin/env node
/** Assemble the Pages front door from this same Worker build, cross-platform. */
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const target = resolve('.open-next/pages');
if (!target.startsWith(resolve('.open-next') + sep)) throw new Error('Pages directory escaped build output');
await rm(target, { recursive: true, force: true });
await mkdir('.open-next/pages', { recursive: true });
await cp('.open-next/assets', '.open-next/pages', { recursive: true });
for (const file of ['_worker.js', '_routes.json']) await cp(`cf-pages/${file}`, `.open-next/pages/${file}`);
