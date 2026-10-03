import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { storeLead, leadHash, leadSignature, RECEIPT_TTL } from '../lib/server/lead-storage';
import { handleLeadRequest } from '../lib/server/lead-http';
import { alertsConfigured, deliverLeadAlerts, retryDelay } from '../lib/server/lead-delivery';
import { verifyTurnstile } from '../lib/turnstile';
import { authorizedSession, signSession, readSession, SESSION_HOURS } from '../lib/admin/session';

const lead = { name: 'Synthetic Test', phone: '+91 9000000000', need: 'Not sure yet', budget: '', message: 'Local test only' };
const now = 1_800_000_000_000;
const uuid = () => crypto.randomUUID();
const request = (id?: string, html = false, changed = false) => {
  const body = new FormData();
  for (const [key, value] of Object.entries({ ...lead, ...(changed ? { message: 'Changed test' } : {}), consent: 'yes' })) body.set(key, value);
  if (id) body.set('submission_id', id);
  return new Request('https://legitforge.pages.dev/api/leads', { method: 'POST', headers: { accept: html ? 'text/html' : 'application/json', 'cf-connecting-ip': '192.0.2.10' }, body });
};

test('website backend contracts on real Miniflare D1', async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-09-25', d1Databases: ['DB'] }));
  try {
    const db = await mf.getD1Database('DB') as unknown as D1Database;
    for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = (await readFile(`migrations/${file}`, 'utf8')).replace(/--[^\n]*/g, '').replace(/\r?\n/g, ' ');
      await db.exec(sql);
    }
    const env = { DB: db, HASH_SALT: 'test-salt-only', N8N_LEAD_WEBHOOK_URL: 'https://n8n.example.invalid/lead', N8N_SHARED_KEY: 'test-shared-key' };
    const reset = () => db.batch(['DELETE FROM leads', 'DELETE FROM rate_events', 'DELETE FROM events'].map((sql) => db.prepare(sql)));
    const counts = async () => {
      const values = await db.batch(['leads', 'lead_receipts', 'rate_events', 'lead_alert_outbox'].map((table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`)));
      return values.map((r) => (r.results[0] as { n: number }).n);
    };
    await t.test('concurrent submissions enforce five new leads per rolling hour', async () => {
      await reset();
      const responses = await Promise.all(Array.from({ length: 12 }, () => handleLeadRequest(request(uuid()), { env, now: () => now })));
      assert.equal(responses.filter((r) => r.status === 200).length, 5);
      assert.equal(responses.filter((r) => r.status === 429).length, 7);
      const rejected = await responses.find((r) => r.status === 429)!.json();
      assert.equal(rejected.ok, false);
      assert.equal(rejected.retryAfter, 3600);
      assert.deepEqual(await counts(), [5, 5, 5, 5]);
    });
    await t.test('concurrent retries create one lead, rate event and notification; changed receipt is rejected', async () => {
      await reset();
      const id = uuid();
      const bodies = await Promise.all(Array.from({ length: 10 }, async () => (await handleLeadRequest(request(id), { env, now: () => now })).json()));
      assert.ok(bodies.every((b) => b.ok && b.stored));
      assert.equal(bodies.filter((b) => !b.duplicate).length, 1);
      assert.deepEqual(await counts(), [1, 1, 1, 1]);
      const conflict = await handleLeadRequest(request(id, false, true), { env, now: () => now });
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).ok, false);
      // Receipt key can be reused after 24h even before scheduled rate cleanup.
      assert.equal((await handleLeadRequest(request(id), { env, now: () => now + RECEIPT_TTL + 1 })).status, 200);
      assert.deepEqual(await counts(), [2, 1, 2, 2]);
    });
    await t.test('native submissions use keyed content receipts; HTML is readable and escaped', async () => {
      await reset();
      for (let n = 0; n < 2; n++) {
        const response = await handleLeadRequest(request(undefined, true), { env, now: () => now, contact: { whatsapp: '919000000000', email: 'invalid"><script>' } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('x-robots-tag'), 'noindex');
        const body = await response.text();
        assert.match(body, /Details received/);
        assert.doesNotMatch(body, /<script>/);
      }
      assert.deepEqual(await counts(), [1, 1, 1, 1]);
      const stored = await db.prepare('SELECT submission_key FROM lead_receipts').first<{ submission_key: string }>();
      assert.match(stored!.submission_key, /^native:[a-f0-9]{64}$/);
      assert.doesNotMatch(stored!.submission_key, /Synthetic|900000/);
    });
    await t.test('transaction failure leaves no partial lead, receipt, rate event or notification', async () => {
      await reset();
      await db.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON lead_alert_outbox BEGIN SELECT RAISE(ABORT, 'test transaction failure'); END;");
      const response = await handleLeadRequest(request(uuid()), { env, now: () => now });
      assert.equal(response.status, 503);
      assert.deepEqual(await counts(), [0, 0, 0, 0]);
      await db.exec('DROP TRIGGER fail_outbox;');
    });
    await t.test('verification rejects new requests but a stored retry bypasses the consumed token', async () => {
      await reset();
      const id = uuid(); let verified = 0;
      const protectedEnv = { ...env, TURNSTILE_SECRET_KEY: 'test-only' };
      const rejected = await handleLeadRequest(request(id), { env: protectedEnv, now: () => now, verify: async () => false });
      assert.equal(rejected.status, 400);
      assert.deepEqual(await counts(), [0, 0, 0, 0]);
      const accepted = await handleLeadRequest(request(id), { env: protectedEnv, now: () => now, verify: async () => { verified++; return true; } });
      assert.equal(accepted.status, 200);
      const replay = await handleLeadRequest(request(id), { env: protectedEnv, now: () => now, verify: async () => { throw new Error('consumed token must not be retried'); } });
      assert.equal((await replay.json()).duplicate, true);
      assert.equal(verified, 1);
      assert.deepEqual(await counts(), [1, 1, 1, 1]);
    });
    await t.test('unconfigured alerts retain enquiry without queueing a delivery', async () => {
      await reset();
      assert.equal(alertsConfigured({ N8N_LEAD_WEBHOOK_URL: env.N8N_LEAD_WEBHOOK_URL }), false);
      assert.equal(alertsConfigured({ ...env, N8N_LEAD_WEBHOOK_URL: 'http://insecure.invalid' }), false);
      const response = await handleLeadRequest(request(uuid()), { env: { DB: db, HASH_SALT: env.HASH_SALT }, now: () => now });
      assert.equal(response.status, 200);
      assert.deepEqual(await counts(), [1, 1, 1, 0]);
    });
    await t.test('notification leases exclude overlapping sends and retry the stable lead ID', async () => {
      await reset();
      const hash = await leadHash(env.HASH_SALT, 'lead-payload', leadSignature(lead));
      const saved = await storeLead(db, lead, 'uuid:' + uuid(), hash, 'rate-test', now, true);
      assert.ok(saved.accepted);
      let sends = 0; let release!: () => void;
      const held = new Promise<void>((done) => { release = done; });
      const fakeFetch: typeof fetch = async (_url, options) => {
        sends++;
        assert.equal(new Headers(options?.headers).get('idempotency-key'), saved.id);
        assert.equal(JSON.parse(String(options?.body)).id, saved.id);
        assert.ok(options?.signal);
        await held;
        return new Response(null, { status: 503 });
      };
      const first = deliverLeadAlerts(env, { now: () => now, fetchImpl: fakeFetch, limit: 1 });
      while (!sends) await new Promise((done) => setTimeout(done, 5));
      await deliverLeadAlerts(env, { now: () => now, fetchImpl: fakeFetch, limit: 1 });
      assert.equal(sends, 1); release(); await first;
      let job = await db.prepare('SELECT * FROM lead_alert_outbox').first<{ attempts: number; status: string; next_attempt_at: number }>();
      assert.equal(job!.status, 'pending');
      assert.equal(job!.next_attempt_at, now + 60_000);
      await deliverLeadAlerts(env, { now: () => now + 60_000, fetchImpl: async () => new Response(null, { status: 200 }), limit: 1 });
      job = await db.prepare('SELECT * FROM lead_alert_outbox').first();
      assert.equal(job!.status, 'delivered');
      assert.equal(job!.attempts, 2);
      assert.equal(retryDelay(8), 3600_000);
    });
    await t.test('an interrupted exhausted lease never causes a ninth notification attempt', async () => {
      await db.prepare("UPDATE lead_alert_outbox SET status='pending',attempts=8,lease_until=?,next_attempt_at=?").bind(now + 60_000, now).run();
      let sends = 0;
      const send: typeof fetch = async () => { sends++; return new Response(null, { status: 200 }); };
      await deliverLeadAlerts(env, { now: () => now + 30_000, fetchImpl: send });
      await deliverLeadAlerts(env, { now: () => now + 60_001, fetchImpl: send });
      assert.equal(sends, 0);
      assert.equal((await db.prepare('SELECT status FROM lead_alert_outbox').first<{ status: string }>())!.status, 'dead');
    });
    await t.test('session expiry, admin removal and global revocation are checked against live D1', async () => {
      const secret = 'test-session-secret';
      const token = await signSession('admin@example.invalid', secret, now);
      assert.ok(await readSession(token, secret, now + 1));
      assert.equal(await readSession(token, secret, now + SESSION_HOURS * 3600_000), null);
      assert.equal(await readSession(token, 'different-secret', now + 1), null);
      await db.prepare('INSERT INTO admin_emails(email,added_by) VALUES (?,?)').bind('admin@example.invalid', 'owner').run();
      assert.equal(await authorizedSession(db, token, secret, [], now + 1), 'admin@example.invalid');
      await db.exec('DELETE FROM admin_emails;');
      assert.equal(await authorizedSession(db, token, secret, [], now + 1), null);
      assert.equal(await authorizedSession(db, token, secret, ['admin@example.invalid'], now + 1), 'admin@example.invalid');
      await db.prepare('UPDATE admin_security SET sessions_after=? WHERE id=1').bind(now).run();
      assert.equal(await authorizedSession(db, token, secret, ['admin@example.invalid'], now + 1), null);
      const renewed = await signSession('admin@example.invalid', secret, now + 2);
      assert.equal(await authorizedSession(db, renewed, secret, ['admin@example.invalid'], now + 3), 'admin@example.invalid');
    });
  } finally { await mf.dispose(); }
});

test('Turnstile validates hostname/action, limits token size and times out safely', async () => {
  let calls = 0;
  const verify = (data: Record<string, unknown>) => verifyTurnstile('test-secret', 'test-token', undefined, { hostname: 'legitforge.pages.dev', action: 'lead', fetchImpl: async (_url, options) => { calls++; assert.ok(options?.signal); return Response.json(data); } });
  assert.equal(await verify({ success: true, hostname: 'legitforge.pages.dev', action: 'lead' }), true);
  assert.equal(await verify({ success: true, hostname: 'other.invalid', action: 'lead' }), false);
  assert.equal(await verify({ success: true, hostname: 'legitforge.pages.dev', action: 'other' }), false);
  assert.equal(await verifyTurnstile('test', 'x'.repeat(2049), undefined, { fetchImpl: async () => { calls++; return Response.json({ success: true }); } }), false);
  assert.equal(calls, 3);
  assert.equal(await verifyTurnstile('test', 'token', undefined, { fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), false);
});
