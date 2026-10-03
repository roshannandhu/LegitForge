import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { analyticsCutoff, analyticsSummary, eventCountry, publicEvent, storePublicEvent } from '../lib/analytics';

test('public events drop personal and unbounded properties, and reserve confirmed submissions for the server', () => {
  assert.equal(publicEvent({ name: 'form_submit' }, ['website-development']), null);
  assert.equal(publicEvent({ name: 'unknown' }, []), null);
  assert.equal(publicEvent({ name: 'service_open', props: { slug: 'unlisted' } }, ['website-development']), null);
  assert.equal(publicEvent({ name: 'project_open', props: { slug: 'x'.repeat(81) } }, []), null);
  assert.deepEqual(publicEvent({ name: 'whatsapp_click', props: { location: 'hero', name: 'Person', phone: '+919000000000', message: 'Private', ip: '1.2.3.4', service: 'arbitrary' } }, []),
    { name: 'whatsapp_click', props: { location: 'hero' } });
  assert.deepEqual(publicEvent({ name: 'service_open', props: { slug: 'website-development', location: 'private string' } }, ['website-development']),
    { name: 'service_open', props: { slug: 'website-development' } });
  assert.equal(eventCountry('IN'), 'IN');
  assert.equal(eventCountry('unknown'), null);
});

test('concurrent event admission is bounded in real D1; aggregates and retention remain accurate', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-09-25', d1Databases: ['DB'] }));
  try {
    const db = await mf.getD1Database('DB') as unknown as D1Database;
    await db.exec('CREATE TABLE rate_events (key TEXT NOT NULL, at INTEGER NOT NULL); CREATE TABLE events (name TEXT NOT NULL, props TEXT, country TEXT, at INTEGER NOT NULL);');
    const at = Date.now();
    const event = publicEvent({ name: 'whatsapp_click', props: { location: 'hero', phone: 'must-not-store' } }, [])!;
    await Promise.all(Array.from({ length: 130 }, () => storePublicEvent(db, event, 'events:keyed-test-digest', 'IN', at)));
    const total = await db.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>();
    const rates = await db.prepare('SELECT COUNT(*) AS n FROM rate_events').first<{ n: number }>();
    assert.equal(total?.n, 120);
    assert.equal(rates?.n, 120);
    const row = await db.prepare('SELECT props,country FROM events LIMIT 1').first<{ props: string; country: string }>();
    assert.equal(row?.props, '{"location":"hero"}');
    assert.equal(row?.country, 'IN');
    const summary = await analyticsSummary(db);
    assert.equal(summary.find((s) => s.name === 'whatsapp_click')?.n, 120);
    assert.equal(summary.find((s) => s.name === 'form_submit')?.n, 0);
    await db.prepare('INSERT INTO events(name,props,country,at) VALUES (?,?,?,?)').bind('whatsapp_click', '{}', null, analyticsCutoff(at) - 1).run();
    await db.prepare('DELETE FROM events WHERE at < ?').bind(analyticsCutoff(at)).run();
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>())?.n, 120);
  } finally { await mf.dispose(); }
});

test('13-month retention clamps month-end dates without rollover', () => {
  assert.equal(new Date(analyticsCutoff(Date.UTC(2025, 2, 31, 10))).toISOString(), '2024-02-29T10:00:00.000Z');
});
