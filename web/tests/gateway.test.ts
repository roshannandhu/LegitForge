import test from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, chosen, isPersonChat, jidOf, labels, pollVote, toBaileys, toCloudMessage, tunnelUrl, webhookBody, type InMsg } from '../gateway/convert';
import { rest, supabaseAuth, supabasePolls, type Kit } from '../gateway/store';
import { inbound } from '../bot/worker';
import { LANGS, LANG_PROMPT, SERVICES, TEXT } from '../bot/text';

/** The WhatsApp Web (Baileys) gateway's conversions (web/gateway/convert.ts): what WhatsApp Web
 *  gives becomes what the bot reads, and the bot's lists and buttons become tappable polls. */

const msg = (message: Record<string, unknown>, jid = '919847012345@s.whatsapp.net', extra: Partial<InMsg['key']> = {}): InMsg =>
  ({ key: { id: 'ABC123', remoteJid: jid, fromMe: false, ...extra }, message, messageTimestamp: 1760000000, pushName: 'Ravi' });

test('who the bot talks to: people only, by phone number (or the hidden-number id)', () => {
  assert.ok(isPersonChat('919847012345@s.whatsapp.net'));
  assert.ok(isPersonChat('112233445566@lid'));
  for (const j of ['1203630@g.us', 'status@broadcast', '12036@newsletter', '123@broadcast', null]) assert.ok(!isPersonChat(j), String(j));
  assert.equal(addressOf('919847012345@s.whatsapp.net'), '919847012345');
  assert.equal(addressOf('919847012345:12@s.whatsapp.net'), '919847012345', 'a linked device is the same person');
  assert.equal(addressOf('112233445566@lid', '919847012345@s.whatsapp.net'), '919847012345', 'a LID with its phone number');
  assert.equal(addressOf('112233445566:3@lid'), '112233445566@lid', 'no number: the LID itself');
  assert.equal(jidOf('919847012345'), '919847012345@s.whatsapp.net');
  assert.equal(jidOf('112233445566@lid'), '112233445566@lid');
});

test('WhatsApp Web messages become the Cloud API messages the bot reads', () => {
  assert.deepEqual(toCloudMessage(msg({ conversation: 'Enikku oru website venam' }), '919847012345'),
    { from: '919847012345', id: 'ABC123', timestamp: '1760000000', type: 'text', text: { body: 'Enikku oru website venam' } });
  assert.deepEqual(toCloudMessage(msg({ extendedTextMessage: { text: 'Yes, we can.', contextInfo: { stanzaId: 'ALERT9' } } }), '91999')!.context,
    { id: 'ALERT9' }, 'a swipe-reply keeps what it answers');
  const img = toCloudMessage(msg({ ephemeralMessage: { message: { imageMessage: { mimetype: 'image/jpeg', caption: 'our shop' } } } }), '91999')!;
  assert.deepEqual([img.type, img.image], ['image', { id: 'ABC123', mime_type: 'image/jpeg', caption: 'our shop' }], 'out of the disappearing-message wrapper');
  assert.deepEqual(toCloudMessage(msg({ audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } }), '91999')!.audio, { id: 'ABC123', mime_type: 'audio/ogg; codecs=opus', voice: true });
  assert.equal(toCloudMessage(msg({ documentWithCaptionMessage: { message: { documentMessage: { mimetype: 'application/pdf', fileName: 'brief.pdf' } } } }), '91999')!.type, 'document');
  assert.equal(toCloudMessage(msg({ protocolMessage: { type: 0 } }), '91999'), null, 'a deleted-message notice is not mail');
  assert.equal(toCloudMessage(msg({ pollUpdateMessage: {} }), '91999'), null, 'votes come through pollVote');
  assert.equal(toCloudMessage(msg({ stickerMessage: {} }), '91999')!.type, 'sticker');
});

test('the bot reads a gateway webhook exactly as a Meta one', () => {
  const m = toCloudMessage(msg({ conversation: 'Hi' }), '919847012345')!;
  const rows = inbound(webhookBody('PNID', '919847012345', 'Ravi', [m]), { WA_PHONE_NUMBER_ID: 'PNID', TEAM_WHATSAPP: '' } as never);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].wa_id, rows[0].body, rows[0].profile, rows[0].wamid], ['919847012345', 'Hi', 'Ravi', 'ABC123']);
  const vote = inbound(webhookBody('PNID', '919847012345', null, [pollVote('919847012345', 'poll.P1.V1', 'P1', { id: 'lang:mg', title: 'Manglish' }, '1760000000')]),
    { WA_PHONE_NUMBER_ID: 'PNID', TEAM_WHATSAPP: '' } as never);
  assert.deepEqual([vote[0].reply_id, vote[0].body, vote[0].ctx_id], ['lang:mg', 'Manglish', 'P1'], 'a poll tap is a list tap');
});

