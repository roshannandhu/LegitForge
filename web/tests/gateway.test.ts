import test from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, chosen, isPersonChat, jidOf, labels, pollVote, toBaileys, toCloudMessage, webhookBody, type InMsg } from '../gateway/convert';
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
