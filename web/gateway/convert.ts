/** The WhatsApp Web (Baileys) gateway's conversions, pure: a Baileys message becomes the Cloud API
 *  webhook the bot Worker already reads (bot/worker.ts inbound), and what the bot asks to send
 *  becomes what Baileys sends. No Baileys import here, so the website's tests load it
 *  (tests/gateway.test.ts). index.ts does the connecting. */

export interface Option { id: string; title: string }
// A Baileys message, as far as the bot needs it (proto.IWebMessageInfo).
export interface InMsg {
  key: { id?: string | null; remoteJid?: string | null; remoteJidAlt?: string | null; fromMe?: boolean | null };
  message?: Record<string, any> | null;
  messageTimestamp?: number | string | { toNumber(): number } | null;
  pushName?: string | null;
}

/** WhatsApp lists and buttons from an unofficial client don't show on phones, so a choice is a
 *  poll: it shows on every WhatsApp app, a tap answers it, and each option is numbered so typing
 *  "2" works too (bot/worker.ts optionFor). A poll's question holds 255 characters. */
const POLL_NAME = 255;

/** A chat's jid that the bot answers: a person (a phone number or a hidden-number LID), never a
 *  group, a status, a channel, a broadcast list or our own message. */
export function isPersonChat(jid: string | null | undefined): jid is string {
  return !!jid && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'));
}

/** The address the bot keeps for a chat: the phone number's digits, or the LID jid itself when
 *  WhatsApp hides the number (the bot then has no wa.me link, as with a Cloud API username). */
export function addressOf(jid: string, phone?: string | null): string {
  const pn = phone ?? (jid.endsWith('@s.whatsapp.net') ? jid : null);
  const digits = pn ? pn.split('@')[0].split(':')[0] : '';
  if (/^\d{6,15}$/.test(digits)) return digits;
  const [user, server] = jid.split('@');
  return `${user.split(':')[0]}@${server}`;                               // (without a device suffix)
}

/** The jid to send to, from the bot's address (digits, or a LID jid). */
export const jidOf = (to: string) => (/^\d+$/.test(to) ? `${to}@s.whatsapp.net` : to);

const seconds = (t: InMsg['messageTimestamp']) =>
  String(typeof t === 'object' && t ? t.toNumber() : Number(t) || Math.floor(Date.now() / 1000));

/** The message itself, out of WhatsApp's wrappers (disappearing, view once, a captioned document). */
export function unwrap(m: Record<string, any> | null | undefined): Record<string, any> | null {
  let x = m ?? null;
  for (let i = 0; x && i < 4; i++) {
    const inner = x.ephemeralMessage?.message ?? x.viewOnceMessage?.message ?? x.viewOnceMessageV2?.message
      ?? x.viewOnceMessageV2Extension?.message ?? x.documentWithCaptionMessage?.message;
    if (!inner) break;
    x = inner;
  }
  return x;
}

/** One Baileys message → the Cloud API message object (text, a file, a voice note, a reply to an
 *  earlier message); null for what the bot never reads (receipts, protocol messages, poll votes,
 *  which come through pollVote). A file's id is the message id: GET /media/<id> serves it. */
export function toCloudMessage(m: InMsg, from: string): Record<string, unknown> | null {
  const x = unwrap(m.message);
  const id = m.key.id;
  if (!x || !id) return null;
  if (x.protocolMessage || x.pollUpdateMessage || (x.senderKeyDistributionMessage && Object.keys(x).length === 1)) return null;
  const base: Record<string, unknown> = { from, id, timestamp: seconds(m.messageTimestamp) };
  const ctx = (x.extendedTextMessage ?? x.imageMessage ?? x.videoMessage ?? x.documentMessage ?? x.audioMessage)?.contextInfo?.stanzaId;
  if (ctx) base.context = { id: ctx };                                       // a swipe-reply: the team answers alerts this way
  const text = x.conversation ?? x.extendedTextMessage?.text;
  if (typeof text === 'string') return { ...base, type: 'text', text: { body: text } };
  if (x.imageMessage) return { ...base, type: 'image', image: { id, mime_type: x.imageMessage.mimetype, ...(x.imageMessage.caption ? { caption: x.imageMessage.caption } : {}) } };
  if (x.videoMessage) return { ...base, type: 'video', video: { id, mime_type: x.videoMessage.mimetype, ...(x.videoMessage.caption ? { caption: x.videoMessage.caption } : {}) } };
  if (x.documentMessage) {
    return { ...base, type: 'document', document: { id, mime_type: x.documentMessage.mimetype, filename: x.documentMessage.fileName ?? undefined,
      ...(x.documentMessage.caption ? { caption: x.documentMessage.caption } : {}) } };
  }
  if (x.audioMessage) return { ...base, type: 'audio', audio: { id, mime_type: x.audioMessage.mimetype, voice: !!x.audioMessage.ptt } };
  if (x.reactionMessage) return { ...base, type: 'reaction' };              // the bot ignores reactions
  if (x.stickerMessage) return { ...base, type: 'sticker' };
  if (x.locationMessage || x.liveLocationMessage) return { ...base, type: 'location' };
  if (x.contactMessage || x.contactsArrayMessage) return { ...base, type: 'contacts' };
  if (x.pollCreationMessage || x.pollCreationMessageV3) return { ...base, type: 'unsupported' };
  return null;
}