test('the bot’s lists and buttons become polls (tappable on every WhatsApp app, numbered for typing)', () => {
  // the service menu: a list with the privacy footer → the text, then the poll
  const menu = toBaileys({ type: 'interactive', interactive: { type: 'list', body: { text: TEXT.en.welcome }, footer: { text: 'Automated assistant · legitforge.pages.dev/privacy' },
    action: { button: TEXT.en.menu, sections: [{ title: 'x', rows: SERVICES.map((s) => ({ id: `svc:${s.key}`, title: s.title })) }] } } });
  assert.equal(menu.length, 2);
  assert.deepEqual(menu[0], { kind: 'text', text: `${TEXT.en.welcome}\n\nAutomated assistant · legitforge.pages.dev/privacy` });
  assert.equal(menu[1].kind, 'poll');
  if (menu[1].kind !== 'poll') return;
  assert.equal(menu[1].name, TEXT.en.menu);
  assert.deepEqual(labels(menu[1].options).slice(0, 2), ['1. Website', '2. Web app']);
  // the language list: all nine styles, one tap each
  const langs = toBaileys({ type: 'interactive', interactive: { type: 'list', body: { text: LANG_PROMPT }, action: { button: 'Language', sections: [{ rows: LANGS.map((l) => ({ id: `lang:${l.key}`, title: l.title })) }] } } });
  assert.deepEqual(langs.map((o) => o.kind), ['poll'], 'a short question is the poll itself');
  if (langs[0].kind === 'poll') assert.deepEqual(langs[0].options.map((o) => o.id), LANGS.map((l) => `lang:${l.key}`));
  // reply buttons (the timeline), a single Skip, a long question, a template, plain text
  const tl = toBaileys({ type: 'interactive', interactive: { type: 'button', body: { text: TEXT.ml.timeline }, action: { buttons: TEXT.ml.tl.map((title, i) => ({ type: 'reply', reply: { id: `tl:${i}`, title } })) } } });
  assert.deepEqual(tl[0].kind === 'poll' && labels(tl[0].options), TEXT.ml.tl.map((x, i) => `${i + 1}. ${x}`));
  const skip = toBaileys({ type: 'interactive', interactive: { type: 'button', body: { text: TEXT.en.refs }, action: { buttons: [{ type: 'reply', reply: { id: 'skip:refs', title: 'Skip' } }] } } });
  assert.ok(skip[0].kind === 'poll' && labels(skip[0].options)[0] === 'Skip', 'one option: not numbered');
  const long = toBaileys({ type: 'interactive', interactive: { type: 'button', body: { text: `${'A long question. '.repeat(20)}Shall we arrange a call?` }, action: { buttons: [{ type: 'reply', reply: { id: 'call:y', title: 'Yes' } }, { type: 'reply', reply: { id: 'call:n', title: 'No' } }] } } });
  assert.deepEqual(long.map((o) => o.kind), ['text', 'poll']);
  assert.ok(long[1].kind === 'poll' && long[1].name === 'Shall we arrange a call?');
  assert.deepEqual(toBaileys({ type: 'template', template: { name: 'team_alert', components: [{ type: 'body', parameters: [{ type: 'text', text: 'K7Q2' }, { type: 'text', text: 'New lead' }] }] } }),
    [{ kind: 'text', text: 'K7Q2\n\nNew lead' }], 'no templates on WhatsApp Web: plain text');
  assert.deepEqual(toBaileys({ type: 'text', text: { body: 'Hello' } }), [{ kind: 'text', text: 'Hello' }]);
});

test('a vote is the option it chose', () => {
  const options = [{ id: 'svc:website', title: 'Website' }, { id: 'svc:app', title: 'Web app' }];
  assert.deepEqual(chosen(options, [{ name: '1. Website', voters: [] }, { name: '2. Web app', voters: ['919847012345@s.whatsapp.net'] }]), options[1]);
  assert.equal(chosen(options, [{ name: '1. Website', voters: [] }]), null, 'a vote taken back');
  assert.deepEqual(chosen([{ id: 'skip:refs', title: 'Skip' }], [{ name: 'Skip', voters: ['x'] }]), { id: 'skip:refs', title: 'Skip' });
});

test('the laptop backup: the quick tunnel address is read from cloudflared, never its API host', () => {
  assert.equal(tunnelUrl('2026-10-18T09:00:00Z INF |  https://brave-lion-cat-dog.trycloudflare.com                    |'), 'https://brave-lion-cat-dog.trycloudflare.com');
  assert.equal(tunnelUrl('ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp'), null);
  assert.equal(tunnelUrl('INF Requesting new quick Tunnel on trycloudflare.com...'), null);
});

