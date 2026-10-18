import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker, { BotAdmin, clock, leadScore, pageFrom, tick, type Env } from '../bot/worker';
import { DETAILS, LANGS, TEXT, fill } from '../bot/text';
import { parts } from '../bot/channels';
import { fakeEmbedding, fakeSupabase, installFakes, type Responder, type Sent } from './bot-fakes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const SECRET = 'test-app-secret-only';
const TEAM = ['919000000001', '919000000002'];
const CLIENT = '919811111111', CLIENT2 = '919822222222', CLIENT3 = '919833333333';
const OPEN = Date.parse('2026-10-14T05:30:00Z');     // Wednesday 11:00 IST: open
const SUNDAY = Date.parse('2026-10-18T05:30:00Z');   // closed all day
const MIN = 60_000;
const blank = { name: '', business: '', need_en: '', detail_en: '', timeline: '', question_en: '', commitment: false, price: false, mood: 'calm', abusive: false };
const question = (q: string, commitment = false) => ({ ...blank, kind: 'question', question_en: q, commitment });

test('WhatsApp bot (fake Meta, Supabase, Groq and Gemini; real Miniflare D1)', async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-09-25', d1Databases: ['DB'], r2Buckets: ['MEDIA'] }));
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
    const files = (await bucket.list()).objects.map((o) => o.key);
    if (files.length) await bucket.delete(files);
    await db.exec('DELETE FROM projects');
    await db.exec('DELETE FROM bot_team');
    await db.exec('DELETE FROM bot_limits');
    await db.exec('DELETE FROM company');
    await db.exec('DELETE FROM bot_settings');
    await db.exec('DELETE FROM bot_replies');
    sb.state.down = false;
    now = OPEN;
    await db.exec('DELETE FROM leads');
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
  const payload = (messages: Row[], phone = 'PNID', statuses = false) => JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { display_phone_number: '15551936315', phone_number_id: phone },
      ...(messages.length ? { contacts: messages.map((m) => ({ wa_id: m.from, profile: { name: TEAM.includes(m.from) ? 'Team' : 'Ravi' } })), messages } : {}),
      ...(statuses ? { statuses: [{ id: 'wamid.out.1', status: 'delivered', timestamp: '1', recipient_id: CLIENT }] } : {}),
    } }] }],
  });
  const post = async (messages: Row[], phone = 'PNID', statuses = false) => {
    const body = payload(messages, phone, statuses);
    return run(new Request('https://bot.test/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${await hex(body)}` }, body }));
  };
  const ts = () => String(Math.floor(now / 1000));
  const text = (from: string, body: string, extra: Row = {}) => ({ from, id: `wamid.in.${++n}`, timestamp: ts(), type: 'text', text: { body }, ...extra });
  const tap = (from: string, id: string, kind: 'list_reply' | 'button_reply' = 'list_reply', title = 'x') =>
    ({ from, id: `wamid.in.${++n}`, timestamp: ts(), type: 'interactive', interactive: { type: kind, [kind]: { id, title } } });
  const to = (who: string) => fx.sent.filter((s) => s.to === who);
  const last = (who: string) => to(who).at(-1)!;
  const contact = (who = CLIENT) => sb.tables.contacts.find((c) => c.wa_id === who)!;
  const lead = (who = CLIENT) => db.prepare('SELECT * FROM leads WHERE phone = ?').bind(`+${who}`).first<Row>();
  const teamHi = () => post(TEAM.map((m) => text(m, 'hi')));          // opens the team members' 24-hour windows
  const toName = async (who = CLIENT, lang = 'en') => { await post([text(who, 'Hi')]); await post([tap(who, 'svc:website')]); await post([tap(who, `lang:${lang}`)]); };
  const teamGot = (member: string, needle: string) => to(member).filter((s) => s.body.includes(needle)).at(-1);
  /** A photo, document, video or voice note (media id `id`, which state.media must hold). */
  const sent = (from: string, kind: 'image' | 'document' | 'video' | 'voice', id: string, extra: Row = {}) => {
    const type = kind === 'voice' ? 'audio' : kind;
    return { from, id: `wamid.in.${++n}`, timestamp: ts(), type, [type]: { id, mime_type: fx.state.media[id]?.type, ...(kind === 'voice' ? { voice: true } : {}), ...extra } };
  };
  /** Name, business and need, then the website questions skipped: the brief up to the timeline. */
  const toTimeline = async (who = CLIENT, answers = ['Ravi', 'Ravi Bakery', 'A website']) => {
    for (const a of answers) await post([text(who, a)]);
    await post([tap(who, 'skip:details', 'button_reply')]);
    await post([tap(who, 'skip:refs', 'button_reply')]);
  };

  await t.test('webhook verification and signatures', async () => {
    await reset();
    const ok = await run(new Request('https://bot.test/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=4242'));
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '4242');
    assert.equal((await run(new Request('https://bot.test/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1'))).status, 403);
    const body = payload([text(CLIENT, 'Hi')]);
    const bad = await run(new Request('https://bot.test/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` }, body }));
    assert.equal(bad.status, 401);
    assert.equal((await run(new Request('https://bot.test/webhook', { method: 'POST', body }))).status, 401);
    assert.equal(fx.sent.length, 0);
    assert.equal(sb.tables.messages.length, 0);
    assert.equal((await run(new Request('https://bot.test/other'))).status, 404);
  });

  await t.test('statuses, duplicate deliveries, other numbers and a Supabase outage', async () => {
    await reset();
    assert.equal((await post([], 'PNID', true)).status, 200);
    assert.equal(fx.sent.length + sb.tables.messages.length, 0);
    const hi = text(CLIENT, 'Hi');
    await post([hi]);
    await post([hi]);                                               // Meta retries the same message
    assert.equal(to(CLIENT).filter((s) => s.type === 'list').length, 1);
    await post([text(CLIENT2, 'Hi')], 'SOME-OTHER-NUMBER');
    assert.equal(to(CLIENT2).length, 0);
    sb.state.down = true;
    assert.equal((await post([text(CLIENT3, 'Hi')])).status, 500, 'Meta must retry when the message could not be stored');
  });

  await t.test('first message: the service menu within WhatsApp limits, and a lead in Admin → Leads', async () => {
    await reset();
    await post([text(CLIENT, 'Hi')]);
    const menu = last(CLIENT) as Sent & { raw: Row };
    assert.equal(menu.type, 'list');
    const rows = menu.raw.interactive.action.sections[0].rows as { id: string; title: string; description: string }[];
    assert.ok(rows.length <= 10);
    for (const r of rows) assert.ok(r.title.length <= 24 && (r.description ?? '').length <= 72, r.title);
    assert.ok(rows.findIndex((r) => r.id === 'svc:signage') === rows.length - 2 && rows.at(-1)!.id === 'svc:other', 'MR Signage last, then the free chat row');
    assert.ok(menu.raw.interactive.footer.text.length <= 60 && menu.raw.interactive.footer.text.includes('legitforge.pages.dev/privacy'));
    for (const l of Object.values(TEXT)) {
      assert.ok(l.menu.length <= 20, l.menu);
      for (const b of l.tl) assert.ok(b.length <= 20, b);
      for (const b of [...l.howBtn, l.skip, l.slotBtn, ...l.callBtn, ...l.delBtn, ...l.retBtn]) assert.ok(b.length <= 20, b);   // buttons, list button
      assert.ok(l.otherTime.length <= 24, l.otherTime);                     // a list row
    }
    for (const l of LANGS) assert.ok(l.title.length <= 24);
    const row = await lead();
    assert.equal(row?.source, 'whatsapp');
    assert.equal(row?.name, 'Ravi');                                // WhatsApp profile name until they give theirs
    assert.equal(row?.status, 'new');
  });

  await t.test('a site button skips the menu; the language tap switches every question', async () => {
    await reset();
    await post([text(CLIENT, "Hi Legit Forge, I'd like to talk about SEO.")]);
    assert.ok(last(CLIENT).ids.every((id) => id.startsWith('lang:')), 'language list');
    assert.equal(contact().service, 'seo');
    await post([tap(CLIENT, 'lang:ml')]);
    assert.equal(last(CLIENT).body, TEXT.ml.name);
    const row = await lead();
    assert.equal(row?.language, 'Malayalam');
    assert.equal(row?.service, 'SEO');
  });

  await t.test('with no AI the fixed questions complete the brief; the lead is stored before the alert', async () => {
    await reset();
    await teamHi();
    let atAlert: Row | null = null;
    fx.state.onSend = async (s) => { if (TEAM.includes(s.to) && s.body.includes('new lead')) atAlert = await lead(); };
    await toName();
    assert.equal(last(CLIENT).body, TEXT.en.name);
    await post([text(CLIENT, 'Ravi Kumar')]);
    assert.equal(last(CLIENT).body, TEXT.en.business);
    await post([text(CLIENT, 'Ravi Bakery, cakes in Feroke')]);
    assert.equal(last(CLIENT).body, TEXT.en.need);
    await post([text(CLIENT, 'A website where people can order cakes')]);
    assert.equal(last(CLIENT).body, DETAILS.en.website, 'the website question');
    await post([text(CLIENT, 'About 4 pages, no domain yet')]);
    assert.equal(last(CLIENT).body, TEXT.en.refs);
    await post([text(CLIENT, 'I like ravibakes.example, it is simple')]);
    assert.equal(last(CLIENT).type, 'button');
    assert.deepEqual(last(CLIENT).ids, ['tl:0', 'tl:1', 'tl:2']);
    await post([tap(CLIENT, 'tl:0', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.done);
    const code = contact().code;
    for (const m of TEAM) {
      const alert = teamGot(m, `#${code} new lead (brief complete)`);
      assert.ok(alert && alert.type === 'text', 'free-form alert inside the team window');
      assert.match(alert.body, /Need: A website where people can order cakes/);
      assert.match(alert.body, /wa\.me\/919811111111/);
    }
    assert.ok(atAlert, 'lead row existed when the team was alerted');
    const row = await lead();
    assert.equal(row?.name, 'Ravi Kumar');
    assert.equal(row?.service, 'Website');
    assert.match(row?.message ?? '', /Business: Ravi Bakery[\s\S]*Details: About 4 pages[\s\S]*Websites they like: I like ravibakes\.example[\s\S]*Timeline: As soon as possible/);
    await post([text(CLIENT, 'Also need delivery tracking')]);
    assert.equal(last(CLIENT).body, TEXT.en.noted);
    assert.equal(fx.sent.filter((s) => s.body.includes('new lead')).length, 2, 'one alert per team member, once');
    assert.match((await lead())?.message ?? '', /Notes: Also need delivery tracking/);
  });

  await t.test('approved knowledge answers; commitments and unknown questions go to the team', async () => {
    await reset();
    await teamHi();
    sb.tables.knowledge.push({ id: 900, question_en: 'How long does a website take?', answer_en: 'Most websites take one to two weeks.', embedding: JSON.stringify(fakeEmbedding('How long does a website take?')), status: 'approved', source: 'site' });
    fx.state.ai = (task, user) => {
      if (task === 'extract') {
        if (/how long/i.test(user)) return question('How long does a website take?');
        if (/price/i.test(user)) return question('How long does a website take?', true);   // a match exists, still a commitment
        if (/dubai/i.test(user)) return question('Do you host websites in Dubai?');
        return { ...blank, kind: 'answer', name: user };
      }
      if (task === 'answer') return { answer: user.includes('one to two weeks') && /How long does a website take/.test(user) ? 'Usually one to two weeks.' : '', answer_en: 'Usually one to two weeks.' };
      return 500;
    };
    await toName();
    await post([text(CLIENT, 'How long does it take?')]);
    assert.ok(last(CLIENT).body.startsWith('Most websites take one to two weeks.') && last(CLIENT).body.endsWith(TEXT.en.name), 'the approved words, then the question again');
    assert.deepEqual(sb.tables.questions.map((x) => x.kind), ['auto'], 'logged as answered by the bot, nothing for the team');
    assert.equal(sb.tables.questions[0].knowledge_id, 900);
    await post([text(CLIENT, 'What price and finish date for mine?')]);
    assert.equal(sb.tables.questions.filter((x) => x.kind === 'decision').length, 1, 'commitment questions always go to the team');
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.checking));
    await post([text(CLIENT, 'Do you host in Dubai?')]);
    assert.equal(sb.tables.questions.filter((x) => x.kind !== 'auto').length, 2);
    const code = contact().code;
    assert.ok(teamGot(TEAM[0], `#${code} question`)?.body.includes('Do you host in Dubai?'));
    assert.equal(contact().step, 'name', 'questions do not fill the field being asked');
  });

  await t.test('team answers are relayed in the client language and learned only after Approve', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => {
      if (task === 'extract') return /hosting|ഹോസ്റ്റിംഗ്/.test(user) ? question('Do you provide hosting?') : /sunday/i.test(user) ? question('Do you work on Sundays?')
        : /holiday/i.test(user) ? question('Do you work on holidays?') : { ...blank, kind: 'answer', name: user };
      if (task === 'answer') return { answer: user.includes('we set up hosting in your name') ? 'ഹോസ്റ്റിംഗ് നിങ്ങളുടെ പേരിൽ സജ്ജമാക്കും.' : '', answer_en: 'Yes, hosting in your name.' };
      if (task === 'translate') return { text: `[ml] ${user}` };
      if (task === 'faq') return /Sundays/.test(user) ? { question_en: 'Do you work on Sundays?', answer_en: 'We are closed on Sundays.' }
        : /holidays/.test(user) ? { question_en: 'Do you work on holidays?', answer_en: 'Not on public holidays.' }
        : { question_en: 'Do you provide hosting?', answer_en: 'Yes, we set up hosting in your name.' };
      return 500;
    };
    await toName(CLIENT, 'ml');
    await post([text(CLIENT, 'ഹോസ്റ്റിംഗ് ചെയ്യുമോ?')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.ml.checking));
    const code = contact().code;
    const [alert0, alert1] = TEAM.map((m) => teamGot(m, `#${code} question`)!);
    await post([text(TEAM[0], 'Yes, we can set up hosting in your name.', { context: { from: '15551936315', id: alert0.id } })]);
    assert.equal(last(CLIENT).body, '[ml] Yes, we can set up hosting in your name.');
    assert.equal(sb.tables.questions[0].status, 'answered');
    const review = last(TEAM[0]);
    const k = sb.tables.knowledge[0];
    assert.equal(k.status, 'pending');
    assert.equal(review.type, 'button');
    assert.deepEqual(review.ids, [`kb:a:${k.id}`, `kb:e:${k.id}`, `kb:r:${k.id}`]);
    assert.match(review.body, new RegExp(`Sent to #${code}`));
    await post([text(TEAM[1], 'We do hosting', { context: { id: alert1.id } })]);
    assert.match(last(TEAM[1]).body, /Already answered by \+919000000001/);
    assert.ok((await lead())?.last_contact_at, 'a relay records the contact on the lead');

    await post([tap(TEAM[0], `kb:a:${k.id}`, 'button_reply', 'Approve')]);
    assert.equal(sb.tables.knowledge[0].status, 'approved');
    assert.ok(sb.tables.knowledge[0].embedding);
    assert.match(last(TEAM[0]).body, /Saved/);
    const before = sb.tables.questions.filter((x) => x.kind !== 'auto').length;
    await post([text(CLIENT, 'hosting?')]);                        // the same question again: the bot answers it
    assert.ok(last(CLIENT).body.startsWith('ഹോസ്റ്റിംഗ് നിങ്ങളുടെ'));
    assert.equal(sb.tables.questions.filter((x) => x.kind !== 'auto').length, before, 'no new team question');

    // Edit: tap Edit, then reply to the bot's prompt with the corrected answer.
    await post([text(CLIENT, 'Do you work on Sunday?')]);
    await post([text(TEAM[0], `#${code} We are closed on Sundays.`)]);
    const k2 = sb.tables.knowledge.at(-1)!;
    await post([tap(TEAM[0], `kb:e:${k2.id}`, 'button_reply', 'Edit')]);
    const prompt = last(TEAM[0]);
    assert.match(prompt.body, /corrected answer/);
    await post([text(TEAM[0], 'We work Monday to Saturday, 10 a.m. to 7 p.m.', { context: { id: prompt.id } })]);
    assert.equal(sb.tables.knowledge.find((k) => k.id === k2.id)!.status, 'approved');
    assert.equal(sb.tables.knowledge.find((k) => k.id === k2.id)!.answer_en, 'We work Monday to Saturday, 10 a.m. to 7 p.m.');

    // Reject.
    await post([text(CLIENT, 'Open on a holiday?')]);
    await post([text(TEAM[1], `#${code} Not on public holidays.`)]);
    const k3 = sb.tables.knowledge.at(-1)!;
    await post([tap(TEAM[1], `kb:r:${k3.id}`, 'button_reply', 'Reject')]);
    assert.equal(sb.tables.knowledge.at(-1)!.status, 'rejected');
  });

  await t.test('cron: the 10-minute message is sent once (open and closed); stuck turns are retried', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Shopify stores?') : task === 'answer' ? { answer: '', answer_en: '' } : 500);
    await toName();
    await post([text(CLIENT, 'Shopify?')]);
    now += 5 * MIN;
    await tick(env, now);
    assert.notEqual(last(CLIENT).body, TEXT.en.teamSoon, 'not before 10 minutes');
    now += 6 * MIN;
    await tick(env, now);
    assert.equal(last(CLIENT).body, TEXT.en.teamSoon);
    const count = to(CLIENT).length;
    now += 2 * MIN;
    await tick(env, now);
    assert.equal(to(CLIENT).length, count, 'only once');

    now = SUNDAY;
    await teamHi();
    await toName(CLIENT2);
    await post([text(CLIENT2, 'Shopify?')]);
    now += 11 * MIN;
    await tick(env, now);
    assert.equal(last(CLIENT2).body, TEXT.en.teamLater);

    sb.tables.messages.push({ wamid: 'wamid.stuck', wa_id: CLIENT3, team: null, dir: 'in', body: 'Hi', reply_id: null, ctx_id: null, profile: 'Asha',
      question_id: null, knowledge_id: null, handled_at: null, at: new Date(now - 3 * MIN).toISOString() });
    await tick(env, now);
    assert.equal(last(CLIENT3).type, 'list');
    assert.ok(sb.tables.messages.find((m) => m.wamid === 'wamid.stuck')!.handled_at);
  });

  await t.test('two quick messages: one turn at a time, one menu', async () => {
    await reset();
    // The second arrives while the first turn holds the lock (Meta sends webhooks in order).
    const hi = text(CLIENT, 'Hi'), next = text(CLIENT, 'I need a website for my shop');
    const stored = async () => { while (!sb.tables.messages.some((m) => m.wamid === hi.id)) await new Promise((r) => setTimeout(r, 1)); };
    await Promise.all([post([hi]), stored().then(() => post([next]))]);
    assert.equal(to(CLIENT).filter((s) => s.ids.some((id) => id.startsWith('svc:'))).length, 1);
    assert.equal(contact().step, 'language');
    assert.equal(contact().service, 'website');
    assert.ok(sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'in').every((m) => m.handled_at));
    assert.equal(contact().busy_until, null, 'lock released');
  });

  await t.test('team window closed → template; client window closed → the team is told', async () => {
    await reset();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:2', 'button_reply')]);
    const alert = to(TEAM[0])[0];
    assert.equal(alert.type, 'template');
    assert.equal(alert.template, 'team_alert');
    assert.ok(alert.body.startsWith(contact().code));
    const sentToClient = to(CLIENT).length;
    now += 25 * 60 * MIN;
    await post([text(TEAM[0], 'Hello Ravi, are you free for a call?', { context: { id: alert.id } })]);
    assert.match(last(TEAM[0]).body, /window has closed[\s\S]*wa\.me\/919811111111/);
    assert.equal(to(CLIENT).length, sentToClient);
  });

  await t.test('no phone number or email reaches an AI provider', async () => {
    await reset();
    fx.state.ai = (task, user) => (task === 'extract' ? { ...blank, kind: 'answer', need_en: user } : 500);
    await toName();
    await post([text(CLIENT, 'Ravi')]);
    await post([text(CLIENT, 'Ravi Bakery')]);
    await post([text(CLIENT, 'Call me on +91 98765 43210 or mail ravi.kumar@example.com about a website')]);
    assert.ok(fx.aiBodies.length > 0);
    for (const b of fx.aiBodies) assert.ok(!b.includes('98765') && !b.includes('ravi.kumar@example.com'), b.slice(0, 200));
    assert.match((await lead())?.message ?? '', /\[number\]/, 'the brief the AI wrote has no number either');
  });

  await t.test('STOP, take / bot, a client typing #CODE, off-topic', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => (task === 'extract' ? (/poem/i.test(user) ? { ...blank, kind: 'off_topic' } : { ...blank, kind: 'answer', name: user }) : 500);
    await toName();
    const code = contact().code;
    await post([text(CLIENT, 'Write me a poem about rain')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.offTopic));
    await post([text(CLIENT, 'STOP')]);
    assert.equal(last(CLIENT).body, TEXT.en.stopped);
    assert.equal(contact().mode, 'stopped');
    const count = to(CLIENT).length;
    await post([text(TEAM[0], `#${code} Hi Ravi`)]);
    assert.match(last(TEAM[0]).body, /opted out/);
    assert.equal(to(CLIENT).length, count);
    await post([text(CLIENT, 'Sorry, I am back')]);
    assert.equal(contact().mode, 'bot');

    await post([text(TEAM[0], `#${code} take`)]);
    assert.equal(contact().mode, 'human');
    assert.equal(contact().taken_by, TEAM[0]);
    const before = to(CLIENT).length;
    await post([text(CLIENT, 'Are you there?')]);
    assert.equal(to(CLIENT).length, before, 'the bot is quiet while a person has the chat');
    const fwd = last(TEAM[0]);
    assert.equal(fwd.body, `#${code} Sorry, I am back: Are you there?`);
    await post([text(TEAM[0], 'Yes, Roshan here.', { context: { id: fwd.id } })]);
    assert.equal(last(CLIENT).body, 'Yes, Roshan here.');
    await post([text(TEAM[0], `#${code} bot`)]);
    assert.equal(contact().mode, 'bot');

    await post([text(CLIENT, `#${code} take`)]);                    // a client can't use team commands
    assert.equal(contact().mode, 'bot');
    assert.ok(!to(CLIENT).some((s) => s.body.startsWith('You have #')));
  });

  await t.test('Gemini busy: Malayalam gets fixed text and the team; English falls back to Groq', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, _user, provider) => {
      if (provider === 'gemini') return 429;
      if (task === 'extract') return question('How long does a website take?');
      if (task === 'answer') return { answer: 'Usually one to two weeks.', answer_en: 'Usually one to two weeks.' };
      return 500;
    };
    await toName(CLIENT, 'ml');
    await post([text(CLIENT, 'വെബ്സൈറ്റ് എത്ര സമയം എടുക്കും?')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.ml.checking), 'no Groq-written Malayalam');
    assert.equal(sb.tables.questions.length, 1);
    await toName(CLIENT2, 'en');
    await post([text(CLIENT2, 'How long does a website take?')]);
    assert.ok(last(CLIENT2).body.startsWith(TEXT.en.checking), 'no approved match: the team checks the draft first');
    assert.match(teamGot(TEAM[0], 'draft reply')!.body, /Draft reply: Usually one to two weeks\./, 'Groq wrote the English draft');
  });

  /* ---- review regressions (each one a confirmed finding) ---- */

  await t.test('a menu tap at the language step, a person request before the brief, thanks after it', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => (task === 'extract' ? (/someone/i.test(user) ? { ...blank, kind: 'person' } : { ...blank, kind: 'answer' }) : 500);
    await post([text(CLIENT, 'Hi')]);
    await post([text(CLIENT, 'Good morning to the team')]);        // typed instead of tapped: language list
    await post([tap(CLIENT, 'svc:website')]);                       // then the old menu is tapped
    assert.ok(!fx.sent.some((s) => s.body === 'undefined' || s.body.includes('undefined')), 'never "undefined"');
    assert.ok(last(CLIENT).ids.every((id) => id.startsWith('lang:')));
    assert.equal(contact().service, 'website');
    await post([tap(CLIENT, 'lang:en')]);
    await post([text(CLIENT, 'Can I talk to someone?')]);
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    assert.ok(teamGot(TEAM[0], 'asked for a person') && teamGot(TEAM[0], 'brief complete'), 'the full brief still reaches the team');
    const n0 = to(CLIENT).length;
    await post([text(CLIENT, 'Thank you')]);
    assert.equal(to(CLIENT).length, n0, 'no "Noted" for a thank-you');
    assert.doesNotMatch((await lead())?.message ?? '', /Thank you/);
  });

  await t.test('team replies: a lead alert is not a question, the review card goes to the client, STOP holds', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => {
      if (task === 'extract') return /hosting/i.test(user) ? question('Do you provide hosting?') : /someone/i.test(user) ? { ...blank, kind: 'person' } : { ...blank, kind: 'answer', name: user };
      if (task === 'answer') return { answer: '', answer_en: '' };
      if (task === 'faq') return { question_en: 'Do you provide hosting?', answer_en: 'Yes, in your name.' };
      return 500;
    };
    await toName();
    await post([text(CLIENT, 'Do you do hosting?')]);
    await post([text(CLIENT, 'Can I talk to someone?')]);
    const code = contact().code;
    const leadAlert = teamGot(TEAM[0], 'asked for a person')!;
    await post([text(TEAM[0], 'Can we call you at 3?', { context: { id: leadAlert.id } })]);
    assert.equal(last(CLIENT).body, 'Can we call you at 3?');
    assert.equal(sb.tables.questions[0].status, 'pending', 'a reply to a lead alert does not answer the open question');
    await post([text(TEAM[0], 'Yes, we set it up in your name.', { context: { id: teamGot(TEAM[0], `#${code} question`)!.id } })]);
    const card = last(TEAM[0]);
    assert.equal(card.type, 'button');
    await post([text(TEAM[0], 'Also, we can start this week.', { context: { id: card.id } })]);
    assert.equal(last(CLIENT).body, 'Also, we can start this week.', 'a reply to the card is a message to the client');
    assert.equal(sb.tables.knowledge[0].status, 'pending', 'and never approves anything');
    await post([text(CLIENT, 'STOP')]);
    await post([text(TEAM[1], `#${code} take`)]);
    assert.match(last(TEAM[1]).body, /opted out/);
    assert.equal(contact().mode, 'stopped');
  });

  await t.test('team text with a number goes to a Malayalam client exactly as written; money is never generated', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => {
      if (task === 'extract') return /cost/i.test(user) ? question('How much does a website cost?') : question('Can I call you?');
      if (task === 'answer') return { answer: 'A website costs ₹15,000.', answer_en: 'A website costs ₹15,000.' };          // a model that ignored its rules
      if (task === 'translate') return { text: `[ml] ${user}` };
      return 500;
    };
    await toName(CLIENT, 'ml');
    await post([text(CLIENT, 'What does a website cost?')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.ml.checking), 'the price answer was not sent');
    await post([text(TEAM[0], `#${contact().code} Call us on 9876543210 any time.`)]);
    assert.equal(last(CLIENT).body, 'Call us on 9876543210 any time.');
    assert.match(teamGot(TEAM[0], 'Sent to')!.body, /as you wrote it/);
  });

  await t.test('an admin delete lasts; reactions are ignored; username-only clients get `recipient`', async () => {
    await reset();
    await toName();
    await db.prepare('DELETE FROM leads WHERE phone = ?').bind(`+${CLIENT}`).run();
    await post([text(CLIENT, 'Ravi')]);
    assert.equal(await lead(), null, 'not re-created');
    const before = fx.sent.length;
    await post([{ from: CLIENT, id: `wamid.in.${++n}`, timestamp: ts(), type: 'reaction', reaction: { message_id: 'wamid.out.1', emoji: '👍' } }]);
    assert.equal(fx.sent.length, before);
    await post([{ from_user_id: 'IN.1349876', id: `wamid.in.${++n}`, timestamp: ts(), type: 'text', text: { body: 'Hi' } }]);
    const raw = (last('IN.1349876') as Sent & { raw: Row }).raw;
    assert.equal(raw.recipient, 'IN.1349876');
    assert.equal(raw.to, undefined);
  });

  await t.test('a burst of questions stays within the free plan’s 50 calls; the cron finishes the rest', async () => {
    await reset();
    await teamHi();
    let k = 0;
    fx.state.ai = (task) => (task === 'extract' ? question(`Question number ${++k}?`) : task === 'answer' ? { answer: '', answer_en: '' } : 500);
    await toName();
    const start = fx.counter.calls;
    await post(Array.from({ length: 6 }, (_, i) => text(CLIENT, `Question ${i}?`)));
    assert.ok(fx.counter.calls - start <= 48, `${fx.counter.calls - start} calls in one invocation`);
    for (let i = 0; i < 5 && sb.tables.messages.some((m) => m.wa_id === CLIENT && m.dir === 'in' && !m.handled_at); i++) {
      now += 3 * MIN;
      const c0 = fx.counter.calls;
      await tick(env, now);
      assert.ok(fx.counter.calls - c0 <= 48, 'a cron run keeps within the budget too');
    }
    assert.equal(sb.tables.questions.length, 6, 'every question reached the team exactly once');
    assert.ok(sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'in').every((m) => m.handled_at));
  });
  /* ---- phase 1: safe start ---- */

  await t.test('phase 1: first message says it is automated; training mode turns every AI answer into a one-tap draft', async () => {
    await reset();
    await teamHi();
    env.TRAINING_DAYS = '14';
    try {
      sb.tables.knowledge.push({ id: 901, question_en: 'Do you build websites in Malayalam?', answer_en: 'Yes, in Malayalam and English.', embedding: JSON.stringify(fakeEmbedding('Do you build websites in Malayalam?')), status: 'approved', source: 'site' });
      fx.state.ai = (task, user) => {
        if (task === 'extract') return /malayalam/i.test(user) ? question('Do you build websites in Malayalam?') : /support/i.test(user) ? question('Do you give support after launch?') : { ...blank, kind: 'answer', name: user };
        if (task === 'answer') return /Malayalam/.test(user) ? { answer: 'Yes, we build in Malayalam and English.', answer_en: 'Yes, we build in Malayalam and English.' } : { answer: 'We fix issues for 30 days.', answer_en: 'We fix issues for 30 days.' };
        if (task === 'faq') return /malayalam/i.test(user) ? { question_en: 'Do you build websites in Malayalam?', answer_en: 'Yes, in Malayalam and English.' }
          : { question_en: 'Do you give support after launch?', answer_en: 'Thirty days of fixes, then on request.' };
        return 500;
      };
      await post([text(CLIENT, 'Hi')]);
      assert.match(last(CLIENT).body, /automated/);
      await post([tap(CLIENT, 'svc:website')]);
      await post([tap(CLIENT, 'lang:en')]);
      await post([text(CLIENT, 'Can you make it in Malayalam?')]);
      assert.ok(last(CLIENT).body.startsWith(TEXT.en.checking), 'even a perfect match waits for the team in training');
      const code = contact().code;
      const card = teamGot(TEAM[0], `#${code} draft reply`)!;
      assert.equal(card.type, 'button');
      const q = sb.tables.questions.at(-1)!;
      assert.deepEqual(card.ids, [`dr:s:${q.id}`, `dr:w:${q.id}`]);
      assert.match(card.body, /Brief so far: Website/);
      await post([tap(TEAM[0], `dr:s:${q.id}`, 'button_reply', 'Send')]);
      assert.equal(last(CLIENT).body, 'Yes, in Malayalam and English.', 'the draft (the approved words) goes to the client as written');
      assert.equal(sb.tables.questions.at(-1)!.status, 'answered');
      assert.equal(sb.tables.knowledge.length, 1, 'an approved answer sent again teaches nothing new (no duplicate)');
      assert.match(last(TEAM[0]).body, /^Sent to #/);
      await post([tap(TEAM[1], `dr:s:${q.id}`, 'button_reply', 'Send')]);
      assert.match(last(TEAM[1]).body, /Already answered/);

      // "Write my own": the member's answer replaces the draft, then the usual Approve card.
      await post([text(CLIENT, 'Do you give support later?')]);
      const q2 = sb.tables.questions.at(-1)!;
      await post([tap(TEAM[0], `dr:w:${q2.id}`, 'button_reply', 'Write my own')]);
      const prompt = last(TEAM[0]);
      assert.match(prompt.body, /Reply to this message with your answer/);
      await post([text(TEAM[0], 'Thirty days of free fixes, then on request.', { context: { id: prompt.id } })]);
      assert.equal(last(CLIENT).body, 'Thirty days of free fixes, then on request.');
      assert.equal(last(TEAM[0]).type, 'button', 'Approve / Edit / Reject card');

      // Training over and a close match: answered straight away.
      env.TRAINING_DAYS = '0';
      await post([text(CLIENT, 'Malayalam website possible?')]);
      assert.match(last(CLIENT).body, /^Yes, in Malayalam and English\./);
    } finally { env.TRAINING_DAYS = '0'; }
  });

  await t.test('phase 1: "send" in reply to a draft (template, no buttons) sends it', async () => {
    await reset();
    env.TRAINING_DAYS = '14';
    try {
      fx.state.ai = (task) => (task === 'extract' ? question('Do you work weekends?') : task === 'answer' ? { answer: 'We work Monday to Saturday.', answer_en: 'We work Monday to Saturday.' } : 500);
      await toName();
      await post([text(CLIENT, 'Weekends?')]);
      const alert = to(TEAM[0])[0];
      assert.equal(alert.type, 'template', 'team window closed: template, no buttons');
      await post([text(TEAM[0], 'send', { context: { id: alert.id } })]);
      assert.equal(last(CLIENT).body, 'We work Monday to Saturday.');
    } finally { env.TRAINING_DAYS = '0'; }
  });

  await t.test('phase 1: a price question offers a call and tells the team; discounts and deadlines need a decision', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => {
      if (task === 'extract') {
        if (/cost/i.test(user)) return { ...question('How much does a website cost?'), price: true };
        if (/discount/i.test(user)) return question('Can I get a discount?', true);
        return { ...blank, kind: 'answer', name: user };
      }
      return 500;
    };
    await toName();
    await post([text(CLIENT, 'How much will it cost?')]);
    const offer = last(CLIENT);
    assert.equal(offer.type, 'button');
    assert.equal(offer.body, TEXT.en.price);
    assert.deepEqual(offer.ids, ['call:y', 'call:n']);
    const code = contact().code;
    assert.ok(teamGot(TEAM[0], `#${code} price question`));
    await post([tap(CLIENT, 'call:y', 'button_reply')]);
    assert.deepEqual(last(CLIENT).ids, ['how:wa', 'how:ph', 'how:meet'], 'how they want to talk (phase 5)');
    await post([tap(CLIENT, 'how:wa', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.callSoon, 'no calendar: the team arranges it');
    assert.ok(teamGot(TEAM[0], 'wants a call'));
    await post([tap(CLIENT, 'call:n', 'button_reply')]);
    assert.equal(last(CLIENT).body, `${TEXT.en.keepGoing}\n\n${TEXT.en.name}`);
    await post([text(CLIENT, 'Any discount for a small shop?')]);
    const decision = teamGot(TEAM[0], 'needs your decision')!;
    assert.match(decision.body, /Any discount for a small shop\?[\s\S]*Brief so far:/);
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.checking));
  });

  await t.test('phase 1: an upset or urgent client goes straight to a person', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => (task === 'extract' ? (/useless/i.test(user) ? { ...blank, kind: 'answer', mood: 'upset' } : { ...blank, kind: 'answer', name: user }) : 500);
    await toName();
    await post([text(CLIENT, 'This is useless, nobody replied to me yesterday!')]);
    assert.equal(last(CLIENT).body, TEXT.en.person);
    assert.equal(contact().mode, 'human');
    assert.equal(contact().taken_by, null);
    const code = contact().code;
    for (const m of TEAM) assert.ok(teamGot(m, `#${code} ⚠ upset client`));
    const before = to(CLIENT).length;
    await post([text(CLIENT, 'Hello??')]);
    assert.equal(to(CLIENT).length, before, 'the bot stays quiet');
    for (const m of TEAM) assert.match(last(m).body, /Hello\?\?/, 'forwarded to the whole team');
    await post([text(TEAM[1], `#${code} bot`)]);
    assert.equal(contact().mode, 'bot');
  });

  await t.test('phase 1: abuse and floods block the chat; the team can unblock', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => (task === 'extract' ? (/idiot/i.test(user) ? { ...blank, kind: 'answer', abusive: true } : { ...blank, kind: 'answer', name: user }) : 500);
    await toName();
    await post([text(CLIENT, 'you idiots')]);
    const code = contact().code;
    assert.equal(contact().mode, 'human', 'one flag: a person takes over (the AI may have misread it)');
    assert.match(teamGot(TEAM[0], `#${code}`)!.body, /you idiots/, 'the alert carries the words');
    await post([text(TEAM[0], `#${code} bot`)]);
    await post([text(CLIENT, 'you idiots, all of you')]);
    assert.equal(contact().mode, 'blocked', 'the second flag blocks');
    assert.ok(teamGot(TEAM[0], `#${code} blocked: abusive messages`));
    const before = to(CLIENT).length;
    await post([text(CLIENT, 'hello')]);
    assert.equal(to(CLIENT).length, before, 'no reply to a blocked chat');
    await post([text(TEAM[0], `#${code} unblock`)]);
    assert.equal(contact().mode, 'bot');

    await post(Array.from({ length: 10 }, () => text(CLIENT2, 'buy cheap followers now')));
    assert.equal(contact(CLIENT2).mode, 'blocked', 'the same text flooding in');
    assert.ok(teamGot(TEAM[0], 'blocked: a flood of messages'));
  });

  await t.test('phase 1: DELETE MY DATA asks first, then erases the chat, the contact and the lead', async () => {
    await reset();
    await teamHi();
    await toName();
    await post([text(CLIENT, 'Ravi')]);
    assert.ok(await lead());
    await post([text(CLIENT, 'Delete my data')]);
    assert.deepEqual(last(CLIENT).ids, ['del:y', 'del:n']);
    await post([tap(CLIENT, 'del:n', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.kept);
    assert.ok(contact());
    const code = contact().code;
    await post([tap(CLIENT, 'del:y', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.deleted);
    assert.equal(sb.tables.contacts.find((c) => c.wa_id === CLIENT), undefined);
    assert.equal(sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'in').length, 0);
    assert.equal(await lead(), null);
    assert.ok(!teamGot(TEAM[0], `#${code} asked to delete their data`), 'the team had nothing of theirs (no alert, no question): no notice');
    await post([text(CLIENT, 'Hi again')]);
    assert.equal(last(CLIENT).type, 'list', 'a later message starts fresh');
    assert.notEqual(contact().code, code);
  });

  await t.test('phase 1: a returning client chooses the earlier enquiry or a new one', async () => {
    await reset();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    const first = contact().lead_id;
    now += 31 * 24 * 60 * MIN;
    await post([text(CLIENT, 'Hi')]);
    assert.deepEqual(last(CLIENT).ids, ['ret:same', 'ret:new']);
    await post([tap(CLIENT, 'ret:same', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.sameProject);
    assert.equal(contact().lead_id, first, 'same enquiry, same lead');
    now += 31 * 24 * 60 * MIN;
    await post([text(CLIENT, 'Hello')]);
    await post([tap(CLIENT, 'ret:new', 'button_reply')]);
    assert.equal(last(CLIENT).type, 'list', 'a new enquiry starts at the menu');
    assert.notEqual(contact().lead_id, first);
    assert.deepEqual(contact().fields.prev_leads, [first], 'the earlier lead is remembered, so DELETE MY DATA reaches it');
    assert.deepEqual(Object.keys(contact().fields).sort(), ['prev_leads', 'since'], 'nothing else of the old brief');
  });
  /* ---- phase 2: self-learning ---- */

  await t.test('phase 2: a reply the team writes on its own also becomes a suggested answer; small talk does not', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => {
      if (task === 'extract') return /someone/i.test(user) ? { ...blank, kind: 'person' } : { ...blank, kind: 'answer', name: user };
      if (task === 'faq') return /domain/i.test(user) ? { question_en: 'Do I need my own domain?', answer_en: 'We register it in your name.' } : { question_en: '', answer_en: '' };
      return 500;
    };
    await toName();
    await post([text(CLIENT, 'Do I need to buy a domain? Can I talk to someone?')]);
    const leadAlert = teamGot(TEAM[0], 'asked for a person')!;
    await post([text(TEAM[0], 'Ok', { context: { id: leadAlert.id } })]);
    assert.equal(last(TEAM[0]).type, 'text', 'two words: just relayed, no card');
    await post([text(TEAM[0], 'We register the domain in your name for you.', { context: { id: leadAlert.id } })]);
    assert.equal(last(CLIENT).body, 'We register the domain in your name for you.');
    const card = last(TEAM[0]);
    assert.equal(card.type, 'button');
    assert.match(card.body, /Q: Do I need my own domain\?/);
    assert.equal(sb.tables.knowledge.at(-1)!.status, 'pending');
  });

  await t.test('phase 2: approved answers get team-approved translations, used word for word', async () => {
    await reset();
    await teamHi();
    let answerCalls = 0;
    fx.state.ai = (task, user) => {
      if (task === 'extract') return /hosting|ഹോസ്റ്റിംഗ്/.test(user) ? question('Do you provide hosting?') : { ...blank, kind: 'answer', name: user };
      if (task === 'answer') { answerCalls++; return { answer: '', answer_en: '' }; }
      if (task === 'faq') return { question_en: 'Do you provide hosting?', answer_en: 'Yes, we set up hosting in your name.' };
      if (task === 'translations') return { ml: 'അതെ, നിങ്ങളുടെ പേരിൽ ഹോസ്റ്റിംഗ്.', mg: 'Athe, ningalude peril hosting.', hi: 'हाँ, आपके नाम पर होस्टिंग।', kn: 'ಹೌದು, ನಿಮ್ಮ ಹೆಸರಿನಲ್ಲಿ ಹೋಸ್ಟಿಂಗ್.' };
      return 500;
    };
    await toName(CLIENT, 'en');
    await post([text(CLIENT, 'Do you do hosting?')]);
    const alert = teamGot(TEAM[0], 'question')!;
    await post([text(TEAM[0], 'Yes, we set up hosting in your name.', { context: { id: alert.id } })]);
    const k = sb.tables.knowledge.at(-1)!;
    await post([tap(TEAM[0], `kb:a:${k.id}`, 'button_reply', 'Approve')]);
    const shown = to(TEAM[0]).find((x) => x.body.startsWith('Translations of:'))!;
    assert.match(shown.body, /Malayalam:\nഅതെ/);
    assert.match(shown.body, /Kannada:\nಹೌದು/);
    assert.deepEqual(last(TEAM[0]).ids, [`tr:a:${k.id}`, `tr:s:${k.id}`]);
    assert.equal(sb.tables.knowledge.at(-1)!.translations_ok, false, 'not used until approved');
    await post([tap(TEAM[0], `tr:a:${k.id}`, 'button_reply', 'Approve all')]);
    assert.equal(sb.tables.knowledge.at(-1)!.translations_ok, true);

    await toName(CLIENT2, 'ml');
    const before = answerCalls;
    await post([text(CLIENT2, 'ഹോസ്റ്റിംഗ് ഉണ്ടോ?')]);
    assert.ok(last(CLIENT2).body.startsWith('അതെ, നിങ്ങളുടെ പേരിൽ ഹോസ്റ്റിംഗ്.'), 'the approved Malayalam, word for word');
    assert.equal(answerCalls, before, 'no AI call to write it');
  });

  await t.test('phase 2: the tone guide shapes answers, and Monday 10 a.m. brings the learning report', async () => {
    await reset();
    await teamHi();
    let answerSystem = '';
    fx.state.ai = (task, user, _p, system) => {
      if (task === 'extract') return question(/weekend/i.test(user) ? 'Do you work weekends?' : 'Do you do logos?');
      if (task === 'answer') { answerSystem = system; return { answer: '', answer_en: '' }; }
      if (task === 'tone') return { text: 'Short, warm, says "we", no jargon.' };
      return 500;
    };
    sb.tables.settings.push({ key: 'tone', value: 'Friendly and brief.' });
    await toName();
    await post([text(CLIENT, 'Weekend work?')]);
    assert.match(answerSystem, /Write the way this team writes: Friendly and brief\./);
    await post([text(CLIENT, 'Do you design logos too?')]);
    for (const m of ['We usually reply within two hours on working days.', 'Happy to help with that, we can start next week.', 'Thanks for waiting, we have checked with the designer.',
      'Sure, we will send the preview link by evening.', 'We keep everything in your name, always.']) await post([text(TEAM[0], m)]);
    sb.tables.knowledge.push({ id: 950, question_en: 'Do you do logos?', answer_en: 'Yes, simple logos.', status: 'pending', source: 'team' });
    now = Date.parse('2026-10-19T04:30:00Z');                     // Monday 10:00 IST
    await teamHi();                                               // the team's 24-hour windows are open
    await tick(env, now);
    const report = teamGot(TEAM[0], 'Weekly learning report')!;
    assert.match(report.body, /Questions: 2\. Answered by the bot: 0\. Went to the team: 2\. Still open: 2\./);
    assert.match(report.body, /Most asked:\n1\. do you work weekends/);
    assert.match(report.body, /1 answer waiting for your Approve/);
    assert.match(report.body, /Tone guide now: Short, warm, says "we", no jargon\./);
    assert.ok(to(TEAM[0]).some((x) => x.ids.includes('kb:a:950')), 'the waiting answer as a one-tap card');
    assert.equal(sb.tables.settings.find((x) => x.key === 'tone')!.value, 'Short, warm, says "we", no jargon.');
    const count = to(TEAM[0]).length;
    now += 2 * MIN;
    await tick(env, now);
    assert.equal(to(TEAM[0]).length, count, 'once a week');
  });

  await t.test('phase 2: answers used in chats that became won deals are preferred on a near-tie', async () => {
    await reset();
    const v = JSON.stringify(fakeEmbedding('How fast can you start?'));
    sb.tables.knowledge.push({ id: 960, question_en: 'How fast can you start?', answer_en: 'Within a week.', embedding: v, status: 'approved', source: 'team', wins: 0 });
    sb.tables.knowledge.push({ id: 961, question_en: 'How fast can you start?', answer_en: 'Usually this week, after a short call.', embedding: v, status: 'approved', source: 'team', wins: 0 });
    fx.state.ai = (task) => (task === 'extract' ? question('How fast can you start?') : 500);
    await toName();
    await post([text(CLIENT, 'How fast can you start?')]);
    assert.ok(last(CLIENT).body.startsWith('Within a week.'), 'first of two equal answers');
    sb.tables.questions.length = 0;                               // only this chat's answer 961 counts
    sb.tables.questions.push({ id: 970, wa_id: CLIENT, question: 'x', question_en: 'How fast can you start?', status: 'answered', kind: 'auto', knowledge_id: 961 });
    await db.prepare(`UPDATE leads SET status = 'won' WHERE phone = ?`).bind(`+${CLIENT}`).run();
    now = Date.parse('2026-10-20T21:30:00Z');
    await tick(env, now);
    assert.equal(sb.tables.knowledge.find((k) => k.id === 961)!.wins, 1);
    assert.equal(contact().won_counted, true);
    await tick(env, now + 24 * 60 * MIN);
    assert.equal(sb.tables.knowledge.find((k) => k.id === 961)!.wins, 1, 'each won chat counts once');
    await toName(CLIENT2);
    now += 30 * MIN;
    await post([text(CLIENT2, 'How fast can you start?')]);
    assert.ok(last(CLIENT2).body.startsWith('Usually this week, after a short call.'), 'the answer from a won deal');
  });
  /* ---- phase 2 review fixes ---- */

  await t.test('phase 2 fixes: Send on an AI-written draft only suggests it; the card works by words when it is a template', async () => {
    await reset();
    env.TRAINING_DAYS = '14';
    try {
      fx.state.ai = (task, user) => {
        if (task === 'extract') return question('Do you work weekends?');
        if (task === 'answer') return { answer: 'We work Monday to Saturday.', answer_en: 'We work Monday to Saturday.' };
        if (task === 'faq') { assert.ok(JSON.parse(user).client_message, 'the client\'s words are marked as theirs'); return { question_en: 'Do you work weekends?', answer_en: 'Monday to Saturday.' }; }
        return 500;
      };
      await toName();
      await post([text(CLIENT, 'Weekends?')]);
      const alert = to(TEAM[0])[0];
      assert.equal(alert.type, 'template', 'team window closed');
      await post([text(TEAM[0], 'send', { context: { id: alert.id } })]);
      assert.equal(last(CLIENT).body, 'We work Monday to Saturday.');
      const k = sb.tables.knowledge.at(-1)!;
      assert.equal(k.status, 'pending', 'nothing is approved unseen');
      const card = last(TEAM[0]);
      assert.match(card.body, /Q: Do you work weekends\?\nA: Monday to Saturday\./);
      assert.match(card.body, /reply "approve" or "reject"/);
      await post([text(TEAM[0], 'approve', { context: { id: card.id } })]);
      assert.equal(sb.tables.knowledge.at(-1)!.status, 'approved');
      await post([tap(TEAM[0], `kb:r:${k.id}`, 'button_reply', 'Reject')]);
      assert.equal(sb.tables.knowledge.at(-1)!.status, 'rejected', 'an approved answer can be withdrawn');
    } finally { env.TRAINING_DAYS = '0'; }
  });

  await t.test('phase 2 fixes: wins only break near-ties; Edit drops old translations; prices in any language stay with the team', async () => {
    await reset();
    const v = (s: string) => JSON.stringify(fakeEmbedding(s));
    sb.tables.knowledge.push({ id: 980, question_en: 'Do you build Android apps?', answer_en: 'Yes, Android apps too.', embedding: v('Do you build Android apps?'), status: 'approved', source: 'team', wins: 0 });
    sb.tables.knowledge.push({ id: 981, question_en: 'Do you build Android apps cheap?', answer_en: 'Yes, cheap ones.', embedding: v('Do you build Android apps cheap?'), status: 'approved', source: 'team', wins: 5 });
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Android apps?') : 500);
    await toName();
    await post([text(CLIENT, 'Android apps?')]);
    assert.ok(last(CLIENT).body.startsWith('Yes, Android apps too.'), 'the closer answer, despite the other one\'s wins');

    await teamHi();
    sb.tables.knowledge.find((k) => k.id === 980)!.translations = { ml: 'old' };
    await post([tap(TEAM[0], 'kb:e:980', 'button_reply', 'Edit')]);
    await post([text(TEAM[0], 'Yes, Android and iPhone apps.', { context: { id: last(TEAM[0]).id } })]);
    const k = sb.tables.knowledge.find((x) => x.id === 980)!;
    assert.equal(k.answer_en, 'Yes, Android and iPhone apps.');
    assert.deepEqual(k.translations, {});
    await post([tap(TEAM[0], 'tr:a:980', 'button_reply', 'Approve all')]);           // an old card
    await toName(CLIENT2, 'hi');
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Android apps?') : task === 'answer' ? { answer: 'हाँ, लगभग 15 हज़ार में।', answer_en: 'Yes, for about 15 thousand.' } : 500);
    await post([text(CLIENT2, 'Android ऐप?')]);
    assert.ok(!to(CLIENT2).some((m) => m.body.includes('हज़ार')), 'a price in Hindi is never sent');
    assert.ok(last(CLIENT2).body.startsWith(TEXT.hi.checking));
  });

  await t.test('phase 2 fixes: the weekly report goes out once even when a tick fails, and team messages run once', async () => {
    await reset();
    await teamHi();
    now = Date.parse('2026-10-19T04:30:00Z');                     // Monday 10:00 IST
    await teamHi();
    sb.state.down = true;
    await tick(env, now).catch(() => {});
    sb.state.down = false;
    now += 2 * MIN;
    await tick(env, now);
    assert.equal(to(TEAM[0]).filter((m) => m.body.startsWith('Weekly learning report')).length, 1, 'the next tick in the hour sends it');
    now += 2 * MIN;
    await tick(env, now);
    assert.equal(to(TEAM[0]).filter((m) => m.body.startsWith('Weekly learning report')).length, 1, 'once');

    await toName();
    const code = contact().code, before = to(CLIENT).length;
    sb.tables.messages.push({ wamid: 'wamid.team.race', wa_id: null, team: TEAM[0], dir: 'in', body: `#${code} Hello from the team`, reply_id: null, ctx_id: null,
      profile: null, question_id: null, knowledge_id: null, handled_at: null, at: new Date(now - 5 * MIN).toISOString() });
    await Promise.all([tick(env, now), tick(env, now)]);                    // two cron runs see the same stuck message
    assert.equal(to(CLIENT).filter((m) => m.body === 'Hello from the team').length, 1, 'claimed: sent once');
    assert.equal(to(CLIENT).length, before + 1);
  });

  /* ---- phase 1 review fixes ---- */

  await t.test('phase 1 fixes: STOP always opts out (after a month, or sent many times), never a flood block', async () => {
    await reset();
    await toName();
    for (const a of ['Ravi', 'Ravi Bakery']) await post([text(CLIENT, a)]);
    now += 31 * 24 * 60 * MIN;
    await post([text(CLIENT, 'STOP')]);
    assert.equal(contact().mode, 'stopped', 'not swallowed by the welcome-back question');
    assert.equal(last(CLIENT).body, TEXT.en.stopped);
    await toName(CLIENT2);
    await post(Array.from({ length: 5 }, () => text(CLIENT2, 'STOP')));
    assert.equal(contact(CLIENT2).mode, 'stopped', 'five STOPs at once still opt out');
  });

  await t.test('phase 1 fixes: an old message backlog or a few same short replies is not a flood', async () => {
    await reset();
    await toName();
    const old = Array.from({ length: 10 }, (_, i) => ({ ...text(CLIENT, `detail number ${i}`), timestamp: String(Math.floor((now - (20 - 2 * i) * MIN) / 1000)) }));
    await post(old);
    assert.notEqual(contact().mode, 'blocked', 'ten messages over twenty minutes');
    await post(Array.from({ length: 4 }, () => text(CLIENT, 'ok')));
    assert.notEqual(contact().mode, 'blocked', 'short acknowledgements');
  });

  await t.test('phase 1 fixes: "Yes" in reply to Write-my-own is the answer, not the draft', async () => {
    await reset();
    await teamHi();
    env.TRAINING_DAYS = '14';
    try {
      fx.state.ai = (task) => (task === 'extract' ? question('Do you publish apps to the Play Store?') : task === 'answer' ? { answer: 'No, we only build web apps.', answer_en: 'No, we only build web apps.' } : 500);
      await toName();
      await post([text(CLIENT, 'Play Store?')]);
      const q = sb.tables.questions.at(-1)!;
      await post([tap(TEAM[0], `dr:w:${q.id}`, 'button_reply', 'Write my own')]);
      await post([text(TEAM[0], 'Yes', { context: { id: last(TEAM[0]).id } })]);
      assert.equal(last(CLIENT).body, 'Yes');
      assert.ok(!to(CLIENT).some((m) => m.body === 'No, we only build web apps.'));
    } finally { env.TRAINING_DAYS = '0'; }
  });

  await t.test('phase 1 fixes: the draft card keeps the whole draft within WhatsApp limits (1024 / 900)', async () => {
    await reset();
    await teamHi();
    env.TRAINING_DAYS = '14';
    try {
      const long = 'ഞങ്ങൾ വെബ്സൈറ്റ് ഉണ്ടാക്കുന്നു. '.repeat(30), longEn = 'We build the website for you. '.repeat(30);
      fx.state.ai = (task) => (task === 'extract' ? question('Q '.repeat(200)) : task === 'answer' ? { answer: long, answer_en: longEn } : 500);
      await toName(CLIENT, 'ml');
      await post([text(CLIENT, 'ചോദ്യം '.repeat(100))]);
      const card = teamGot(TEAM[0], 'draft reply')!;
      assert.ok(card.body.length <= 1024, String(card.body.length));
      const q = sb.tables.questions.at(-1)!;
      assert.ok(card.body.includes(q.draft), 'the words that would be sent, uncut');
      assert.equal(q.draft.length, 700);
      assert.ok(card.body.indexOf('Tap Send') < 900, 'the instruction survives a template too');
    } finally { env.TRAINING_DAYS = '0'; }
  });

  await t.test('phase 1 fixes: blocked chats get no relays or timers; "#CODE delete" sends the delete question', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task) => (task === 'extract' ? question('Can you start tomorrow?') : 500);
    await toName();
    await post([text(CLIENT, 'Start tomorrow?')]);
    const code = contact().code, before = to(CLIENT).length;
    contact().mode = 'blocked';
    await post([text(TEAM[0], `#${code} Yes we can`)]);
    assert.match(last(TEAM[0]).body, /is blocked, so nothing was sent/);
    now += 11 * MIN;
    await tick(env, now);
    assert.equal(to(CLIENT).length, before, 'no 10-minute message either');
    contact().mode = 'bot';
    await post([text(TEAM[0], `#${code} delete`)]);
    assert.deepEqual(last(CLIENT).ids, ['del:y', 'del:n']);
    await post([text(TEAM[0], `#${code} unblock`)]);
    assert.match(last(TEAM[0]).body, /was not blocked/);
  });

  await t.test('phase 1 fixes: DELETE MY DATA reaches earlier leads and team copies; a blocked chat stays blocked', async () => {
    await reset();
    await teamHi();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    const code = contact().code;
    const alert = teamGot(TEAM[0], `#${code}`)!;
    await post([text(TEAM[0], 'Thanks, calling you today.', { context: { id: alert.id } })]);
    now += 31 * 24 * 60 * MIN;
    await teamHi();
    await post([text(CLIENT, 'Hi')]);
    await post([tap(CLIENT, 'ret:new', 'button_reply')]);
    await post([tap(CLIENT, 'svc:seo')]);
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE source = 'whatsapp'`).first<Row>())!.n, 2);
    await post([text(CLIENT, 'please delete my data')]);
    await post([tap(CLIENT, 'del:y', 'button_reply')]);
    assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE source = 'whatsapp'`).first<Row>())!.n, 0, 'both enquiries');
    assert.equal(sb.tables.messages.filter((m) => m.wa_id === CLIENT).length, 0, 'the team reply about them too');
    assert.ok(!sb.tables.messages.some((m) => m.body === 'Thanks, calling you today.'));

    await toName(CLIENT2);
    contact(CLIENT2).mode = 'blocked';
    await post([text(CLIENT2, 'delete my data')]);
    await post([tap(CLIENT2, 'del:y', 'button_reply')]);
    assert.equal(last(CLIENT2).body, TEXT.en.deleted);
    assert.equal(contact(CLIENT2).mode, 'blocked', 'a bare record keeps the block');
    assert.equal(contact(CLIENT2).profile_name, null);
    const n2 = to(CLIENT2).length;
    await post([text(CLIENT2, 'Hi')]);
    assert.equal(to(CLIENT2).length, n2, 'still no replies');
  });

  await t.test('phase 1 fixes: an upset client stays with the bot when no team member can be reached', async () => {
    await reset();
    fx.state.ai = (task) => (task === 'extract' ? { ...blank, kind: 'answer', mood: 'upset' } : 500);
    await toName();
    env.TEAM_WHATSAPP = '';
    try {
      await post([text(CLIENT, 'This is taking forever!')]);
      assert.equal(contact().mode, 'bot');
      assert.notEqual(last(CLIENT).body, TEXT.en.person);
    } finally { env.TEAM_WHATSAPP = TEAM.join(','); }
  });
  /* ---- phase 3: the full requirement ---- */

  await t.test('phase 3: each service asks its own question, sites and apps ask for websites they like, and the lead gets a one-page brief', async () => {
    await reset();
    await teamHi();
    await toName();
    for (const a of ['Ravi', 'Ravi Bakery', 'A website for my bakery']) await post([text(CLIENT, a)]);
    assert.equal(last(CLIENT).body, DETAILS.en.website);
    assert.deepEqual(last(CLIENT).ids, ['skip:details']);
    await post([text(CLIENT, 'About 5 pages, I already have ravibakery.in')]);
    assert.equal(last(CLIENT).body, TEXT.en.refs);
    await post([tap(CLIENT, 'skip:refs', 'button_reply', TEXT.en.skip)]);
    assert.ok(last(CLIENT).ids.every((id) => id.startsWith('tl:')), 'then the timeline');
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    const code = contact().code, row = await lead();
    assert.match(row?.message, /Details: About 5 pages, I already have ravibakery\.in/);
    assert.doesNotMatch(row?.message, /Websites they like/, 'skipped, so left out');
    assert.match(row?.brief, new RegExp(`^Enquiry brief #${code} · 2026-10-14 · WhatsApp · English`));
    assert.match(row?.brief, /Client: Ravi\nBusiness: Ravi Bakery\nService: Website/);
    assert.match(row?.brief, /Websites they like: -/);
    assert.match(teamGot(TEAM[0], `#${code}`)!.body, /Details: About 5 pages/);

    // NFC: its own question, no websites question; "Something else": neither.
    await post([text(CLIENT2, 'Hi')]);
    await post([tap(CLIENT2, 'svc:nfc')]);
    await post([tap(CLIENT2, 'lang:hi')]);
    for (const a of ['Asha', 'Asha Clinic', 'NFC cards']) await post([text(CLIENT2, a)]);
    assert.equal(last(CLIENT2).body, DETAILS.hi.nfc);
    await post([text(CLIENT2, '50 cards, Google review')]);
    assert.ok(last(CLIENT2).ids.every((id) => id.startsWith('tl:')));
    await post([text(CLIENT3, 'Hi')]);
    await post([tap(CLIENT3, 'svc:other')]);
    await post([tap(CLIENT3, 'lang:en')]);
    for (const a of ['Joy', 'Joy Traders', 'Not sure yet']) await post([text(CLIENT3, a)]);
    assert.ok(last(CLIENT3).ids.every((id) => id.startsWith('tl:')));
  });

  await t.test('phase 3: with AI, the answer to the service question is kept in English', async () => {
    await reset();
    let system = '';
    fx.state.ai = (task, user, _p, sys) => {
      if (task !== 'extract') return 500;
      if (/പേജ്/.test(user)) { system = sys; return { ...blank, kind: 'answer', detail_en: 'About 5 pages; no domain yet.' }; }
      return { ...blank, kind: 'answer', name: user };
    };
    await toName(CLIENT, 'ml');
    for (const a of ['Ravi', 'Ravi Bakery', 'Website']) await post([text(CLIENT, a)]);
    await post([text(CLIENT, 'ഏകദേശം 5 പേജ്, ഡൊമെയ്ൻ ഇല്ല')]);
    assert.ok(system.includes(DETAILS.en.website), 'the extractor sees the exact question');
    assert.equal(contact().fields.details, 'About 5 pages; no domain yet.');
    assert.equal(last(CLIENT).body, TEXT.ml.refs);
  });

  await t.test('phase 3: voice notes are transcribed and handled like typed text', async () => {
    await reset();
    await teamHi();
    await toName(CLIENT, 'ml');
    fx.state.media['voice-1'] = { type: 'audio/ogg; codecs=opus', bytes: new Uint8Array([1, 2, 3]) };
    fx.state.voice = () => 'Ravi';
    const note = sent(CLIENT, 'voice', 'voice-1');
    await post([note]);
    assert.deepEqual(fx.whisper, ['ml'], 'with the language as a hint');
    assert.equal(contact().fields.name, 'Ravi');
    assert.equal(last(CLIENT).body, TEXT.ml.business);
    assert.equal(sb.tables.messages.find((m) => m.wamid === note.id)!.body, '🎤 Ravi', 'the chat keeps the words');
    fx.state.media['voice-2'] = { type: 'audio/ogg', bytes: new Uint8Array([4]) };
    fx.state.voice = () => 500;
    await post([sent(CLIENT, 'voice', 'voice-2')]);
    assert.equal(last(CLIENT).body, TEXT.ml.pleaseType, 'transcription failed: please type');
    fx.state.media['voice-3'] = { type: 'audio/ogg', bytes: new Uint8Array([4]), size: 6 * 1024 * 1024 };
    await post([sent(CLIENT, 'voice', 'voice-3')]);
    assert.equal(fx.whisper.length, 2, 'a long voice note is never downloaded or sent');
  });

  await t.test('phase 3: photos and documents are kept privately on the lead; DELETE MY DATA removes them', async () => {
    await reset();
    await teamHi();
    await toName();
    fx.state.media['img-1'] = { type: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff]) };
    fx.state.media['doc-1'] = { type: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.4') };
    fx.state.media['big-1'] = { type: 'video/mp4', bytes: new Uint8Array([0]), size: 25 * 1024 * 1024 };
    await post([sent(CLIENT, 'image', 'img-1')]);
    const id = contact().lead_id;
    assert.equal(last(CLIENT).body, `${TEXT.en.fileSaved}\n\n${TEXT.en.name}`, 'saved, then the question again');
    const obj = await bucket.get(`leads/${id}/1-img-1-image.jpg`);
    assert.equal(obj?.httpMetadata?.contentType, 'image/jpeg');
    await obj?.arrayBuffer();
    await post([sent(CLIENT, 'document', 'doc-1', { filename: 'our menu (final).pdf', caption: 'Ravi' })]);
    assert.ok(await bucket.head(`leads/${id}/2-doc-1-our_menu_final_.pdf`), 'the file name, made safe');
    assert.equal(contact().fields.name, 'Ravi', 'the caption is read like a message');
    await post([sent(CLIENT, 'video', 'big-1')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.fileBig));
    for (const a of ['Ravi Bakery', 'A website']) await post([text(CLIENT, a)]);
    await post([tap(CLIENT, 'skip:details', 'button_reply')]);
    await post([tap(CLIENT, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT, 'tl:0', 'button_reply')]);
    const row = await lead();
    assert.deepEqual(JSON.parse(row?.files), [`leads/${id}/1-img-1-image.jpg`, `leads/${id}/2-doc-1-our_menu_final_.pdf`]);
    assert.match(row?.brief, /Files: 2/);
    assert.match(teamGot(TEAM[0], `#${contact().code}`)!.body, /Files: 2 \(Admin → Leads\)/);
    await post([text(CLIENT, 'delete my data')]);
    await post([tap(CLIENT, 'del:y', 'button_reply')]);
    assert.equal((await bucket.list({ prefix: 'leads/' })).objects.length, 0);
  });

  await t.test('phase 3: a file sent while a person has the chat goes to them as a note', async () => {
    await reset();
    await teamHi();
    await toName();
    const code = contact().code;
    await post([text(TEAM[0], `#${code} take`)]);
    fx.state.media['img-2'] = { type: 'image/png', bytes: new Uint8Array([0x89, 0x50]) };
    const before = to(CLIENT).length;
    await post([sent(CLIENT, 'image', 'img-2', { caption: 'our logo' })]);
    assert.equal(to(CLIENT).length, before, 'the bot stays quiet');
    assert.match(last(TEAM[0]).body, new RegExp(`#${code} .*📎 sent a file \\(Admin → Leads\\): our logo`));
  });

  await t.test('phase 3: matching published work after the brief', async () => {
    await reset();
    const add = (id: string, slug: string, title: string, category: string, published: number, featured = 0) =>
      db.prepare(`INSERT INTO projects (id, slug, title, client_type, category, summary, is_published, is_featured) VALUES (?, ?, ?, 'Bakery in Calicut', ?, 's', ?, ?)`)
        .bind(id, slug, title, category, published, featured).run();
    await add('p1', 'ravi-bakery', 'Ravi Bakery site', 'static', 1);
    await add('p2', 'hidden', 'Hidden draft', 'static', 0);
    await add('p3', 'clinic-app', 'Clinic bookings', 'dynamic', 1);
    await add('p4', 'placeholder', '[Project title]', 'static', 1);
    await add('p5', 'featured', 'Featured site', 'static', 1, 1);
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    const work = last(CLIENT).body;
    assert.ok(work.startsWith(TEXT.en.work));
    assert.ok(work.indexOf('/work/featured') < work.indexOf('/work/ravi-bakery'), 'featured first');
    assert.match(work, /• Ravi Bakery site \(Bakery in Calicut\): https:\/\/legitforge\.pages\.dev\/work\/ravi-bakery/);
    assert.doesNotMatch(work, /hidden|clinic-app|placeholder/);
  });

  await t.test('phase 3: one gentle reminder 3 hours after a client goes quiet mid-brief', async () => {
    await reset();
    await toName();                                               // Wednesday 11:00 IST, asked for their name
    await toName(CLIENT2);
    for (const a of ['Asha', 'Asha Clinic', 'Website']) await post([text(CLIENT2, a)]);
    fx.state.ai = (task) => (task === 'extract' ? question('Can you start tomorrow?', true) : 500);
    await toName(CLIENT3);
    await post([text(CLIENT3, 'Start tomorrow?')]);              // waiting for the team: no reminder
    fx.state.ai = () => 500;
    now += 2 * 60 * MIN;
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.body === TEXT.en.nudge), 'not before 3 hours');
    now += 61 * MIN;
    await tick(env, now);
    assert.equal(to(CLIENT).filter((m) => m.body === TEXT.en.nudge).length, 1);
    assert.equal(to(CLIENT2).filter((m) => m.body === TEXT.en.nudge).length, 1, 'quiet at the service question too');
    assert.ok(!to(CLIENT3).some((m) => m.body === TEXT.en.nudge));
    now += 2 * MIN;
    await tick(env, now);
    assert.equal(to(CLIENT).filter((m) => m.body === TEXT.en.nudge).length, 1, 'once');

    await reset();
    now = Date.parse('2026-10-14T12:00:00Z');                     // 17:30 IST: 3 hours later is after closing
    await toName();
    now += 3 * 60 * MIN + MIN;
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.body === TEXT.en.nudge), 'not after 7 p.m.');
  });
  /* ---- phase 3 review fixes ---- */

  await t.test('phase 3 fixes: a spoken "delete my data" or STOP works like a typed one; a voice note nobody can read is kept for the team', async () => {
    await reset();
    await teamHi();
    await toName();
    fx.state.media['v-del'] = { type: 'audio/ogg', bytes: new Uint8Array([1]) };
    fx.state.voice = () => 'Delete my data.';
    await post([sent(CLIENT, 'voice', 'v-del')]);
    assert.deepEqual(last(CLIENT).ids, ['del:y', 'del:n']);
    fx.state.media['v-stop'] = { type: 'audio/ogg', bytes: new Uint8Array([2]) };
    fx.state.voice = () => 'Stop.';
    await post([sent(CLIENT, 'voice', 'v-stop')]);
    assert.equal(contact().mode, 'stopped');

    await toName(CLIENT2);
    const code = contact(CLIENT2).code;
    await post([text(TEAM[0], `#${code} take`)]);
    fx.state.media['v-x'] = { type: 'audio/ogg', bytes: new Uint8Array([3]) };
    fx.state.voice = () => 500;
    await post([sent(CLIENT2, 'voice', 'v-x')]);
    assert.match(last(TEAM[0]).body, new RegExp(`#${code} .*📎 sent a voice note \\(Admin → Leads\\)`));
    assert.equal((await bucket.list({ prefix: `leads/${contact(CLIENT2).lead_id}/` })).objects.length, 1, 'the recording, for the team');
    assert.equal(fx.downloads.filter((d) => d === 'v-x').length, 1, 'downloaded once: Whisper and the file share it');
    await post([text(TEAM[0], `#${code} bot`)]);
    fx.state.media['v-big'] = { type: 'audio/ogg', bytes: new Uint8Array([4]), size: 6 * 1024 * 1024 };
    await post([sent(CLIENT2, 'voice', 'v-big')]);
    assert.equal(fx.whisper.length, 3, 'a long voice note never goes to Whisper');
    assert.equal(last(CLIENT2).body, TEXT.en.pleaseType);
  });

  await t.test('phase 3 fixes: an album gets one notice; a file that could not be kept is always said; a photo first gets the notice and the menu', async () => {
    await reset();
    for (const i of [1, 2, 3]) fx.state.media[`a-${i}`] = { type: 'image/jpeg', bytes: new Uint8Array([i]) };
    await post([sent(CLIENT, 'image', 'a-1')]);
    assert.equal(to(CLIENT).at(-2)!.body, TEXT.en.fileSaved, 'the notice, then the menu');
    assert.equal(last(CLIENT).type, 'list');
    const n = to(CLIENT).length;
    await post([sent(CLIENT, 'image', 'a-2')]);
    await post([sent(CLIENT, 'image', 'a-3')]);
    assert.equal(to(CLIENT).length, n, 'the rest of the album: no more notices');
    assert.equal(contact().fields.files.length, 3);
    await post([tap(CLIENT, 'svc:website')]);
    await post([tap(CLIENT, 'lang:en')]);
    fx.state.media['huge'] = { type: 'video/mp4', bytes: new Uint8Array([0]), size: 30 * 1024 * 1024 };
    await post([sent(CLIENT, 'video', 'huge', { caption: 'Ravi' })]);
    assert.ok(to(CLIENT).some((m) => m.body === TEXT.en.fileBig), 'told, even with a caption');
    assert.equal(contact().fields.name, 'Ravi', 'and the caption is still read');
  });

  await t.test('phase 3 fixes: Meta busy, so the file is retried by the cron, not lost', async () => {
    await reset();
    await toName();
    fx.state.media['slow'] = { type: 'image/png', bytes: new Uint8Array([9]), status: 503 };
    const photo = sent(CLIENT, 'image', 'slow');
    await post([photo]);
    assert.ok(!sb.tables.messages.find((m) => m.wamid === photo.id)!.handled_at, 'left for the cron');
    delete fx.state.media['slow'].status;
    now += 3 * MIN;
    await tick(env, now);
    assert.equal(contact().fields.files?.length, 1);
    assert.ok(to(CLIENT).some((m) => m.body.startsWith(TEXT.en.fileSaved)));
  });

  await t.test('phase 3 fixes: old Skip taps, a changed service, and a returning brief the team already has', async () => {
    await reset();
    await post([text(CLIENT, 'Hi')]);
    await post([tap(CLIENT, 'skip:details', 'button_reply')]);
    assert.equal(contact().step, 'service', 'an old Skip on a fresh chat: still the menu');
    assert.equal(last(CLIENT).type, 'list');
    await post([tap(CLIENT, 'svc:website')]);
    await post([tap(CLIENT, 'lang:en')]);
    for (const a of ['Ravi', 'Ravi Bakery', 'A website', 'About 5 pages']) await post([text(CLIENT, a)]);
    await post([tap(CLIENT, 'svc:nfc')]);
    assert.equal(contact().fields.details, undefined, 'the website answer does not stand for NFC');
    assert.equal(last(CLIENT).body, DETAILS.en.nfc);
    await post([text(CLIENT, '100 cards')]);
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    assert.ok(contact().alerted_at);
    delete contact().fields.details;                              // as if completed before the service question existed
    now += 31 * 24 * 60 * MIN;
    await post([text(CLIENT, 'Hi')]);
    await post([tap(CLIENT, 'ret:same', 'button_reply')]);
    assert.equal(last(CLIENT).body, TEXT.en.sameProject, 'the team has it: not reopened');
  });

  await t.test('phase 3 fixes: the brief is in English and lists only this enquiry’s questions', async () => {
    await reset();
    await teamHi();
    let briefSystem = '';
    fx.state.ai = (task, user, _p, system) => {
      if (task === 'extract') return /ഹോസ്റ്റിംഗ്/.test(user) ? question('Do you provide hosting?') : 500;
      if (task === 'translate' && /Enquiry brief/.test(user)) { briefSystem = system; return { text: user.replace('ഞാൻ', 'I') }; }
      return 500;
    };
    await post([text(CLIENT, 'Hi')]);
    sb.tables.questions.push({ id: 990, wa_id: CLIENT, question: 'old', question_en: 'An old enquiry question', status: 'answered', kind: 'question',
      created_at: new Date(now - 60 * 24 * 60 * MIN).toISOString() });
    contact().fields.since = new Date(now - MIN).toISOString();
    await post([tap(CLIENT, 'svc:website')]);
    await post([tap(CLIENT, 'lang:ml')]);
    await post([text(CLIENT, 'ഹോസ്റ്റിംഗ് ഉണ്ടോ?')]);
    for (const a of ['Ravi', 'Ravi Bakery', 'ഞാൻ ഒരു വെബ്സൈറ്റ്']) await post([text(CLIENT, a)]);
    await post([tap(CLIENT, 'skip:details', 'button_reply')]);
    await post([tap(CLIENT, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    const brief = (await lead())?.brief as string;
    assert.match(briefSystem, /into English/);
    assert.match(brief, /What they need: I ഒരു/);
    assert.match(brief, /Questions they asked:\n- Do you provide hosting\? \(pending\)/);
    assert.doesNotMatch(brief, /old enquiry/);
  });

  await t.test('phase 3 fixes: the 90-day purge removes old files; a lead deleted in Admin takes later files with it', async () => {
    await reset();
    await toName();
    fx.state.media['p-1'] = { type: 'image/jpeg', bytes: new Uint8Array([1]) };
    await post([sent(CLIENT, 'image', 'p-1')]);
    await post([text(CLIENT, 'Ravi')]);
    await db.prepare('DELETE FROM leads WHERE phone = ?').bind(`+${CLIENT}`).run();      // the admin deleted it
    fx.state.media['p-2'] = { type: 'image/jpeg', bytes: new Uint8Array([2]) };
    await post([text(CLIENT, 'Ravi Bakery')]);                    // the next save finds the lead gone
    await post([sent(CLIENT, 'image', 'p-2')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.fileBig), 'not kept any more');
    assert.equal((await bucket.list({ prefix: 'leads/' })).objects.length, 0, 'and the earlier file went with the lead');
    assert.equal(await lead(), null, 'the lead stays deleted');

    await toName(CLIENT2);
    fx.state.media['p-3'] = { type: 'image/jpeg', bytes: new Uint8Array([3]) };
    await post([sent(CLIENT2, 'image', 'p-3')]);
    assert.equal((await bucket.list({ prefix: 'leads/' })).objects.length, 1);
    now = Date.parse('2027-03-01T21:30:00Z');                     // 03:00 IST, more than 90 days after the upload
    await tick(env, now);
    assert.equal((await bucket.list({ prefix: 'leads/' })).objects.length, 0);
    assert.equal(sb.tables.settings.find((x) => x.key === 'purge_cursor')?.value, '', 'reached the end');
  });
  /* ---- phase 4: team workflow ---- */

  const seat = (whatsapp: string, services: string[], status = 'free', until: string | null = null) =>
    db.prepare('INSERT INTO bot_team (whatsapp, name, services, status, status_until) VALUES (?, ?, ?, ?, ?)')
      .bind(whatsapp, whatsapp === TEAM[0] ? 'Roshan' : 'Anu', JSON.stringify(services), status, until).run();
  const complete = async (who = CLIENT) => { await toName(who); await toTimeline(who); await post([tap(who, 'tl:1', 'button_reply')]); return contact(who).code; };

  await t.test('phase 4: an enquiry goes first to whoever handles its service; the other gets it 10 minutes later unless someone replied', async () => {
    await reset();
    await teamHi();
    await seat(TEAM[0], ['website', 'app']);
    await seat(TEAM[1], ['whatsapp', 'n8n']);
    const code = await complete();
    assert.ok(teamGot(TEAM[0], `#${code} new lead`), 'the website person');
    assert.ok(!teamGot(TEAM[1], `#${code}`), 'not yet the other');
    now += 9 * MIN;
    await tick(env, now);
    assert.ok(!teamGot(TEAM[1], `#${code}`), 'not before 10 minutes');
    now += 2 * MIN;
    await tick(env, now);
    assert.match(teamGot(TEAM[1], `#${code} new lead`)!.body, /Passed on: nobody replied in 10 minutes/);
    await tick(env, now + 2 * MIN);
    assert.equal(to(TEAM[1]).filter((m) => m.body.includes(`#${code}`)).length, 1, 'once');

    const code2 = await complete(CLIENT2);
    await post([text(TEAM[0], 'Hi, calling you in 5 minutes.', { context: { id: teamGot(TEAM[0], `#${code2}`)!.id } })]);
    now += 11 * MIN;
    await tick(env, now);
    assert.ok(!teamGot(TEAM[1], `#${code2}`), 'Roshan replied: not passed on');
  });

  await t.test('phase 4: "off", "busy", "free" and "who"; an upset client reaches everyone who is not off', async () => {
    await reset();
    await teamHi();
    await post([text(TEAM[0], 'off')]);
    assert.match(last(TEAM[0]).body, /^Off: you get no client alerts/);
    const code = await complete();
    assert.ok(teamGot(TEAM[1], `#${code} new lead`));
    now += 11 * MIN;
    await tick(env, now);
    assert.ok(!teamGot(TEAM[0], `#${code}`), 'off: never passed on either');

    await post([text(TEAM[1], 'busy 1h')]);
    assert.match(last(TEAM[1]).body, /^Busy until .*: the others are alerted first\./);
    await post([text(TEAM[0], 'free')]);
    const code2 = await complete(CLIENT2);
    assert.ok(teamGot(TEAM[0], `#${code2}`) && !teamGot(TEAM[1], `#${code2}`), 'the free one first');
    await post([text(TEAM[0], 'who')]);
    assert.match(last(TEAM[0]).body, /free[\s\S]*busy until/);

    fx.state.ai = (task) => (task === 'extract' ? { ...blank, kind: 'answer', mood: 'urgent' } : 500);
    await toName(CLIENT3);
    await post([text(CLIENT3, 'My site is down, help now!')]);
    const code3 = contact(CLIENT3).code;
    for (const m of TEAM) assert.ok(teamGot(m, `#${code3}`), 'urgent: everyone at once, busy or not');
    now += 61 * MIN;                                              // the hour of "busy" is over
    fx.state.ai = () => 500;
    const code4 = await complete('919844444444');
    assert.ok(teamGot(TEAM[0], `#${code4}`) && teamGot(TEAM[1], `#${code4}`), 'both free again: both first');
  });

  await t.test('phase 4: website form enquiries reach the team through the bot, once, in turns', async () => {
    await reset();
    await teamHi();
    await seat(TEAM[1], ['seo']);
    await db.prepare(`INSERT INTO leads (id, source, name, phone, service, message, whatsapp_consent, created_at) VALUES ('form-1', 'form', 'Meera', '+91 98000 00000', 'SEO', 'Rank my clinic in Calicut', 1, ?)`)
      .bind(new Date(now).toISOString().replace('T', ' ').slice(0, 19)).run();
    await tick(env, now);
    const alert = teamGot(TEAM[1], 'New website enquiry')!;
    assert.match(alert.body, /Name: Meera[\s\S]*Service: SEO[\s\S]*Rank my clinic[\s\S]*wa\.me\/919800000000/);
    assert.ok(!teamGot(TEAM[0], 'New website enquiry'), 'the SEO person first');
    assert.ok((await db.prepare(`SELECT wa_alerted_at FROM leads WHERE id = 'form-1'`).first<Row>())!.wa_alerted_at);
    now += 11 * MIN;
    await tick(env, now);
    assert.match(teamGot(TEAM[0], 'New website enquiry')!.body, /Passed on/);
    await tick(env, now + 2 * MIN);
    assert.equal(to(TEAM[1]).filter((m) => m.body.startsWith('New website enquiry')).length, 1, 'once');
  });

  await t.test('phase 4: the 10 a.m. summary on working days, once', async () => {
    await reset();
    await teamHi();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:0', 'button_reply')]);           // as soon as possible: hot
    fx.state.ai = (task) => (task === 'extract' ? question('Do you do hosting?') : 500);
    await toName(CLIENT2);
    await post([text(CLIENT2, 'Hosting?')]);
    fx.state.ai = () => 500;
    now = Date.parse('2026-10-15T04:30:00Z');                     // Thursday 10:00 IST
    await teamHi();
    await tick(env, now);
    const summary = teamGot(TEAM[0], 'Good morning')!;
    assert.match(summary.body, /New enquiries: 2 \(WhatsApp 2, website form 0\)/);
    assert.match(summary.body, /Open questions: 1\./);
    assert.match(summary.body, /\n• "Do you do hosting\?"$/, 'the lists come last (a template may cut them, never the counts)');
    assert.match(summary.body, new RegExp(`Hot: #${contact().code} Ravi \\(as soon as possible\\)`));
    await tick(env, now + 2 * MIN);
    assert.equal(to(TEAM[0]).filter((m) => m.body.startsWith('Good morning')).length, 1, 'once a day');
    now = Date.parse('2026-10-18T04:30:00Z');                     // Sunday 10:00 IST: closed
    await teamHi();
    await tick(env, now);
    assert.equal(to(TEAM[0]).filter((m) => m.body.startsWith('Good morning')).length, 1, 'not on Sundays');
  });

  await t.test('phase 4: the first reply is timed; "#CODE update" goes in their language, or as a template after 24 hours', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task, user) => (task === 'translate' ? { text: /design/.test(user) ? 'ആദ്യ ഡിസൈൻ തയ്യാറാണ്' : 'ശരി' } : 500);
    await toName(CLIENT, 'ml');
    const code = contact().code;
    await post([text(TEAM[0], `#${code} update: the first design is ready`)]);
    assert.equal(last(CLIENT).body, `${TEXT.ml.update}\nആദ്യ ഡിസൈൻ തയ്യാറാണ്`);
    assert.ok((await lead())?.first_reply_at, 'the first human reply');
    await db.prepare(`UPDATE leads SET first_reply_at = '2026-10-14 05:40:00' WHERE phone = ?`).bind(`+${CLIENT}`).run();
    await post([text(TEAM[0], `#${code} Okay`)]);
    assert.equal((await lead())?.first_reply_at, '2026-10-14 05:40:00', 'only the first one counts');
    now += 25 * 60 * MIN;
    await teamHi();
    await post([text(TEAM[0], `#${code} update: the first design is ready`)]);
    const sent = last(CLIENT);
    assert.equal(sent.template, 'project_update');
    assert.equal(sent.body, 'Ravi | ആദ്യ ഡിസൈൻ തയ്യാറാണ്');
    assert.match(last(TEAM[0]).body, /as the project_update template/);
    await post([text(TEAM[0], `#${code} Thanks`)]);
    assert.match(last(TEAM[0]).body, /window has closed/, 'other messages still wait for the client');
  });
  /* ---- phase 4 review fixes ---- */

  await t.test('phase 4 fixes: a question taken by the first member is not passed on; the pass-on skips who went off; nothing is kept', async () => {
    await reset();
    await teamHi();
    await seat(TEAM[0], ['website']);
    await seat(TEAM[1], ['seo']);
    fx.state.ai = (task) => (task === 'extract' ? question('Can you start tomorrow?', true) : 500);
    await toName();
    await post([text(CLIENT, 'Start tomorrow?')]);
    const code = contact().code;
    assert.ok(teamGot(TEAM[0], `#${code}`) && !teamGot(TEAM[1], `#${code}`));
    await post([text(TEAM[0], `#${code} take`)]);
    now += 11 * MIN;
    await tick(env, now);
    assert.ok(!teamGot(TEAM[1], `#${code}`), 'taken: not passed on, though the question is still open');
    assert.equal(sb.tables.alerts.length, 0, 'claimed rows are deleted');

    await toName(CLIENT2);
    await post([text(CLIENT2, 'Start tomorrow?')]);
    const code2 = contact(CLIENT2).code;
    await post([text(TEAM[1], 'off')]);
    now += 11 * MIN;
    await tick(env, now);
    assert.ok(!teamGot(TEAM[1], `#${code2}`), 'off since the alert: skipped');
  });

  await t.test('phase 4 fixes: form leads already handled are not alerted, and one nobody got is tried again', async () => {
    await reset();
    const at = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
    await db.prepare(`INSERT INTO leads (id, source, name, phone, service, message, status, created_at) VALUES ('form-2', 'form', 'Old', '+919800000001', 'SEO', 'x', 'contacted', ?)`).bind(at).run();
    await db.prepare(`INSERT INTO leads (id, source, name, phone, service, message, created_at) VALUES ('form-3', 'form', 'Meera', '+919800000002', 'SEO', 'Rank my clinic', ?)`).bind(at).run();
    env.TEAM_WHATSAPP = '';
    try {
      await tick(env, now);
      assert.equal((await db.prepare(`SELECT wa_alerted_at FROM leads WHERE id = 'form-3'`).first<Row>())!.wa_alerted_at, null, 'nobody reached: not marked');
    } finally { env.TEAM_WHATSAPP = TEAM.join(','); }
    await teamHi();
    await tick(env, now + 2 * MIN);
    assert.ok(teamGot(TEAM[0], 'Name: Meera'), 'the next run tries again');
    assert.ok(!teamGot(TEAM[0], 'Name: Old'), 'a contacted lead is not alerted');
  });

  await t.test('phase 4 fixes: "Update ..." as a reply answers the question; a long update after 24 h is refused; "free" works as a reply', async () => {
    await reset();
    await teamHi();
    fx.state.ai = (task) => (task === 'extract' ? question('Can I update the content myself?') : 500);
    await toName();
    await post([text(CLIENT, 'Can I update it myself?')]);
    const alert = teamGot(TEAM[0], 'question')!;
    await post([text(TEAM[0], 'Update it any time from the dashboard we give you.', { context: { id: alert.id } })]);
    assert.equal(last(CLIENT).body, 'Update it any time from the dashboard we give you.');
    assert.equal(sb.tables.questions.at(-1)!.status, 'answered');
    const code = contact().code;
    now += 25 * 60 * MIN;
    await teamHi();
    await post([text(TEAM[0], `#${code} update: ${'x'.repeat(850)}`)]);
    assert.match(last(TEAM[0]).body, /800 characters at most/);
    await post([text(TEAM[0], 'off')]);
    await post([text(TEAM[0], 'free', { context: { id: last(TEAM[0]).id } })]);
    assert.match(last(TEAM[0]).body, /^You are free/);
  });

  await t.test('phase 4 fixes: the morning summary counts only enquiries the team was told about as waiting', async () => {
    await reset();
    await teamHi();
    const old = new Date(now - 5 * 60 * MIN).toISOString().replace('T', ' ').slice(0, 19);
    await db.prepare(`INSERT INTO leads (id, source, name, created_at) VALUES ('wa-hi', 'whatsapp', 'Only said hi', ?)`).bind(old).run();
    await db.prepare(`INSERT INTO leads (id, source, name, created_at, wa_alerted_at) VALUES ('wa-told', 'whatsapp', 'Told', ?, ?)`).bind(old, old).run();
    now = Date.parse('2026-10-15T04:30:00Z');
    await teamHi();
    await tick(env, now);
    assert.match(teamGot(TEAM[0], 'Good morning')!.body, /Waiting over 2 hours for a first reply: 1 /);
  });
  /* ---- phase 5: calls and sales ---- */

  const calendarEnv = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret', GOOGLE_REFRESH_TOKEN: 'grefresh', CALENDAR_ID: 'legitforge@gmail.com' };
  const noCalendar = () => { for (const k of Object.keys(calendarEnv)) delete (env as Row)[k]; };
  const priceAsk = async (who = CLIENT) => {
    fx.state.ai = (task) => (task === 'extract' ? { ...question('How much for a website?'), price: true } : 500);
    await toName(who);
    await post([text(who, 'How much will it cost?')]);
    fx.state.ai = () => 500;
    assert.deepEqual(last(who).ids, ['call:y', 'call:n']);
  };
  const istAt = (s: string) => Date.parse(`${s.replace(' ', 'T')}:00+05:30`);

  await t.test('phase 5: a call the client’s way at a free time from the calendar, a Meet link, a reminder, and DELETE MY DATA cancels it', async () => {
    await reset();
    await teamHi();
    Object.assign(env, calendarEnv);
    try {
      fx.state.calendar.busy.push({ start: new Date(istAt('2026-10-14 13:00')).toISOString(), end: new Date(istAt('2026-10-14 13:30')).toISOString() });
      await priceAsk();
      await post([tap(CLIENT, 'call:y', 'button_reply')]);
      assert.deepEqual(last(CLIENT).ids, ['how:wa', 'how:ph', 'how:meet']);
      await post([tap(CLIENT, 'how:meet', 'button_reply')]);
      const list = last(CLIENT);
      assert.equal(list.type, 'list');
      assert.equal(list.ids.length, 9, 'eight times and "Another time"');
      const first = istAt('2026-10-14 13:30');
      assert.equal(list.ids[0], `slot:${first / MIN}`, 'the busy 13:00 is left out');
      await post([tap(CLIENT, list.ids[0])]);
      const ev = fx.state.calendar.events[0];
      assert.ok(ev.conferenceData, 'a Meet link was asked for');
      assert.match(ev.summary, /Ravi.*Google Meet/);
      assert.match(last(CLIENT).body, /^Done! Your call is booked for .*\(India time\)\.\nJoin on Google Meet: https:\/\/meet\.google\.com\//);
      const code = contact().code;
      assert.ok(teamGot(TEAM[0], `#${code} 📅 call booked`));
      now = first - 30 * MIN;
      await tick(env, now);
      assert.ok(last(CLIENT).body.startsWith('Reminder: our call is at'));
      assert.ok(teamGot(TEAM[0], `#${code} 📅 call in 30 minutes`));
      const n = to(CLIENT).length;
      await tick(env, now + 2 * MIN);
      assert.equal(to(CLIENT).length, n, 'one reminder');
      await post([text(CLIENT, 'delete my data')]);
      await post([tap(CLIENT, 'del:y', 'button_reply')]);
      assert.equal(fx.state.calendar.events.length, 0, 'off the calendar');
    } finally { noCalendar(); }
  });

  await t.test('phase 5: a time taken meanwhile is offered again; with no calendar the team arranges the call', async () => {
    await reset();
    await teamHi();
    Object.assign(env, calendarEnv);
    try {
      await priceAsk();
      await post([tap(CLIENT, 'call:y', 'button_reply')]);
      await post([tap(CLIENT, 'how:wa', 'button_reply')]);
      const pick = last(CLIENT).ids[0], start = Number(pick.split(':')[1]) * MIN;
      fx.state.calendar.busy.push({ start: new Date(start).toISOString(), end: new Date(start + 30 * MIN).toISOString() });   // someone else took it
      await post([tap(CLIENT, pick)]);
      assert.equal(fx.state.calendar.events.length, 0);
      assert.ok(last(CLIENT).body.startsWith(TEXT.en.slotTaken));
      assert.equal(last(CLIENT).type, 'list');
      await post([tap(CLIENT, 'slot:other')]);
      assert.equal(last(CLIENT).body, TEXT.en.callSoon);
      assert.ok(teamGot(TEAM[0], 'wants a call to discuss a quote'), 'told when they said yes');
      assert.ok(teamGot(TEAM[0], 'wants a WhatsApp call: please arrange the time'), 'and how, when no time was booked');
    } finally { noCalendar(); }
    await priceAsk(CLIENT2);
    await post([tap(CLIENT2, 'call:y', 'button_reply')]);
    await post([tap(CLIENT2, 'how:ph', 'button_reply')]);
    assert.equal(last(CLIENT2).body, TEXT.en.callSoon, 'no calendar: the team calls');
    assert.ok(teamGot(TEAM[0], `#${contact(CLIENT2).code} 📞 Ravi wants a phone call`));
  });

  await t.test('phase 5: "#CODE quote <link>" marks the lead Quoted and passes their reply on', async () => {
    await reset();
    await teamHi();
    await toName();
    const code = contact().code;
    await post([text(TEAM[0], `#${code} quote http://quotes.example/1`)]);
    assert.match(last(TEAM[0]).body, /Send just the quote's https link/);
    await post([text(TEAM[0], `#${code} quote ready by Friday`)]);
    assert.equal(last(CLIENT).body, 'quote ready by Friday', 'the word alone is an ordinary message');
    await post([text(TEAM[0], `#${code} quote https://quotes.example/q/1`)]);
    assert.equal(last(CLIENT).body, 'Here is your quote from Legit Forge: https://quotes.example/q/1\nReply here if you have any questions.');
    assert.equal((await lead())?.status, 'quoted');
    await post([text(CLIENT, 'Looks good, can we start Monday?')]);
    assert.ok(teamGot(TEAM[0], `#${code} replied after the quote: "Looks good, can we start Monday?"`));
    const n = to(TEAM[1]).filter((m) => m.body.includes('replied after the quote')).length;
    await post([text(CLIENT, 'Also need a logo')]);
    assert.equal(to(TEAM[1]).filter((m) => m.body.includes('replied after the quote')).length, n, 'only the first reply');
  });

  await t.test('phase 5: "#CODE pay 5,000" asks the member first, then sends one link (Razorpay, or the UPI ID)', async () => {
    await reset();
    await teamHi();
    await toName();
    const code = contact().code;
    await post([text(TEAM[0], `#${code} pay 5,000`)]);
    assert.match(last(TEAM[0]).body, /No payment method is set up/);
    Object.assign(env, { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'rzp-secret' });
    try {
      const before = to(CLIENT).length;
      await post([text(TEAM[0], `#${code} pay 5,000`)]);
      assert.deepEqual(last(TEAM[0]).ids, [`pay:y:${code}:5000`, 'pay:n']);
      assert.equal(to(CLIENT).length, before, 'nothing to the client before the member says yes');
      await post([tap(TEAM[0], `pay:y:${code}:5000`, 'button_reply', 'Yes, send')]);
      assert.equal(last(CLIENT).body, 'Here is the link to pay the advance of ₹5,000: https://rzp.io/i/lf1\nThank you!');
      assert.equal(fx.state.razorpay[0].amount, 500000, 'in paise');
      await post([tap(TEAM[1], `pay:y:${code}:5000`, 'button_reply', 'Yes, send')]);
      assert.match(last(TEAM[1]).body, /less than a minute ago, so this one \(₹5,000\) was not sent/);
      assert.equal(fx.state.razorpay.length, 1, 'one link');
    } finally { delete env.RAZORPAY_KEY_ID; delete env.RAZORPAY_KEY_SECRET; }
    env.UPI_ID = 'legitforge@okicici';
    try {
      now += 2 * MIN;
      await post([text(TEAM[0], `#${code} pay ₹1500`)]);
      await post([tap(TEAM[0], `pay:y:${code}:1500`, 'button_reply', 'Yes, send')]);
      assert.equal(last(CLIENT).body, `Please pay the advance of ₹1,500 by UPI to legitforge@okicici (Legit Forge), with #${code} in the note. Thank you!`);
      await post([tap(TEAM[0], 'pay:n', 'button_reply', 'Cancel')]);
      assert.match(last(TEAM[0]).body, /^Cancelled/);
    } finally { delete env.UPI_ID; }
  });

  await t.test('phase 5: a Won lead gets one review request, then one referral ask', async () => {
    await reset();
    await db.prepare('INSERT INTO company (id, data) VALUES (1, ?)').bind(JSON.stringify({ whatsapp: '919999999999' })).run();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    await db.prepare(`UPDATE leads SET status = 'won' WHERE phone = ?`).bind(`+${CLIENT}`).run();
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.body.includes('Google review')), 'off until the review link is set');
    env.GOOGLE_REVIEW_URL = 'https://g.page/r/legitforge/review';
    try {
      await tick(env, now);
      assert.equal(last(CLIENT).body, fill(TEXT.en.review, { link: 'https://g.page/r/legitforge/review' }));
      const n = to(CLIENT).length;
      await tick(env, now + 2 * MIN);
      assert.equal(to(CLIENT).length, n, 'once');
      await post([text(CLIENT, 'Done, five stars!')]);
      assert.equal(last(CLIENT).body, fill(TEXT.en.referral, { link: 'https://wa.me/919999999999' }));
      await post([text(CLIENT, 'Sure, will do')]);
      assert.equal(to(CLIENT).filter((m) => m.body.startsWith('One more thing')).length, 1, 'one referral ask');
    } finally { delete env.GOOGLE_REVIEW_URL; }
  });

  await t.test('phase 5: one revival template after 30 quiet days, only when switched on and never for Won or Lost leads', async () => {
    await reset();
    await toName();
    await post([text(CLIENT, 'Ravi')]);
    await toName(CLIENT2);
    await post([text(CLIENT2, 'Asha')]);
    await db.prepare(`UPDATE leads SET status = 'lost' WHERE phone = ?`).bind(`+${CLIENT2}`).run();
    now += 31 * 24 * 60 * MIN;                                    // Saturday 11:00 IST: open
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.type === 'template'), 'off by default (each one costs money)');
    env.REVIVE_TEMPLATE = 'lf_follow_up';
    try {
      await tick(env, now);
      assert.equal(last(CLIENT).template, 'lf_follow_up');
      assert.equal(last(CLIENT).body, 'Ravi');
      await tick(env, now + 2 * MIN);
      assert.equal(to(CLIENT).filter((m) => m.template === 'lf_follow_up').length, 1, 'once');
      assert.ok(!to(CLIENT2).some((m) => m.template === 'lf_follow_up'), 'not a lost lead');
    } finally { delete env.REVIVE_TEMPLATE; }
  });
  /* ---- phase 5 review fixes ---- */

  await t.test('phase 5 fixes: a double tap confirms again, a new time replaces the old, "Another time" frees it, two clients never share one', async () => {
    await reset();
    await teamHi();
    Object.assign(env, calendarEnv);
    try {
      await priceAsk();
      await post([tap(CLIENT, 'call:y', 'button_reply')]);
      await post([tap(CLIENT, 'how:wa', 'button_reply')]);
      const ids = last(CLIENT).ids;
      await post([tap(CLIENT, ids[0])]);
      await post([tap(CLIENT, ids[0])]);
      assert.equal(fx.state.calendar.events.length, 1, 'one event');
      assert.ok(last(CLIENT).body.startsWith('Done! Your call is booked'), 'the double tap is confirmed, not "taken"');
      await post([tap(CLIENT, ids[1])]);
      assert.equal(fx.state.calendar.events.length, 1, 'the new time replaced the old one');
      assert.equal(sb.tables.calls.length, 1);
      assert.match(teamGot(TEAM[0], 'call booked')!.body, /Instead of .*taken off the calendar/);
      await post([tap(CLIENT, 'slot:other')]);
      assert.equal(fx.state.calendar.events.length, 0, '"Another time" frees it');
      assert.match(teamGot(TEAM[0], 'please arrange the time')!.body, /instead of/);

      await priceAsk(CLIENT2);
      await post([tap(CLIENT2, 'call:y', 'button_reply')]);
      await post([tap(CLIENT2, 'how:ph', 'button_reply')]);
      const slot = last(CLIENT2).ids[0];
      sb.tables.calls.push({ id: 999, wa_id: CLIENT, start_at: new Date(Number(slot.split(':')[1]) * MIN).toISOString(), how: 'wa', event_id: null, meet: null, reminded: false });
      await post([tap(CLIENT2, slot)]);
      assert.ok(last(CLIENT2).body.startsWith(TEXT.en.slotTaken), 'claimed by another client a moment before');
    } finally { noCalendar(); }
  });

  await t.test('phase 5 fixes: a call moved or cancelled in Google Calendar is reminded at its new time, or not at all', async () => {
    await reset();
    await teamHi();
    Object.assign(env, calendarEnv);
    try {
      await priceAsk();
      await post([tap(CLIENT, 'call:y', 'button_reply')]);
      await post([tap(CLIENT, 'how:wa', 'button_reply')]);
      const slot = last(CLIENT).ids[0], start = Number(slot.split(':')[1]) * MIN;
      await post([tap(CLIENT, slot)]);
      const ev = fx.state.calendar.events[0];
      ev.start.dateTime = new Date(start + 2 * 60 * MIN).toISOString();   // moved two hours later by the team
      now = start - 30 * MIN;
      await tick(env, now);
      assert.ok(!to(CLIENT).some((m) => m.body.startsWith('Reminder')), 'not at the old time');
      now = start + 90 * MIN;
      await tick(env, now);
      assert.ok(last(CLIENT).body.startsWith('Reminder: our call is at'), 'at the new time');
      fx.state.calendar.events.length = 0;                                   // cancelled
      sb.tables.calls[0].reminded = false;
      await tick(env, now + 2 * MIN);
      assert.equal(to(CLIENT).filter((m) => m.body.startsWith('Reminder')).length, 1, 'a cancelled call: no reminder');
    } finally { noCalendar(); }
  });

  await t.test('phase 5 fixes: "pay" only with an amount; nothing for opted-out clients; a reply to the review request is no "return"', async () => {
    await reset();
    await teamHi();
    await toName();
    const code = contact().code;
    env.UPI_ID = 'legitforge@okicici';
    try {
      await post([text(TEAM[0], `#${code} pay the balance after delivery`)]);
      assert.equal(last(CLIENT).body, 'pay the balance after delivery', 'an ordinary message');
      await post([text(TEAM[0], `#${code} pay Rs. 1.14/-`)]);
      assert.deepEqual(last(TEAM[0]).ids, [`pay:y:${code}:1.14`, 'pay:n']);
      contact().mode = 'stopped';
      await post([tap(TEAM[0], `pay:y:${code}:1.14`, 'button_reply', 'Yes, send')]);
      assert.match(last(TEAM[0]).body, /opted out, so no payment link was made/);
      assert.equal(contact().pay_at ?? null, null, 'nothing claimed');
    } finally { delete env.UPI_ID; }

    await reset();
    await db.prepare('INSERT INTO company (id, data) VALUES (1, ?)').bind(JSON.stringify({ whatsapp: '919999999999' })).run();
    await toName();
    await toTimeline();
    await post([tap(CLIENT, 'tl:1', 'button_reply')]);
    now += 40 * 24 * 60 * MIN;                                    // a Monday, 40 days on: the deal closed by phone
    await db.prepare(`UPDATE leads SET status = 'won' WHERE phone = ?`).bind(`+${CLIENT}`).run();
    env.GOOGLE_REVIEW_URL = 'https://g.page/r/legitforge/review';
    try {
      contact().last_in_at = new Date(now - 20 * 24 * 60 * MIN).toISOString();   // within the 60-day limit
      await tick(env, now);
      assert.ok(to(CLIENT).some((m) => m.template === 'review_request'), 'outside the window: the template');
      now += 25 * 24 * 60 * MIN;                                  // they reply 25 days later, 45 days after their last message
      contact().last_in_at = new Date(now - 45 * 24 * 60 * MIN).toISOString();
      await post([text(CLIENT, 'Done, five stars!')]);
      assert.ok(!to(CLIENT).some((m) => m.ids.includes('ret:same')), 'not "welcome back"');
      assert.equal(last(CLIENT).body, fill(TEXT.en.referral, { link: 'https://wa.me/919999999999' }));
    } finally { delete env.GOOGLE_REVIEW_URL; }
  });
  /* ---- phase 6: admin and insights ---- */

  await t.test('phase 6: the bot’s own messages are kept for the chat viewer (not after DELETE MY DATA), and Admin reads them through the entrypoint', async () => {
    await reset();
    await teamHi();
    await post([text(CLIENT, "Hi Legit Forge, I'd like to talk about SEO.")]);
    now += 5000;                                                    // they tap a few seconds later
    await post([tap(CLIENT, 'lang:en')]);
    const out = sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'out');
    assert.ok(out.some((m) => m.body === TEXT.en.name), 'the bot’s question, stored');
    assert.ok(!sb.tables.messages.some((m) => m.dir === 'out' && m.team == null && TEAM.includes(m.wa_id)), 'never a team member as a client');
    assert.equal((await lead())?.page, 'Site: SEO page', 'which page brought them');
    const admin = new BotAdmin({} as never, env);
    const chat = (await admin.chat(contact().lead_id))!;
    assert.equal(chat.code, contact().code);
    assert.deepEqual(chat.lines.map((l) => l.who).slice(0, 2), ['client', 'bot']);
    assert.equal(await admin.chat(crypto.randomUUID()), null);
    await post([text(CLIENT, 'delete my data')]);
    await post([tap(CLIENT, 'del:y', 'button_reply')]);
    assert.equal(sb.tables.messages.filter((m) => m.wa_id === CLIENT).length, 0, 'not even the "deleted" confirmation');
  });

  await t.test('phase 6: Admin manages what the bot knows and sees the top questions', async () => {
    await reset();
    const admin = new BotAdmin({} as never, env);
    const made = await admin.saveAnswer({ question_en: 'Do you build Android apps?', answer_en: 'Yes, Android and iPhone apps.', by: 'owner@legitforge.example' });
    assert.ok('ok' in made);
    const k = sb.tables.knowledge.find((x) => x.id === (made as { id: number }).id)!;
    assert.equal(k.status, 'approved');
    assert.ok(k.embedding, 'embedded so the bot can find it');
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Android apps?') : 500);
    await toName();
    await post([text(CLIENT, 'Android apps?')]);
    assert.ok(last(CLIENT).body.startsWith('Yes, Android and iPhone apps.'), 'used at once');
    assert.deepEqual(await admin.setAnswer(k.id, false, 'owner@legitforge.example'), { ok: true });
    assert.equal(k.status, 'rejected');
    assert.deepEqual((await admin.answers('rejected')).map((a) => a.id), [k.id]);
    const ins = await admin.insights(30);
    assert.equal(ins.questions, 1);
    assert.equal(ins.byBot, 1);
    assert.equal(ins.top[0].question, 'Do you build Android apps?');
    assert.deepEqual(await admin.saveAnswer({ question_en: '?', answer_en: '', by: 'x' }), { error: 'Write the question and the answer.' });
  });

  await t.test('phase 6: paused, the bot sends the away message once and passes everything to the team; saved replies; the after-hours message', async () => {
    await reset();
    await teamHi();
    await toName(CLIENT, 'ml');                                     // (before the pause: they chose Malayalam)
    await db.prepare(`INSERT INTO bot_settings (key, value) VALUES ('paused', '1'), ('away', 'We are on leave until Monday. We will reply then.'),
      ('after_hours', 'We are closed now and will reply in the morning.')`).run();
    fx.state.ai = (task, user) => (task === 'translate' ? { text: /leave/.test(user) ? 'ഞങ്ങൾ തിങ്കളാഴ്ച വരെ അവധിയിലാണ്.' : 'രാവിലെ മറുപടി നൽകും.' } : 500);
    await post([text(CLIENT, 'Ravi')]);
    const code = contact().code;
    assert.ok(to(CLIENT).some((m) => m.body === 'ഞങ്ങൾ തിങ്കളാഴ്ച വരെ അവധിയിലാണ്.'), 'the away message, in their language');
    assert.ok(teamGot(TEAM[0], `#${code} (bot paused)`), 'the team gets the message');
    const n = to(CLIENT).length;
    await post([text(CLIENT, 'Hello?')]);
    assert.equal(to(CLIENT).length, n, 'once every 12 hours');
    await db.prepare(`UPDATE bot_settings SET value = '' WHERE key = 'paused'`).run();

    await db.prepare(`INSERT INTO bot_replies (key, text) VALUES ('portfolio', 'Our recent work: https://legitforge.pages.dev/work')`).run();
    await toName(CLIENT2);
    const code2 = contact(CLIENT2).code;
    await post([text(TEAM[0], `#${code2} /portfolio`)]);
    assert.equal(last(CLIENT2).body, 'Our recent work: https://legitforge.pages.dev/work');
    await post([text(TEAM[0], `#${code2} /nope`)]);
    assert.equal(last(TEAM[0]).body, 'Saved replies: /portfolio');

    fx.state.ai = (task) => (task === 'extract' ? question('Do you work on Sundays?') : task === 'translate' ? { text: 'രാവിലെ മറുപടി നൽകും.' } : 500);
    now = SUNDAY;
    await toName(CLIENT3);
    await post([text(CLIENT3, 'Sundays?')]);
    now += 11 * MIN;
    await tick(env, now);
    assert.equal(last(CLIENT3).body, 'We are closed now and will reply in the morning.', 'the admin’s words (English client)');
  });

  await t.test('phase 6: a hot lead (soon, clear, keen) is scored on the lead and reaches everyone at once', async () => {
    await reset();
    await teamHi();
    await seat(TEAM[0], ['website']);
    await seat(TEAM[1], ['seo']);
    await toName();
    for (const a of ['Ravi', 'Ravi Bakery', 'A website where people can order cakes and pay online']) await post([text(CLIENT, a)]);
    await post([text(CLIENT, 'Five pages, I have a domain')]);
    await post([tap(CLIENT, 'skip:refs', 'button_reply')]);
    await post([tap(CLIENT, 'tl:0', 'button_reply')]);
    assert.equal((await lead())?.score, 'hot');
    const code = contact().code;
    for (const m of TEAM) assert.match(teamGot(m, `#${code}`)!.body, /🔥 new lead/, 'not in turns: everyone');
    await toName(CLIENT2);
    await post([text(CLIENT2, 'Asha')]);
    assert.equal((await lead(CLIENT2))?.score, 'cold');
  });

  await t.test('phase 6: the monthly report on the 1st', async () => {
    await reset();
    for (const [id, source, service, status] of [['m1', 'whatsapp', 'Website', 'won'], ['m2', 'form', 'SEO', 'new'], ['m3', 'whatsapp', 'Website', 'lost']]) {
      await db.prepare(`INSERT INTO leads (id, source, service, status, created_at) VALUES (?, ?, ?, ?, '2026-10-10 10:00:00')`).bind(id, source, service, status).run();
    }
    now = Date.parse('2026-11-01T04:30:00Z');                     // 1 November, 10:00 IST
    await teamHi();
    await tick(env, now);
    const report = teamGot(TEAM[0], 'Monthly report: October 2026')!;
    assert.match(report.body, /Enquiries: 3 \(whatsapp 2, form 1\)\. Won: 1, lost: 1\./);
    assert.match(report.body, /By service: Website 2, SEO 1\./);
    await tick(env, now + 2 * MIN);
    assert.equal(to(TEAM[0]).filter((m) => m.body.startsWith('Monthly report')).length, 1, 'once');
  });
  /* ---- phase 6 review fixes ---- */

  await t.test('phase 6 fixes: Admin edits re-embed and drop old translations; "Use it" embeds; an earlier enquiry’s chat is found', async () => {
    await reset();
    const admin = new BotAdmin({} as never, env);
    sb.tables.knowledge.push({ id: 700, question_en: 'Do you do logos?', answer_en: 'Yes.', status: 'approved', source: 'team', embedding: JSON.stringify(fakeEmbedding('x')),
      translations: { ml: 'old' }, translations_ok: true });
    assert.ok('ok' in (await admin.saveAnswer({ id: 700, question_en: 'Do you design logos?', answer_en: 'Yes, simple logos.', by: 'owner' })));
    const k = sb.tables.knowledge.find((x) => x.id === 700)!;
    assert.deepEqual(k.translations, {});
    assert.equal(k.translations_ok, false);
    assert.equal(k.embedding, JSON.stringify(fakeEmbedding('Do you design logos?')), 'embedded again for the new question');
    sb.tables.knowledge.push({ id: 701, question_en: 'Do you host?', answer_en: 'Yes.', status: 'pending', source: 'team', embedding: null });
    assert.deepEqual(await admin.setAnswer(701, true, 'owner'), { ok: true });
    assert.ok(sb.tables.knowledge.find((x) => x.id === 701)!.embedding, 'switched on with an embedding');

    await toName();
    for (const a of ['Ravi', 'Ravi Bakery', 'A website']) await post([text(CLIENT, a)]);
    const first = contact().lead_id;
    now += 31 * 24 * 60 * MIN;
    await post([text(CLIENT, 'Hi')]);
    await post([tap(CLIENT, 'ret:new', 'button_reply')]);
    assert.notEqual(contact().lead_id, first);
    assert.ok(await admin.chat(first), 'the earlier enquiry still opens its chat');
  });

  await t.test('phase 6 fixes: saved replies by swipe-reply answer the open question; "/list" lists; a hot lead keeps the bot going', async () => {
    await reset();
    await teamHi();
    await db.prepare(`INSERT INTO bot_replies (key, text) VALUES ('portfolio', 'Our recent work: https://legitforge.pages.dev/work')`).run();
    fx.state.ai = (task) => (task === 'extract' ? question('Can I see your work?') : 500);
    await toName();
    await post([text(CLIENT, 'Your work?')]);
    const alert = teamGot(TEAM[0], 'question')!;
    await post([text(TEAM[0], '/portfolio', { context: { id: alert.id } })]);
    assert.equal(last(CLIENT).body, 'Our recent work: https://legitforge.pages.dev/work');
    assert.equal(sb.tables.questions.at(-1)!.status, 'answered', 'no "the team will reply" later');
    await post([text(TEAM[0], `#${contact().code} /list`)]);
    assert.equal(last(TEAM[0]).body, 'Saved replies: /portfolio');

    fx.state.ai = () => 500;
    await toName(CLIENT2);
    for (const a of ['Asha', 'Asha Clinic', 'A website where patients can book appointments online']) await post([text(CLIENT2, a)]);
    await post([text(CLIENT2, 'Five pages')]);
    await post([tap(CLIENT2, 'skip:refs', 'button_reply')]);
    await post([text(CLIENT2, 'Urgent, this week please')]);
    const hot = teamGot(TEAM[0], `#${contact(CLIENT2).code} 🔥`)!;
    assert.ok(hot, 'a typed "this week" is hot too');
    assert.doesNotMatch(hot.body, /The bot has stopped/, 'the bot carries on');
    assert.equal(contact(CLIENT2).mode, 'bot');
  });

  await t.test('phase 6 fixes: paused, a returning client reaches the team (no welcome-back), and no reminders go out', async () => {
    await reset();
    await teamHi();
    await toName();
    await post([text(CLIENT, 'Ravi')]);
    await db.prepare(`INSERT INTO bot_settings (key, value) VALUES ('paused', '1'), ('away', 'We are on leave until Monday.')`).run();
    now += 3 * 60 * MIN + MIN;
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.body === TEXT.en.nudge), 'no "still there?" while paused');
    now += 31 * 24 * 60 * MIN;
    await teamHi();
    await post([text(CLIENT, 'Need a new site by Friday')]);
    assert.ok(!to(CLIENT).some((m) => m.ids.includes('ret:same')), 'no welcome-back question');
    assert.ok(teamGot(TEAM[0], 'Need a new site by Friday'), 'the team has their words');
    assert.equal(last(CLIENT).body, 'We are on leave until Monday.');
  });

  await t.test('phase 6 fixes: which page brought them, and the lead score from typed timelines', () => {
    assert.equal(pageFrom("Hi Legit Forge, I'd like to talk about SEO."), 'Site: SEO page');
    assert.equal(pageFrom("Hi, I'd like to talk about my shop"), 'WhatsApp (typed)', 'not a page that does not exist');
    assert.equal(pageFrom('Hello Legit Forge!', 'Hello Legit Forge!'), 'Site: WhatsApp button', 'the greeting set in Admin → Company');
    assert.equal(leadScore({ service: 'website', fields: { timeline: 'urgent, this week', business: 'B', need: 'x'.repeat(41), details: '5 pages' } }), 'hot');
    assert.equal(leadScore({ service: 'website', fields: { timeline: 'Just exploring' } }), 'cold');
  });
  await t.test('phase 6 critic: answers with money are refused; a question-only fix keeps the translations; the purge keeps switched-off answers', async () => {
    await reset();
    const admin = new BotAdmin({} as never, env);
    assert.ok('error' in (await admin.saveAnswer({ question_en: 'Do NGOs get a discount?', answer_en: 'Yes, 10% off.', by: 'owner' })), 'never an answer the bot would not send');
    sb.tables.knowledge.push({ id: 710, question_en: 'Do you do logos?', answer_en: 'Yes.', status: 'approved', source: 'site', embedding: JSON.stringify(fakeEmbedding('x')),
      translations: { ml: 'ഉണ്ട്.' }, translations_ok: true });
    assert.ok('ok' in (await admin.saveAnswer({ id: 710, question_en: 'Do you design logos?', answer_en: 'Yes.', by: 'owner' })));
    const k = sb.tables.knowledge.find((x) => x.id === 710)!;
    assert.deepEqual(k.translations, { ml: 'ഉണ്ട്.' }, 'the same answer keeps its approved translations');
    assert.equal(k.translations_ok, true);
    sb.tables.knowledge.push({ id: 711, question_en: 'Price list?', answer_en: 'From 15,000.', status: 'rejected', source: 'team', embedding: null });
    assert.ok('error' in (await admin.setAnswer(711, true, 'owner')), 'not switched on either');

    now = Date.parse('2027-03-01T21:30:00Z');
    const old = new Date(now - 200 * 24 * 60 * MIN).toISOString(), lately = new Date(now - 5 * 24 * 60 * MIN).toISOString();
    sb.tables.knowledge.push(
      { id: 720, question_en: 'Site FAQ', answer_en: 'A', status: 'rejected', source: 'site', created_at: old, decided_at: old },
      { id: 721, question_en: 'Switched off lately', answer_en: 'B', status: 'rejected', source: 'team', created_at: old, decided_at: lately },
      { id: 722, question_en: 'Switched off long ago', answer_en: 'C', status: 'rejected', source: 'team', created_at: old, decided_at: old },
      { id: 723, question_en: 'Never approved', answer_en: 'D', status: 'pending', source: 'team', created_at: old },
    );
    await tick(env, now);
    const ids = sb.tables.knowledge.map((x) => x.id);
    assert.ok(ids.includes(720) && ids.includes(721), 'the site’s answers, and answers switched off in the last 90 days');
    assert.ok(!ids.includes(722) && !ids.includes(723));
  });

  await t.test('phase 6 critic: paused, no "team will reply in 2 hours", one forward for a reply to a quote; the chat viewer shows one alert and the team’s words', async () => {
    await reset();
    await teamHi();
    const admin = new BotAdmin({} as never, env);
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Shopify stores?') : task === 'answer' ? { answer: '', answer_en: '' } : 500);
    await toName();
    const code = contact().code;
    await post([text(CLIENT, 'Shopify?')]);
    const alert = teamGot(TEAM[0], 'question')!;
    await post([text(TEAM[1], `#${code} quote https://quotes.example/q/1`)]);
    await db.prepare(`INSERT INTO bot_settings (key, value) VALUES ('paused', '1'), ('away', 'We are on leave until Monday.')`).run();
    now += 11 * MIN;
    await tick(env, now);
    assert.ok(!to(CLIENT).some((m) => m.body === TEXT.en.teamSoon), 'they had the away message instead');
    fx.state.ai = () => 500;
    await post([text(CLIENT, 'Looks good')]);
    assert.equal(to(TEAM[0]).filter((m) => m.body.includes('Looks good')).length, 1, 'one forward, not two');

    await db.prepare(`DELETE FROM bot_settings`).run();
    await post([text(TEAM[0], 'We can start Monday.', { context: { id: alert.id } })]);
    const lines = (await admin.chat(contact().lead_id))!.lines;
    assert.equal(lines.filter((l) => l.who === 'alert' && l.body === alert.body).length, 1, 'one alert to two members is one line');
    const said = lines.filter((l) => l.body === 'We can start Monday.');
    assert.deepEqual(said.map((l) => l.who), ['team', 'team'], 'the team’s message and its copy to the client, never the bot’s');
  });
  /* ---- phase 7: more channels ---- */

  // the website's /api/chat forwards to BotAdmin.fetch over the BOT binding (no public /chat)
  const viaSite = async (req: Request) => {
    const waits: Promise<unknown>[] = [];
    const res = await new BotAdmin({ waitUntil: (p: Promise<unknown>) => { waits.push(p); } } as never, env).fetch(req);
    await Promise.all(waits);
    return res;
  };
  const web = (session: string, message: Row) => {
    now += 1000;                                                    // a second between messages, as in a real chat
    return viaSite(new Request('https://bot/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session, ...message }) }));
  };
  const webRead = async (session: string, after = '') =>
    (await (await viaSite(new Request(`https://bot/chat?session=${session}&after=${encodeURIComponent(after)}`))).json()) as { messages: Row[] };

  await t.test('phase 7: the website chat bubble talks to the same bot (menu, taps, the brief, the team)', async () => {
    await reset();
    await teamHi();
    const s = crypto.randomUUID();
    assert.equal((await run(new Request('https://bot.test/chat', { method: 'POST', body: '{}' }))).status, 404, 'the bot has no public /chat');
    const res = await web(s, { text: 'Hi' });
    assert.equal(res.status, 202);
    let { messages } = await webRead(s);
    assert.equal(messages.at(-1)!.body, TEXT.en.welcome);
    assert.ok((messages.at(-1)!.options as Row[]).some((o) => o.id === 'svc:website'), 'the menu as options');
    await web(s, { reply: { id: 'svc:website', title: 'Website' } });
    await web(s, { reply: { id: 'lang:en', title: 'English' } });
    ({ messages } = await webRead(s, messages.at(-1)!.at));
    assert.equal(messages.at(-1)!.body, TEXT.en.name);
    for (const a of ['Ravi', 'Ravi Bakery', 'A website']) await web(s, { text: a });
    await web(s, { reply: { id: 'skip:details', title: 'Skip' } });
    await web(s, { reply: { id: 'skip:refs', title: 'Skip' } });
    await web(s, { reply: { id: 'tl:1', title: 'Within a month' } });
    ({ messages } = await webRead(s));
    assert.equal(messages.at(-1)!.body, TEXT.en.contact, 'the website chat asks how to reach them');
    await web(s, { text: 'call me' });
    ({ messages } = await webRead(s));
    assert.equal(messages.at(-1)!.body, `${TEXT.en.contactBad}

${TEXT.en.contact}`, 'asked once more, with Skip');
    now += MIN;                                                    // (10 messages a minute per chat)
    await web(s, { text: 'My number is 98470 12345, mail ravi@bakery.in' });
    const code = contact(`web:${s}`).code;
    assert.equal(contact(`web:${s}`).phone, '919847012345', 'an Indian number gets 91');
    const alert = teamGot(TEAM[0], `#${code} new lead`)!.body;
    assert.match(alert, /Website chat · WhatsApp: wa\.me\/919847012345/);
    assert.match(alert, /Email: ravi@bakery\.in/);
    const row = await db.prepare('SELECT page, whatsapp_consent, source FROM leads WHERE id = ?').bind(contact(`web:${s}`).lead_id).first<Row>();
    assert.deepEqual(row, { page: 'Website chat', whatsapp_consent: 0, source: 'whatsapp' }, 'the channel, and no WhatsApp consent');
    now += 1000;
    await post([text(TEAM[0], `#${code} Hi Ravi, we can start next week.`)]);
    ({ messages } = await webRead(s));
    assert.equal(messages.at(-1)!.body, 'Hi Ravi, we can start next week.', 'the team reply reaches the bubble');
    assert.equal(fx.sent.filter((m) => m.to === `web:${s}`).length, 0, 'nothing went to WhatsApp');
  });

  await t.test('phase 7: the bubble is limited (bad sessions, floods, too many new chats, big bodies)', async () => {
    await reset();
    assert.equal((await web('not-a-uuid', { text: 'Hi' })).status, 400);
    assert.equal((await web(crypto.randomUUID(), { reply: { id: 'media:image:1', title: 'x' } })).status, 400, 'no forged file ids');
    const s = crypto.randomUUID();
    for (let i = 0; i < 10; i++) assert.equal((await web(s, { text: `message ${i}` })).status, 202);
    assert.equal((await web(s, { text: 'one more' })).status, 429);
    for (let i = 0; i < 19; i++) assert.equal((await web(crypto.randomUUID(), { text: 'Hi' })).status, 202);    // 20 new chats with the one above
    assert.equal((await web(crypto.randomUUID(), { text: 'Hi' })).status, 429, 'a cap on new chats an hour from one address');
    assert.equal((await web(s, { text: 'still me' })).status, 429, 'still 10 a minute for a chat it knows');
    now += 2 * MIN;
    assert.equal((await web(s, { text: 'a minute later' })).status, 202, 'a known chat is not a new one');
    const big = await viaSite(new Request('https://bot/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: s, text: 'x'.repeat(5000) }) }));
    assert.equal(big.status, 413);
  });

  await t.test('phase 7: Messenger and Instagram messages get the same bot, with quick replies', async () => {
    await reset();
    Object.assign(env, { FB_PAGE_TOKEN: 'page-token', FB_PAGE_ID: 'PAGE1', IG_ACCOUNT_ID: 'IG1' });
    try {
      const meta = (object: string, recipient: string, sender: string, message: Row) => {
        const body = JSON.stringify({ object, entry: [{ id: recipient, messaging: [{ sender: { id: sender }, recipient: { id: recipient }, timestamp: now, message }] }] });
        return hex(body).then((sig) => run(new Request('https://bot.test/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${sig}` }, body })));
      };
      await meta('page', 'PAGE1', 'PSID9', { mid: 'm.1', text: 'Hi' });
      const first = fx.sent.filter((m) => m.to === 'meta:PSID9').at(-1)!;
      assert.ok(first.body.startsWith(TEXT.en.welcome));
      assert.match(first.body, /\/privacy$/, 'the privacy link the WhatsApp list has as its footer');
      assert.ok(first.ids.includes('svc:website'), 'the menu as quick replies');
      await meta('page', 'PAGE1', 'PSID9', { mid: 'm.2', text: 'Website', quick_reply: { payload: 'svc:website' } });
      assert.equal(contact('fb:PSID9').service, 'website');
      const before = sb.tables.messages.filter((m) => m.wa_id === 'fb:PSID9').length;
      await meta('page', 'PAGE1', 'PSID9', { mid: 'm.3', text: 'echo', is_echo: true });            // caught by is_echo alone
      const echo = JSON.stringify({ object: 'page', entry: [{ id: 'PAGE1', messaging: [{ sender: { id: 'PAGE1' }, recipient: { id: 'PSID9' }, timestamp: now, message: { mid: 'm.3b', text: 'Our reply', is_echo: true } }] }] });
      await run(new Request('https://bot.test/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${await hex(echo)}` }, body: echo }));
      await meta('page', 'PAGE1', 'PSID9', { mid: 'm.3c', attachments: [{ type: 'image', payload: {} }], sticker_id: 369239263222822 });   // the like button
      await meta('page', 'PAGE1', 'PSID9', { mid: 'm.3d', is_deleted: true });
      assert.equal(sb.tables.messages.filter((m) => m.wa_id === 'fb:PSID9').length, before, 'echoes, likes and unsends are not client messages');
      await meta('page', 'OTHER', 'PSID8', { mid: 'm.4', text: 'Hi' });
      assert.ok(!sb.tables.contacts.some((c) => c.wa_id === 'fb:PSID8'), 'only our own Page');
      await meta('instagram', 'IG1', 'IGSID7', { mid: 'm.5', text: 'Hello' });
      assert.ok(contact('ig:IGSID7'), 'Instagram too');
      assert.ok(fx.sent.filter((m) => m.to === 'meta:IGSID7').at(-1)!.body.startsWith(TEXT.en.welcome));

      // a person may answer for 7 days (Meta's human agent tag); the bot itself never uses it
      await teamHi();
      const code = contact('fb:PSID9').code;
      now += 30 * 60 * MIN;
      await post([text(TEAM[0], `#${code} Sorry for the wait, we can build it.`)]);
      const late = fx.sent.filter((m) => m.to === 'meta:PSID9').at(-1)! as Sent & { raw: Row };
      assert.equal(late.body, 'Sorry for the wait, we can build it.');
      assert.deepEqual([late.raw.messaging_type, late.raw.tag], ['MESSAGE_TAG', 'HUMAN_AGENT']);
      now += 7 * 24 * 60 * MIN;
      await post([text(TEAM[0], `#${code} Still there?`)]);
      assert.match(last(TEAM[0]).body, /Messenger \(7 days for a person's reply\) window has closed/);
    } finally { delete env.FB_PAGE_TOKEN; delete env.FB_PAGE_ID; delete env.IG_ACCOUNT_ID; }
  });
  await t.test('phase 7 fixes: the bubble takes only buttons the bot offered; DELETE MY DATA answers in the response', async () => {
    await reset();
    await teamHi();
    const s = crypto.randomUUID();
    assert.equal((await web(s, { reply: { id: 'del:y', title: 'Yes' } })).status, 409, 'no button before the bot sent one');
    await web(s, { text: 'Hi' });
    assert.equal((await web(s, { reply: { id: 'slot:29870970', title: '3 am' } })).status, 409, 'not one of the menu’s buttons');
    assert.equal((await web(s, { reply: { id: 'svc:website', title: 'Website' } })).status, 202);
    assert.equal((await web(s, { reply: { id: 'svc:seo', title: 'SEO' } })).status, 409, 'an older message’s button');
    await web(s, { text: 'Delete my data' });
    const res = await web(s, { reply: { id: 'del:y', title: 'Yes, delete' } });
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json().then((b: Row) => [b.erased, b.notice]), [true, TEXT.en.deleted]);
    assert.ok(!sb.tables.contacts.some((c) => c.wa_id === `web:${s}`), 'erased');
    assert.ok(!fx.sent.some((m) => TEAM.includes(m.to) && m.body.includes('asked to delete their data')), 'the team had nothing of theirs');

    await toName();
    assert.ok(sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'out').every((m) => !('options' in m)),
      'WhatsApp rows carry no options column (WhatsApp keeps working before 007_phase7.sql)');
  });

  await t.test('phase 7 fixes: Instagram texts are cut to 1,000 bytes, Messenger to 2,000 characters', () => {
    const ml = 'ഞങ്ങൾ വെബ്സൈറ്റുകൾ നിർമ്മിക്കുന്നു. '.repeat(25);          // about 2,800 bytes: three parts
    const ig = parts(ml, true);
    assert.ok(ig.length > 1 && ig.every((p) => new TextEncoder().encode(p).length <= 1000), 'every Instagram part fits');
    assert.equal(ig.join(' ').replace(/\s+/g, ' ').trim(), ml.replace(/\s+/g, ' ').trim(), 'nothing lost or added');
    assert.deepEqual(parts('Short.', true), ['Short.']);
    const long = parts('ഞങ്ങൾ '.repeat(1000), true);
    assert.ok(long.length === 5 && long[4].endsWith('…') && long.every((p) => new TextEncoder().encode(p).length <= 1000), 'five at most, the last clipped');
    assert.ok(parts('a'.repeat(4500), false).every((p) => p.length <= 2000));
  });
});