/** A tap on one of the bot's poll options → the interactive reply the bot reads (as a list tap). */
export function pollVote(from: string, voteId: string, pollId: string, option: Option, timestamp: string): Record<string, unknown> {
  return { from, id: voteId, timestamp, type: 'interactive', context: { id: pollId }, interactive: { type: 'list_reply', list_reply: { id: option.id, title: option.title } } };
}

/** The option a vote chose: the poll's current choice (one per poll), by its numbered name. */
export function chosen(options: Option[], votes: { name: string; voters: string[] }[]): Option | null {
  const name = votes.find((v) => v.voters.length > 0)?.name;
  if (!name) return null;
  return options.find((o, i) => labels(options)[i] === name) ?? null;
}

/** A poll's option names: numbered when there is more than one (a typed "2" answers too). */
export const labels = (options: Option[]) => options.map((o, i) => (options.length > 1 ? `${i + 1}. ${o.title}` : o.title));

/** The Cloud API webhook body for messages from one chat (signed and posted to the bot). */
export function webhookBody(phoneNumberId: string, from: string, name: string | null | undefined, messages: Record<string, unknown>[]) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'baileys', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: phoneNumberId },
      contacts: [{ wa_id: from, profile: { name: name ?? '' } }], messages,
    } }] }],
  };
}

export type Out = { kind: 'text'; text: string } | { kind: 'poll'; name: string; options: Option[] };

/** What the bot asked to send (the Cloud API payload) → what Baileys sends: text as text; a list or
 *  buttons as a poll (the question first as its own message when it is longer than a poll's
 *  question, or has a footer); a template as plain text (WhatsApp Web has no 24-hour window). */
export function toBaileys(payload: Record<string, any>): Out[] {
  if (payload.type === 'text') return [{ kind: 'text', text: String(payload.text?.body ?? '') }];
  if (payload.type === 'template') {
    const params = (payload.template?.components?.[0]?.parameters ?? []).map((p: { text: string }) => p.text).filter(Boolean);
    return params.length ? [{ kind: 'text', text: params.join('\n\n') }] : [];
  }
  if (payload.type === 'interactive') {
    const i = payload.interactive ?? {};
    const options: Option[] = i.type === 'list'
      ? (i.action?.sections ?? []).flatMap((s: { rows: Option[] }) => s.rows.map((r) => ({ id: r.id, title: r.title })))
      : (i.action?.buttons ?? []).map((b: { reply: Option }) => ({ id: b.reply.id, title: b.reply.title }));
    const body = String(i.body?.text ?? ''), footer = i.footer?.text ? String(i.footer.text) : '';
    if (!options.length) return [{ kind: 'text', text: footer ? `${body}\n\n${footer}` : body }];
    if (body.length <= POLL_NAME && !footer) return [{ kind: 'poll', name: body, options }];
    // a list: its button's words ("Choose a service"); buttons: the question's last sentence ("Shall we arrange a call?")
    const lastLine = body.split('\n').filter(Boolean).at(-1) ?? '';
    const name = (i.type === 'list' && i.action?.button) || lastLine.split(/(?<=[.?!।])\s+/).filter(Boolean).at(-1) || lastLine || '…';
    return [{ kind: 'text', text: footer ? `${body}\n\n${footer}` : body }, { kind: 'poll', name: String(name).slice(0, POLL_NAME), options }];
  }
  return [];
}

/** The address a Cloudflare quick tunnel prints when it starts (`cloudflared tunnel --url …`, the
 *  laptop backup), never the API it asks for one (api.trycloudflare.com, in its error lines). */
export const tunnelUrl = (line: string) => /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i.exec(line)?.[0] ?? null;