/** Baileys' BufferJSON, restated (the site's tests run without installing Baileys). */
const BufferJSON: Kit['BufferJSON'] = {
  replacer: (_k, v) => (Buffer.isBuffer(v) || v instanceof Uint8Array || (v as { type?: string })?.type === 'Buffer'
    ? { type: 'Buffer', data: Buffer.from(((v as { data?: number[] }).data ?? v) as Uint8Array).toString('base64') } : v),
  reviver: (_k, v) => ((v as { type?: string; data?: unknown })?.type === 'Buffer' && typeof (v as { data?: unknown }).data === 'string' ? Buffer.from((v as { data: string }).data, 'base64') : v),
};

test('the gateway keeps its WhatsApp Web login and polls in Supabase: a restart or a move to the laptop keeps the link', async () => {
  type R = { key: string; value: unknown; updated_at: string };
  const rows = new Map<string, R>();
  const keys: string[] = [];
  const fake = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/rest/v1/wa_auth');
    keys.push((init.headers as Record<string, string>).apikey);
    const p = url.searchParams, method = init.method ?? 'GET';
    const match = (r: R) => [...p].every(([k, v]) => {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) return true;
      const col = String(r[k as keyof R]);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(col);
      if (v.startsWith('like.')) return col.startsWith(v.slice(5).replace(/\*$/, ''));
      if (v.startsWith('lt.')) return col < v.slice(3);
      throw new Error(`fake: ${k}=${v}`);
    });
    if (method === 'GET') {
      const out = [...rows.values()].filter(match).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return Response.json(out.slice(0, Number(p.get('limit') ?? 1e9)).map((r) => ({ key: r.key, value: r.value })));
    }
    if (method === 'POST') { for (const r of JSON.parse(String(init.body)) as R[]) rows.set(r.key, r); return new Response(null, { status: 201 }); }
    if (method === 'DELETE') { for (const r of [...rows.values()].filter(match)) rows.delete(r.key); return new Response(null, { status: 204 }); }
    return new Response('?', { status: 405 });
  }) as typeof fetch;
  const db = rest('https://sb.test/', 'sb-key', fake);
  const kit: Kit = { BufferJSON, initAuthCreds: () => ({ noiseKey: { private: Buffer.from([1, 2]) }, registered: false }), syncKey: (v) => ({ synced: v }) };

  const first = await supabaseAuth(db, kit);
  const creds = first.state.creds as { noiseKey: { private: Buffer }; registered: boolean };
  assert.equal(creds.registered, false, 'a new login');
  creds.registered = true;
  await first.saveCreds();
  await first.state.keys.set({ 'pre-key': { 1: { public: Buffer.from([9]) }, 2: { public: Buffer.from([8]) } }, session: { 'x:1': Buffer.from('s') } });

  const again = await supabaseAuth(db, kit);                       // a restart (Render's disk is gone), or the laptop
  const back = again.state.creds as typeof creds;
  assert.equal(back.registered, true, 'still linked: no new QR');
  assert.ok(Buffer.isBuffer(back.noiseKey.private) && back.noiseKey.private.equals(Buffer.from([1, 2])), 'bytes survive the jsonb round trip');
  const got = await again.state.keys.get('pre-key', ['1', '2', '3']) as Record<string, { public: Buffer }>;
  assert.deepEqual(Object.keys(got).sort(), ['1', '2'], 'a missing key is left out');
  assert.ok(got['1'].public.equals(Buffer.from([9])));
  await again.state.keys.set({ 'pre-key': { 1: null } });
  assert.deepEqual(await again.state.keys.get('pre-key', ['1']), {}, 'a deleted key is gone');
  await again.state.keys.set({ 'app-state-sync-key': { k: { keyData: Buffer.from([7]) } } });
  assert.ok(((await again.state.keys.get('app-state-sync-key', ['k'])).k as { synced: unknown }).synced, 'sync keys go back through proto');

  const polls = supabasePolls(db, kit);
  await polls.save('P1', { options: [{ id: 'svc:website', title: 'Website' }], message: { key: { id: 'P1' }, secret: Buffer.from([5]) }, at: 1 });
  const loaded = await polls.load() as Record<string, { message: { secret: Buffer } }>;
  assert.ok(loaded.P1.message.secret.equals(Buffer.from([5])), 'a vote can still be read after a restart');
  await again.clear();
  assert.deepEqual([...rows.keys()], ['poll:P1'], 'logging out forgets the login only');
  assert.ok(keys.every((k) => k === 'sb-key'), 'every request carries the secret key');
});
