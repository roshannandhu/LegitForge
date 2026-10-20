import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker, { clock, type Env } from '../bot/worker';
import { TEXT, fill } from '../bot/text';
import { forgetGateway } from '../bot/io';
import { fakeSupabase, installFakes, type Responder } from './bot-fakes';

type Row = Record<string, any>;
const SECRET = 'test-app-secret-only';
const TEAM = ['919000000001', '919000000002'];
const CLIENT = '919811111111', CLIENT2 = '919822222222';
const OPEN = Date.parse('2026-10-14T05:30:00Z');     // Wednesday 11:00 IST: open
const MIN = 60_000;

test('Conversational AI Agent: intelligent dialogue, memory, second enquiries, urgent complaints & zero robotic loops', async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: 'export default { fetch() { return new Response("ok") } }',
    compatibilityDate: '2026-09-25', d1Databases: ['DB'], r2Buckets: ['MEDIA']
  }));
  const db = await mf.getD1Database('DB') as unknown as D1Database;
  const bucket = await mf.getR2Bucket('MEDIA') as unknown as R2Bucket;
  for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec((await readFile(`migrations/${file}`, 'utf8')).replace(/--[^\n]*/g, '').replace(/\r?\n/g, ' '));
  }
  let now = OPEN;
  clock.now = () => now;
  const sb = fakeSupabase(() => now);
  const fx = installFakes(sb);
  t.after(async () => { fx.restore(); await mf.dispose(); });

  const env: Env = {
    DB: db, WA_ACCESS_TOKEN: 'token', WA_APP_SECRET: SECRET, WA_VERIFY_TOKEN: 'verify-me', WA_PHONE_NUMBER_ID: 'PNID',
    TEAM_WHATSAPP: TEAM.join(','), SUPABASE_URL: 'https://sb.test', SUPABASE_SECRET_KEY: 'sb-key', GROQ_API_KEY: 'groq-key',
    GEMINI_API_KEY: 'gemini-key', SITE_URL: 'https://legitforge.pages.dev', TRAINING_DAYS: '0', MEDIA: bucket,
  };

  let n = 0;
  const reset = async () => {
    for (const rows of Object.values(sb.tables)) rows.length = 0;
    fx.sent.length = 0; fx.aiBodies.length = 0; fx.whisper.length = 0;
    Object.assign(fx.state, { ai: (() => 500) as Responder, graphDown: false, embedDown: false, onSend: undefined, media: {}, voice: () => 500,
      calendar: { busy: [], events: [] }, razorpay: [] });
    await db.exec('DELETE FROM projects');
    await db.exec('DELETE FROM bot_team');
    await db.exec('DELETE FROM bot_limits');
    await db.exec('DELETE FROM company');
    await db.exec('DELETE FROM bot_settings');
    await db.exec('DELETE FROM bot_replies');
    sb.state.down = false;
    now = OPEN;
    await db.exec('DELETE FROM leads');
    forgetGateway();
  };

  const hex = async (raw: string) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const run = async (req: Request) => {
    const waits: Promise<unknown>[] = [];
    const res = await worker.fetch(req, env, { waitUntil: (p: Promise<unknown>) => { waits.push(p); } });
    await Promise.all(waits);
    return res;
  };

  const payload = (messages: Row[], phone = 'PNID') => JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { display_phone_number: '15551936315', phone_number_id: phone },
      ...(messages.length ? { contacts: messages.map((m) => ({ wa_id: m.from, profile: { name: TEAM.includes(m.from) ? 'Team' : 'Ravi' } })), messages } : {}),
    } }] }],
  });

  const post = async (messages: Row[], phone = 'PNID') => {
    const body = payload(messages, phone);
    return run(new Request('https://bot.test/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${await hex(body)}` }, body }));
  };

  const ts = () => String(Math.floor(now / 1000));
  const text = (from: string, body: string) => ({ from, id: `wamid.in.${++n}`, timestamp: ts(), type: 'text', text: { body } });
  const tap = (from: string, id: string, kind: 'list_reply' | 'button_reply' = 'list_reply', title = 'x') =>
    ({ from, id: `wamid.in.${++n}`, timestamp: ts(), type: 'interactive', interactive: { type: kind, [kind]: { id, title } } });
  const to = (who: string) => fx.sent.filter((s) => s.to === who);
  const last = (who: string) => to(who).at(-1)!;
  const contact = (who = CLIENT) => sb.tables.contacts.find((c) => c.wa_id === who)!;
  const lead = (who = CLIENT) => db.prepare('SELECT * FROM leads WHERE phone = ?').bind(`+${who}`).first<Row>();
  const allLeads = (who = CLIENT) => db.prepare('SELECT * FROM leads WHERE phone = ? ORDER BY created_at ASC').bind(`+${who}`).all<Row>();
  const teamHi = () => post(TEAM.map((m) => text(m, 'hi')));

  /** Helper to complete a full enquiry in Manglish or English */
  const completeEnquiry = async (who = CLIENT, lang = 'mg') => {
    await post([text(who, 'Hi')]);
    await post([tap(who, 'svc:website')]);
    await post([tap(who, `lang:${lang}`)]);
    await post([text(who, 'Ravi Kumar')]);
    await post([text(who, 'Ravi Bakery')]);
    await post([text(who, 'Oru website cakes order cheyyan')]);
    await post([tap(who, 'skip:details', 'button_reply')]);
    await post([tap(who, 'skip:refs', 'button_reply')]);
    await post([tap(who, 'tl:0', 'button_reply')]);
    assert.equal(contact(who).step, 'done', 'enquiry is fully completed');
  };

  await t.test('1. Casual greetings ("Hi", "Helloo") on a completed enquiry greet back warmly without adding notes', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    // Send "Helloo"
    await post([text(CLIENT, 'Helloo')]);
    const reply = last(CLIENT).body;
    assert.equal(reply, TEXT.mg.greetBack, 'greets back warmly in Manglish');
    assert.ok(!reply.includes(TEXT.mg.noted), 'never emits robotic noted reply');

    // Verify lead notes in D1 were NOT polluted with "Helloo"
    const row = await lead(CLIENT);
    assert.doesNotMatch(row?.message ?? '', /Helloo/, 'lead message was not corrupted with greeting');
    assert.equal(contact(CLIENT).fields.notes, undefined, 'no notes added on contact');

    // Send "Hi"
    await post([text(CLIENT, 'Hi')]);
    assert.equal(last(CLIENT).body, TEXT.mg.greetBack, 'replies with greetBack again');
    assert.doesNotMatch((await lead(CLIENT))?.message ?? '', /Hi/, 'lead message remains clean');
  });

  await t.test('2. "wait cheyy" on mid-brief and completed enquiry pauses politely without corrupting brief fields', async () => {
    await reset();
    await teamHi();

    // Test mid-brief
    await post([text(CLIENT, 'Hi')]);
    await post([tap(CLIENT, 'svc:website')]);
    await post([tap(CLIENT, 'lang:mg')]);
    assert.equal(contact(CLIENT).step, 'name');

    // Customer says "wait cheyy" while bot is asking for name
    await post([text(CLIENT, 'wait cheyy')]);
    assert.equal(last(CLIENT).body, TEXT.mg.wait, 'reassures client to take their time');
    assert.equal(contact(CLIENT).step, 'name', 'step remains at name');
    assert.equal(contact(CLIENT).fields.name, undefined, 'name was not set to wait cheyy');

    // Customer gives name now
    await post([text(CLIENT, 'Anand')]);
    assert.equal(contact(CLIENT).fields.name, 'Anand');
    assert.equal(contact(CLIENT).step, 'business');

    // Complete the brief
    await post([text(CLIENT, 'Anand Spices')]);
    await post([text(CLIENT, 'Export ecommerce store')]);
    await post([tap(CLIENT, 'skip:details', 'button_reply')]);
    await post([tap(CLIENT, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT, 'tl:0', 'button_reply')]);
    assert.equal(contact(CLIENT).step, 'done');

    // Customer says "wait cheyy" on completed enquiry
    await post([text(CLIENT, 'wait cheyy')]);
    assert.equal(last(CLIENT).body, TEXT.mg.wait, 'acknowledges wait on completed enquiry');
    assert.doesNotMatch((await lead(CLIENT))?.message ?? '', /wait cheyy/, 'notes untouched');
  });

  await t.test('3. Status inquiry ("Ente website status entha?") reports real status truthfully without notes or hallucinations', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    await post([text(CLIENT, 'Ente website status entha?')]);
    const reply = last(CLIENT).body;
    assert.equal(reply, TEXT.mg.statusDone, 'reports truthful lead review status');
    assert.ok(!reply.includes(TEXT.mg.noted), 'never says noted');
    assert.doesNotMatch((await lead(CLIENT))?.message ?? '', /status entha/, 'status inquiry was not saved as note');

    // English status inquiry
    await post([text(CLIENT2, 'Hi')]);
    await post([tap(CLIENT2, 'svc:app')]);
    await post([tap(CLIENT2, 'lang:en')]);
    await post([text(CLIENT2, 'Alex')]);
    await post([text(CLIENT2, 'Alex Logistics')]);
    await post([text(CLIENT2, 'Fleet dispatch tracking app')]);
    await post([tap(CLIENT2, 'skip:details', 'button_reply')]);
    await post([tap(CLIENT2, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT2, 'tl:0', 'button_reply')]);

    await post([text(CLIENT2, 'project status')]);
    assert.equal(last(CLIENT2).body, TEXT.en.statusDone, 'English client gets factual review SLA');
    assert.doesNotMatch((await lead(CLIENT2))?.message ?? '', /project status/);
  });

  await t.test('4. Second project enquiry ("Enikku vere oru project und") creates a separate lead without overwriting earlier project', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    const firstLead = await lead(CLIENT);
    assert.ok(firstLead?.id, 'first lead exists in D1');
    assert.equal(firstLead.service, 'Website');
    assert.match(firstLead.message, /Ravi Bakery/);
    const firstLeadId = firstLead.id;

    // Customer says they have another project
    await post([text(CLIENT, 'Enikku vere oru project und')]);
    assert.ok(last(CLIENT).body.includes('Website') || to(CLIENT).some((m) => m.ids?.some((id: string) => id.startsWith('svc:'))), 'presents service menu for new project');
    assert.equal(contact(CLIENT).step, 'service', 'step transitioned to service');
    assert.notEqual(contact(CLIENT).lead_id, firstLeadId, 'new distinct lead_id generated');
    assert.ok(contact(CLIENT).fields.prev_leads?.includes(firstLeadId), 'previous lead archived in prev_leads');
    assert.equal(contact(CLIENT).fields.name, 'Ravi Kumar', 'remembered customer name');

    // Pick new service: mobile app
    await post([tap(CLIENT, 'svc:app')]);
    assert.equal(contact(CLIENT).step, 'business');
    await post([text(CLIENT, 'Ravi Delivery App')]);
    await post([text(CLIENT, 'Mobile app for delivery drivers')]);
    await post([tap(CLIENT, 'skip:details', 'button_reply')]);
    await post([tap(CLIENT, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    assert.equal(contact(CLIENT).step, 'done', 'second enquiry completed');

    // Verify D1 has BOTH separate leads intact
    const leads = (await allLeads(CLIENT)).results;
    assert.equal(leads.length, 2, 'two distinct leads saved for same customer phone number');
    assert.equal(leads[0].id, firstLeadId, 'first lead unchanged');
    assert.equal(leads[0].service, 'Website', 'first lead service intact');
    assert.equal(leads[1].service, 'Web app', 'second lead service correctly saved');
    assert.match(leads[1].message, /Ravi Delivery App/, 'second lead has its own requirements');
  });

  await t.test('5. Pricing inquiry ("Rate ethra?") consultatively explains custom quotes & offers call, never inventing numbers', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    await post([text(CLIENT, 'Rate ethra?')]);
    const reply = last(CLIENT).body;
    assert.equal(reply, TEXT.mg.price, 'explains custom quote and asks about scheduling call');
    assert.ok(last(CLIENT).ids?.includes('call:y'), 'presents call buttons');
    assert.ok(!/\b(₹|\$|rupees|inr|\d{4,})\b/i.test(reply), 'never hallucinated fixed price numbers');
    assert.doesNotMatch((await lead(CLIENT))?.message ?? '', /Rate ethra/, 'price question was not saved as note');
  });

  await t.test('6. Urgent complaint ("Team enne contact cheythilla") triggers immediate high-priority alert and deduplicates follow-ups', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    // Clear sent log to track team alerts
    fx.sent.length = 0;

    // Send complaint
    await post([text(CLIENT, 'Team enne contact cheythilla')]);
    assert.equal(last(CLIENT).body, TEXT.mg.complaint, 'sincerely apologizes in customer dialect');
    assert.doesNotMatch((await lead(CLIENT))?.message ?? '', /contact cheythilla/);

    // Verify urgent team alert reached team members
    const teamAlerts = fx.sent.filter((s) => TEAM.includes(s.to));
    assert.ok(teamAlerts.length >= 1, 'team was alerted');
    assert.ok(teamAlerts.some((a) => a.body.includes('URGENT') || a.body.includes('waiting for contact')), 'alert is high priority urgent');
    assert.ok(teamAlerts.some((a) => a.body.includes(CLIENT)), 'includes client contact number');

    // Immediate follow-up within 2 minutes: should reassure client without duplicate team alert flood
    const alertCountBefore = teamAlerts.length;
    now += 2 * MIN;
    await post([text(CLIENT, 'Nobody called me yet')]);
    assert.equal(last(CLIENT).body, TEXT.mg.complaint, 'reassures client again');
    const alertCountAfter = fx.sent.filter((s) => TEAM.includes(s.to)).length;
    assert.equal(alertCountAfter, alertCountBefore, 'deduplicated: team not spammed within 15-minute window');
  });

  await t.test('7. Substantive positive note additions ("Please add UPI payment gateway") are saved and confirmed', async () => {
    await reset();
    await teamHi();
    await completeEnquiry(CLIENT, 'mg');

    // Customer provides genuine project requirement update
    await post([text(CLIENT, 'Website-il online UPI payment integration venam')]);
    assert.equal(last(CLIENT).body, TEXT.mg.noted, 'confirms addition for the team');

    // Verify requirement is properly recorded in D1 lead
    const row = await lead(CLIENT);
    assert.match(row?.message ?? '', /Notes:.*online UPI payment integration venam/, 'substantive requirement appended to lead notes in D1');
  });

  await t.test('8. Multi-dialect coverage across Hinglish, Tanglish, and Kanglish', async () => {
    await reset();
    await teamHi();

    // Hinglish (hg)
    await post([text('919800000001', 'Hi')]);
    await post([tap('919800000001', 'svc:website')]);
    await post([tap('919800000001', 'lang:hg')]);
    await post([text('919800000001', 'wait karo')]);
    assert.equal(last('919800000001').body, TEXT.hg.wait, 'Hinglish wait acknowledgment');

    // Tanglish (tg)
    await post([text('919800000002', 'Hi')]);
    await post([tap('919800000002', 'svc:website')]);
    await post([tap('919800000002', 'lang:tg')]);
    await post([text('919800000002', 'oru nimisham')]);
    assert.equal(last('919800000002').body, TEXT.tg.wait, 'Tanglish wait acknowledgment');

    // Kanglish (kg)
    await post([text('919800000003', 'Hi')]);
    await post([tap('919800000003', 'svc:website')]);
    await post([tap('919800000003', 'lang:kg')]);
    await post([text('919800000003', 'ondu nimisha')]);
    assert.equal(last('919800000003').body, TEXT.kg.wait, 'Kanglish wait acknowledgment');
  });
});
