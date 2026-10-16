import test from 'node:test';
import assert from 'node:assert/strict';
import door from '../cf-pages/_worker.js';

/** The Pages front door (cf-pages/_worker.js): page cache and retries in front of the site Worker. */
test('Pages front door: cached public pages, retried reads, writes once', async (t) => {
  const store = new Map<string, Response>();
  (globalThis as unknown as { caches: unknown }).caches = { default: {
    match: async (k: Request) => store.get(k.url)?.clone(),
    put: async (k: Request, r: Response) => { store.set(k.url, r); },
  } };
  let calls = 0;
  let behave: (n: number, req: Request) => Response | Promise<Response> = () => new Response('<p>page</p>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 's-maxage=31536000' } });
  const env = { SITE: { fetch: async (req: Request) => { calls++; return behave(calls, req); } } };
  const run = async (url: string, init?: RequestInit) => {
    const waits: Promise<unknown>[] = [];
    const res = await door.fetch(new Request(url, init), env, { waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    return res;
  };
  const reset = () => { store.clear(); calls = 0; behave = () => new Response('<p>page</p>', { headers: { 'content-type': 'text/html', 'cache-control': 's-maxage=1' } }); };

  await t.test('a public page is rendered once, then served from the cache with its own cache-control', async () => {
    reset();
    assert.equal(await (await run('https://x.test/services')).text(), '<p>page</p>');
    const again = await run('https://x.test/services');
    assert.equal(await again.text(), '<p>page</p>');
    assert.equal(calls, 1);
    assert.equal(again.headers.get('cache-control'), 's-maxage=1');
    assert.equal(again.headers.get('x-lf-cache-control'), null);
  });

  await t.test('admin, API, navigation data, signed-in and cookie-setting responses are never cached', async () => {
    reset();
    for (const url of ['https://x.test/admin', 'https://x.test/admin/leads', 'https://x.test/api/health', 'https://x.test/services?_rsc=abc']) {
      await run(url); await run(url);
    }
    await run('https://x.test/', { headers: { cookie: '__Host-lf_admin=x' } });
    await run('https://x.test/', { headers: { cookie: '__Host-lf_admin=x' } });
    assert.equal(calls, 10);
    reset();
    behave = () => new Response('x', { headers: { 'content-type': 'text/html', 'set-cookie': 'a=1' } });
    await run('https://x.test/contact'); await run('https://x.test/contact');
    assert.equal(calls, 2);
  });

  await t.test('a failed or stalled read is tried once more; a write is never repeated', async () => {
    reset();
    behave = (n) => { if (n === 1) throw new Error('Worker exceeded CPU time limit.'); return new Response('ok', { headers: { 'content-type': 'text/html' } }); };
    assert.equal(await (await run('https://x.test/team')).text(), 'ok');
    assert.equal(calls, 2);
    reset();
    behave = (n) => (n === 1 ? new Response('busy', { status: 503 }) : new Response('ok'));
    assert.equal((await run('https://x.test/admin')).status, 200);
    reset();
    behave = () => { throw new Error('boom'); };
    await assert.rejects(run('https://x.test/api/leads', { method: 'POST', body: 'a=1' }));
    assert.equal(calls, 1);
  });

  await t.test('when the Worker fails twice, the last good copy is served instead of an error', async () => {
    reset();
    await run('https://x.test/privacy');                          // rendered and saved (fresh + backup)
    for (const k of [...store.keys()]) if (!k.includes('__copy=backup')) store.delete(k);   // the fresh copy expired
    behave = () => { throw new Error('Worker exceeded CPU time limit.'); };
    const res = await run('https://x.test/privacy');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '<p>page</p>');
    assert.equal(calls, 3, 'one render, then two failed tries');
    reset();
    behave = () => { throw new Error('down'); };
    await assert.rejects(run('https://x.test/never-saved'), /down/);
  });

  await t.test('the cache key carries the build, so a new deploy starts fresh', async () => {
    reset();
    await run('https://x.test/');
    assert.ok([...store.keys()].every((k) => k.includes('__build=')));
  });
});
