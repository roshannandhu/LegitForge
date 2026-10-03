import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readdir, readFile } from 'node:fs/promises';

test('public D1 caches reject cold failures, retain warm stale data, and recover after a successful empty read', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-09-25', d1Databases: ['DB'] }));
  const entries = new Map<string, { value: unknown; isStale: boolean }>();
  let writes = 0;
  // Use Next's real unstable_cache implementation with an in-memory incremental-store adapter.
  const incrementalCache = {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string, context: { revalidate: number }) => { assert.equal(context.revalidate, 60); return entries.get(key) ?? null; },
    set: async (key: string, value: unknown) => { writes++; entries.set(key, { value, isStale: false }); },
  };
  const globals = globalThis as unknown as Record<string | symbol, unknown>;
  globals.__incrementalCache = incrementalCache;
  try {
    const db = await mf.getD1Database('DB') as unknown as D1Database;
    globals[Symbol.for('__cloudflare-context__')] = { env: { DB: db } };
    const { getProjects } = await import('../lib/work');
    // No schema: this must throw rather than storing an empty fallback.
    await assert.rejects(getProjects(), /temporarily unavailable/);
    assert.equal(entries.size, 0);
    for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec((await readFile(`migrations/${file}`, 'utf8')).replace(/--[^\n]*/g, '').replace(/\r?\n/g, ' '));
    }
    assert.deepEqual(await getProjects(), []);
    assert.equal(writes, 1);
    await db.prepare("INSERT INTO projects(id,slug,title,client_type,category,summary,is_published) VALUES ('cache-test','cache-test','Cache test','Synthetic','static','Synthetic local content',1)").run();
    for (const entry of entries.values()) entry.isStale = true;
    assert.equal((await getProjects())[0].slug, 'cache-test');
    await db.exec('ALTER TABLE projects RENAME TO projects_unavailable;');
    for (const entry of entries.values()) entry.isStale = true;
    const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
    const store = { incrementalCache, nextFetchId: 1, isStaticGeneration: false, pendingRevalidates: {} };
    const stale = await workAsyncStorage.run(store as never, () => getProjects());
    assert.equal(stale[0].slug, 'cache-test');
    await Promise.all(Object.values(store.pendingRevalidates));
    assert.equal(writes, 2, 'failed refresh must not replace warm content');
    await db.exec('ALTER TABLE projects_unavailable RENAME TO projects;');
    assert.equal((await getProjects())[0].slug, 'cache-test');
    assert.equal(writes, 3);
  } finally {
    delete globals.__incrementalCache;
    delete globals[Symbol.for('__cloudflare-context__')];
    await mf.dispose();
  }
});
