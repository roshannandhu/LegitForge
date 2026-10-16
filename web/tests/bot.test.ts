import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker, { clock, tick, type Env } from '../bot/worker';
import { LANGS, TEXT } from '../bot/text';
import { fakeEmbedding, fakeSupabase, installFakes, type Responder, type Sent } from './bot-fakes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const SECRET = 'test-app-secret-only';
const TEAM = ['919000000001', '919000000002'];
const CLIENT = '919811111111', CLIENT2 = '919822222222', CLIENT3 = '919833333333';
const OPEN = Date.parse('2026-10-14T05:30:00Z');     // Wednesday 11:00 IST: open
const SUNDAY = Date.parse('2026-10-18T05:30:00Z');   // closed all day
const MIN = 60_000;
const blank = { name: '', business: '', need_en: '', timeline: '', question_en: '', commitment: false };
const question = (q: string, commitment = false) => ({ ...blank, kind: 'question', question_en: q, commitment });

test('WhatsApp bot (fake Meta, Supabase, Groq and Gemini; real Miniflare D1)', async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-09-25', d1Databases: ['DB'] }));
  const db = await mf.getD1Database('DB') as unknown as D1Database;
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
    GEMINI_API_KEY: 'gemini-key', SITE_URL: 'https://legitforge.pages.dev',
  };

  let n = 0;
  const reset = async () => {
    for (const rows of Object.values(sb.tables)) rows.length = 0;
    fx.sent.length = 0; fx.aiBodies.length = 0;
    Object.assign(fx.state, { ai: (() => 500) as Responder, graphDown: false, embedDown: false, onSend: undefined });
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
    assert.match(row?.message ?? '', /Business: Ravi Bakery[\s\S]*Timeline: As soon as possible/);
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
      if (task === 'answer') return { answer: user.includes('one to two weeks') && /How long does a website take/.test(user) ? 'Usually one to two weeks.' : '' };
      return 500;
    };
    await toName();
    await post([text(CLIENT, 'How long does it take?')]);
    assert.ok(last(CLIENT).body.startsWith('Usually one to two weeks.') && last(CLIENT).body.endsWith(TEXT.en.name), 'answer, then the question again');
    assert.equal(sb.tables.questions.length, 0);
    await post([text(CLIENT, 'What price and finish date for mine?')]);
    assert.equal(sb.tables.questions.length, 1, 'commitment questions always go to the team');
    assert.ok(last(CLIENT).body.startsWith(TEXT.en.checking));
    await post([text(CLIENT, 'Do you host in Dubai?')]);
    assert.equal(sb.tables.questions.length, 2);
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
      if (task === 'answer') return { answer: user.includes('we set up hosting in your name') ? 'ഹോസ്റ്റിംഗ് നിങ്ങളുടെ പേരിൽ സജ്ജമാക്കും.' : '' };
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
    const before = sb.tables.questions.length;
    await post([text(CLIENT, 'hosting?')]);                        // the same question again: the bot answers it
    assert.ok(last(CLIENT).body.startsWith('ഹോസ്റ്റിംഗ് നിങ്ങളുടെ'));
    assert.equal(sb.tables.questions.length, before, 'no new team question');

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
    fx.state.ai = (task) => (task === 'extract' ? question('Do you build Shopify stores?') : task === 'answer' ? { answer: '' } : 500);
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
    await Promise.all([post([text(CLIENT, 'Hi')]), post([text(CLIENT, 'I need a website for my shop')])]);
    assert.equal(to(CLIENT).filter((s) => s.ids.some((id) => id.startsWith('svc:'))).length, 1);
    assert.equal(contact().step, 'language');
    assert.equal(contact().service, 'website');
    assert.ok(sb.tables.messages.filter((m) => m.wa_id === CLIENT && m.dir === 'in').every((m) => m.handled_at));
    assert.equal(contact().busy_until, null, 'lock released');
  });

  await t.test('team window closed → template; client window closed → the team is told', async () => {
    await reset();
    await toName();
    for (const answer of ['Ravi', 'Ravi Bakery', 'A website']) await post([text(CLIENT, answer)]);
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
      if (task === 'answer') return { answer: 'Usually one to two weeks.' };
      return 500;
    };
    await toName(CLIENT, 'ml');
    await post([text(CLIENT, 'വെബ്സൈറ്റ് എത്ര സമയം എടുക്കും?')]);
    assert.ok(last(CLIENT).body.startsWith(TEXT.ml.checking), 'no Groq-written Malayalam');
    assert.equal(sb.tables.questions.length, 1);
    await toName(CLIENT2, 'en');
    await post([text(CLIENT2, 'How long does a website take?')]);
    assert.ok(last(CLIENT2).body.startsWith('Usually one to two weeks.'));
  });
});
