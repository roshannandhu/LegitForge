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
const blank = { name: '', business: '', need_en: '', timeline: '', question_en: '', commitment: false, price: false, mood: 'calm', abusive: false };
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
    GEMINI_API_KEY: 'gemini-key', SITE_URL: 'https://legitforge.pages.dev', TRAINING_DAYS: '0',
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
    for (const a of ['Ravi', 'Ravi Bakery', 'A website']) await post([text(CLIENT, a)]);
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
      const learned = sb.tables.knowledge.at(-1)!;
      assert.equal(learned.status, 'approved');
      assert.equal(learned.answer_en, 'Yes, in Malayalam and English.');
      assert.match(last(TEAM[0]).body, /Saved for next time/);
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
    assert.equal(last(CLIENT).body, TEXT.en.callSoon);
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
    assert.ok(teamGot(TEAM[0], `#${code} asked to delete their data`));
    await post([text(CLIENT, 'Hi again')]);
    assert.equal(last(CLIENT).type, 'list', 'a later message starts fresh');
    assert.notEqual(contact().code, code);
  });

  await t.test('phase 1: a returning client chooses the earlier enquiry or a new one', async () => {
    await reset();
    await toName();
    for (const a of ['Ravi', 'Ravi Bakery', 'A website']) await post([text(CLIENT, a)]);
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
    assert.deepEqual(contact().fields, { prev_leads: [first] }, 'the earlier lead is remembered, so DELETE MY DATA reaches it');
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

  await t.test('phase 1 fixes: the draft card keeps the draft and its English whole (1024 / 900 limits)', async () => {
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
      assert.ok(card.body.includes(q.draft) && card.body.includes(q.draft_en), 'both drafts uncut on the card');
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
    for (const a of ['Ravi', 'Ravi Bakery', 'A website']) await post([text(CLIENT, a)]);
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
});
