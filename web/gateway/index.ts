/** The Legit Forge WhatsApp gateway: WhatsApp Web (Baileys) for the bot Worker, which stays the
 *  only brain (bot/worker.ts). A client's message is passed to the bot's /webhook signed like
 *  Meta's (X-Hub-Signature-256, WA_APP_SECRET), so the bot reads it unchanged; the bot's replies
 *  come back to POST /send (signed the same way) and go out through WhatsApp Web, lists and
 *  buttons as polls (convert.ts). Runs on Render's free plan, or the laptop as the backup (SETUP.md
 *  step 13): with SUPABASE_URL + SUPABASE_SECRET_KEY the login and the open polls live in Supabase
 *  (store.ts), so a restart or a move keeps the link; without them, in data/. It tells the bot
 *  where it is by itself (Render's address, or a Cloudflare quick tunnel it starts on the laptop).
 *
 *  ponytail: one process, one WhatsApp number: never run Render and the laptop at the same time. */

import makeWASocket, {
  Browsers, BufferJSON, DisconnectReason, downloadMediaMessage, decryptPollVote,
  getAggregateVotesInPollMessage, getKeyAuthor, initAuthCreds, isLidUser, jidNormalizedUser, proto,
  useMultiFileAuthState, type AuthenticationState, type WAMessage, type WASocket,
} from '@whiskeysockets/baileys';
import { spawn } from 'node:child_process';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import pino from 'pino';
import QRCode from 'qrcode';
import qrcode from 'qrcode-terminal';
import { addressOf, chosen, isPersonChat, jidOf, labels, pollVote, toBaileys, toCloudMessage, tunnelUrl, unwrap, webhookBody, type Option } from './convert.ts';
import { rest, supabaseAuth, supabasePolls, type Kit } from './store.ts';

const env = process.env;
const BOT = env.BOT_WEBHOOK_URL ?? '';                      // https://legitforge-bot.<subdomain>.workers.dev/webhook
const SECRET = env.WA_APP_SECRET ?? '';                     // the same secret as the bot Worker's WA_APP_SECRET
const PHONE_ID = env.WA_PHONE_NUMBER_ID || 'baileys';        // the bot's WA_PHONE_NUMBER_ID must be the same
const PORT = Number(env.PORT || 8790);
const DATA = env.DATA_DIR || 'data';                        // the login (keep it private, back it up) and the open polls
const PAIR = (env.PAIR_PHONE ?? '').replace(/\D/g, '');      // optional: a pairing code for this number instead of a QR code
if (!BOT || SECRET.length < 16) { console.error('Set BOT_WEBHOOK_URL and WA_APP_SECRET (16+ characters, the bot Worker\'s too).'); process.exit(1); }
const kit: Kit = { BufferJSON, initAuthCreds, syncKey: (v) => proto.Message.AppStateSyncKeyData.fromObject(v as object) };
const db = env.SUPABASE_URL && env.SUPABASE_SECRET_KEY ? rest(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY) : null;
const pollStore = db ? supabasePolls(db, kit) : null;
// Its public address: Render's own, one set by hand (PUBLIC_URL), else a quick tunnel (the laptop).
const FIXED = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');

const log = pino({ level: env.LOG_LEVEL || 'warn' });
const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
const signed = (body: string, header: string | undefined) => {
  const want = Buffer.from(sign(body)), got = Buffer.from(header ?? '');
  return want.length === got.length && timingSafeEqual(want, got);
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toSecretBuffer(v: unknown): Buffer | null {
  if (!v) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === 'string') return Buffer.from(v, 'base64');
  if (typeof v === 'object' && 'data' in v) {
    const d = (v as { data?: unknown }).data;
    return typeof d === 'string' ? Buffer.from(d, 'base64') : Buffer.from(d as Uint8Array);
  }
  return null;
}

/* ------------------------------------------------------------------ what the gateway remembers */

// Sent messages (WhatsApp asks for them again to retry or to decrypt a poll vote), received files
// (the bot fetches them once) and read receipts: in memory, the last few hundred.
const sent = new Map<string, WAMessage>(), received = new Map<string, WAMessage>();
const seenVotes = new Set<string>();
const keep = (map: Map<string, WAMessage>, m: WAMessage, max = 500) => {
  if (!m.key.id) return;
  map.set(m.key.id, m);
  while (map.size > max) map.delete(map.keys().next().value!);
};
// The bot's polls, by poll message id: the options (with the bot's ids) and the poll message itself
// (needed to read a vote). Kept (Supabase, or data/), so a vote still works after a restart.
type Poll = { options: Option[]; message: WAMessage; at: number };
let polls: Record<string, Poll> = {};
const pollFile = `${DATA}/polls.json`;
const savePoll = async (id: string) => {
  polls = Object.fromEntries(Object.entries(polls).sort((a, b) => b[1].at - a[1].at).slice(0, 300));
  // (BufferJSON: a poll's secret is bytes, needed to read a vote)
  await (pollStore ? pollStore.save(id, polls[id]) : writeFile(pollFile, JSON.stringify(polls, BufferJSON.replacer)))
    .catch((e) => log.error({ e: String(e) }, 'poll not saved'));
};

/* ------------------------------------------------------------------ to the bot */

/** One chat's messages to the bot, retried while it is unavailable (it answers 500 when Supabase
 *  is down: nothing is lost, the bot stores before it answers). */
async function toBot(from: string, name: string | null | undefined, messages: Record<string, unknown>[]) {
  const body = JSON.stringify(webhookBody(PHONE_ID, from, name, messages));
  for (let attempt = 0, delay = 2000; attempt < 6; attempt++, delay *= 2) {
    try {
      const r = await fetch(BOT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) }, body, signal: AbortSignal.timeout(15_000) });
      if (r.ok) return;
      if (r.status < 500) { log.error({ status: r.status }, 'the bot refused a message'); return; }
    } catch (e) { log.warn({ e: String(e) }, 'the bot is not reachable'); }
    await wait(delay);
  }
  log.error({ from }, 'gave up passing a message to the bot');
}

/** The client's phone number when WhatsApp gives it, for a hidden-number (LID) chat too. */
async function senderOf(sock: WASocket, m: WAMessage): Promise<string | null> {
  const jid = m.key.remoteJid;
  if (!isPersonChat(jid) || m.key.fromMe) return null;
  let phone = (m.key as { remoteJidAlt?: string }).remoteJidAlt ?? null;
  if (!phone && isLidUser(jid)) phone = await sock.signalRepository.lidMapping.getPNForLID(jid).catch(() => null);
  return addressOf(jid, phone && phone.endsWith('@s.whatsapp.net') ? phone : null);
}

/* ------------------------------------------------------------------ from the bot */

// One send at a time per chat, a moment apart, typing shown first: in order, and like a person.
const lanes = new Map<string, Promise<unknown>>();
function inLane<T>(jid: string, job: () => Promise<T>): Promise<T> {
  const run = (lanes.get(jid) ?? Promise.resolve()).then(job, job);
  lanes.set(jid, run.catch(() => undefined));
  return run;
}

async function send(sock: WASocket, payload: Record<string, any>): Promise<string | null> {
  const jid = jidOf(String(payload.to ?? payload.recipient ?? ''));
  let last: string | null = null;
  for (const out of toBaileys(payload)) {
    last = await inLane(jid, async () => {
      await sock.sendPresenceUpdate('composing', jid).catch(() => undefined);
      await wait(180 + Math.min(500, (out.kind === 'text' ? out.text.length : 40) * 4));
      const m = out.kind === 'text'
        ? await sock.sendMessage(jid, { text: out.text })
        : await sock.sendMessage(jid, { poll: { name: out.name, values: labels(out.options), selectableCount: 1 } });
      if (!m?.key.id) return null;
      keep(sent, m);
      if (out.kind === 'poll') { polls[m.key.id] = { options: out.options, message: m, at: Date.now() }; await savePoll(m.key.id); }
      return m.key.id;
    });
  }
  await sock.sendPresenceUpdate('paused', jid).catch(() => undefined);
  return last;
}

/* ------------------------------------------------------------------ WhatsApp Web */

let sock: WASocket | null = null, open = false, backoff = 2000;
// For Admin → WhatsApp → Connection (through the bot): the QR to scan while not linked, and since when linked.
let qrNow: string | null = null, since = 0;

async function connect() {
  const store = db ? await supabaseAuth(db, kit) : null;
  const { state, saveCreds } = store
    ? { state: store.state as unknown as AuthenticationState, saveCreds: store.saveCreds }
    : await useMultiFileAuthState(`${DATA}/auth`);
  const s = makeWASocket({
    auth: state, logger: log, browser: Browsers.ubuntu('Legit Forge'), markOnlineOnConnect: false, syncFullHistory: false,
    getMessage: async (key) => (key.id && (sent.get(key.id) ?? polls[key.id]?.message)?.message) || undefined,
  });
  sock = s;
  s.ev.on('creds.update', saveCreds);
  s.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) qrNow = qr;
    if (qr && !PAIR) {
      (QRCode as any).toFile('qr.png', qr).catch(() => {});
      console.log('Scan this with WhatsApp on the bot\'s phone (Linked devices → Link a device), or open Admin → WhatsApp → Connection (also saved as web/gateway/qr.png):');
      qrcode.generate(qr, { small: true });
    }
    if (qr && PAIR && !state.creds.registered) console.log(`Pairing code for +${PAIR}: ${await s.requestPairingCode(PAIR)} (WhatsApp → Linked devices → Link with phone number)`);
    if (connection === 'open') { open = true; qrNow = null; since = Date.now(); backoff = 2000; console.log(`WhatsApp connected as ${s.user?.id ?? '?'}.`); }
    if (connection === 'close') {
      open = false;
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // unlinked (from the phone, or Admin → WhatsApp → Connection → Log out): forget the login, show a new QR
        console.error('Logged out from WhatsApp: link the number again (a new QR follows).');
        await (store ? store.clear() : rm(`${DATA}/auth`, { recursive: true, force: true })).catch((e) => log.error({ e: String(e) }, 'login not cleared'));
        backoff = 2000;
      }
      if (code === DisconnectReason.connectionReplaced) console.error('Another WhatsApp Web session took over: run only one gateway for this number.');
      setTimeout(() => connect().catch((e) => log.error({ e: String(e) }, 'reconnect failed')), backoff);
      backoff = Math.min(backoff * 2, 60_000);
    }
  });
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;                           // history from the phone is not new mail
    for (const m of messages) {
      const from = await senderOf(s, m);
      if (!from) continue;

      // 1. WhatsApp poll update (user tapped a poll choice)
      const unwrapped = unwrap(m.message);
      const pollUpdate = unwrapped?.pollUpdateMessage;
      if (pollUpdate?.pollCreationMessageKey && pollUpdate?.vote) {
        const creationKey = pollUpdate.pollCreationMessageKey;
        const pollId = creationKey.id;
        let poll = pollId ? polls[pollId] : undefined;
        if (!poll && pollId && pollStore) {
          const loaded = await pollStore.load().catch(() => ({})) as Record<string, Poll>;
          if (loaded[pollId]) { poll = loaded[pollId]; polls[pollId] = poll; }
        }
        if (poll && pollId) {
          const me = jidNormalizedUser(s.user?.id ?? '');
          const creator = getKeyAuthor(creationKey, me) || me;
          const rawSecret = poll.message?.message?.messageContextInfo?.messageSecret
            ?? (poll.message?.message as Record<string, any>)?.pollCreationMessageV3?.messageContextInfo?.messageSecret
            ?? (poll.message?.message as Record<string, any>)?.pollCreationMessage?.messageContextInfo?.messageSecret
            ?? (poll.message as Record<string, any>)?.messageContextInfo?.messageSecret;
          const pollEncKey = toSecretBuffer(rawSecret);

          if (pollEncKey) {
            const t0 = Date.now();
            const voterJid = getKeyAuthor(m.key, me);
            const candidates = [
              voterJid,
              m.key.remoteJid,
              m.key.participant,
              (m.key as Record<string, any>).remoteJidAlt,
              (m.key as Record<string, any>).participantAlt,
            ].filter(Boolean) as string[];
            if (m.key.remoteJid && isLidUser(m.key.remoteJid)) {
              const pn = await s.signalRepository.lidMapping.getPNForLID(m.key.remoteJid).catch(() => null);
              if (pn) candidates.push(pn);
            }
            for (const c of [...candidates]) candidates.push(jidNormalizedUser(c));
            const uniqueCandidates = [...new Set(candidates)];

            let decrypted: proto.Message.PollVoteMessage | null = null;
            for (const cand of uniqueCandidates) {
              try {
                decrypted = decryptPollVote(pollUpdate.vote, {
                  pollEncKey,
                  pollCreatorJid: creator,
                  pollMsgId: pollId,
                  voterJid: cand,
                });
                if (decrypted) break;
              } catch {}
            }

            if (decrypted?.selectedOptions?.length) {
              const optionLabels = labels(poll.options);
              const selectedHexes = new Set(decrypted.selectedOptions.map((opt) => Buffer.from(opt).toString('hex')));
              let chosenOption: Option | null = null;
              for (let i = 0; i < poll.options.length; i++) {
                const hashHex = createHash('sha256').update(optionLabels[i]).digest('hex');
                const rawHashHex = createHash('sha256').update(poll.options[i].title).digest('hex');
                if (selectedHexes.has(hashHex) || selectedHexes.has(rawHashHex)) {
                  chosenOption = poll.options[i];
                  break;
                }
              }

              if (chosenOption) {
                const voteId = `poll.${pollId}.${m.key.id ?? Date.now()}`;
                if (!seenVotes.has(voteId)) {
                  seenVotes.add(voteId);
                  while (seenVotes.size > 500) seenVotes.delete(seenVotes.keys().next().value!);
                  const timestamp = String(Math.floor(Number(pollUpdate.senderTimestampMs ?? Date.now()) / 1000));
                  console.log(`[poll] decoded selection for ${pollId} from ${from} in ${Date.now() - t0}ms: ${chosenOption.id} ("${chosenOption.title}")`);
                  await toBot(from, m.pushName ?? null, [pollVote(from, voteId, pollId, chosenOption, timestamp)]);
                }
                continue;
              }
            }
          }
        }
      }

      // 2. Regular message
      const msg = toCloudMessage(m, from);
      if (!msg) continue;
      if (msg.type === 'image' || msg.type === 'video' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'text') keep(received, m, 300);
      await toBot(from, m.pushName, [msg]);
    }
  });

  // A tap on a poll option if emitted as a messages.update
  s.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
      const poll = key.id ? polls[key.id] : undefined;
      if (!update.pollUpdates?.length || !poll) continue;
      const votes = getAggregateVotesInPollMessage({ message: poll.message.message, pollUpdates: update.pollUpdates });
      const option = chosen(poll.options, votes);
      const vote = update.pollUpdates.at(-1)!;
      let from: string | null = null;
      if (key.remoteJid && isPersonChat(key.remoteJid)) {
        let phone: string | null = null;
        if (isLidUser(key.remoteJid)) phone = await s.signalRepository.lidMapping.getPNForLID(key.remoteJid).catch(() => null);
        from = addressOf(key.remoteJid, phone && phone.endsWith('@s.whatsapp.net') ? phone : null);
      }
      if (!from) from = await senderOf(s, { ...poll.message, key: { ...poll.message.key, fromMe: false } } as WAMessage);
      if (!option || !from) continue;
      const voteId = `poll.${key.id}.${vote.pollUpdateMessageKey?.id ?? vote.senderTimestampMs ?? Date.now()}`;
      await toBot(from, null, [pollVote(from, voteId, key.id!, option, String(Math.floor(Number(vote.senderTimestampMs ?? Date.now()) / 1000)))]);
    }
  });
}

/* ------------------------------------------------------------------ the bot's side: send, read, files */

const body = (req: IncomingMessage, max = 64_000) => new Promise<string | null>((done) => {
  let size = 0; const parts: Buffer[] = [];
  req.on('data', (c: Buffer) => { size += c.length; if (size > max) { req.destroy(); done(null); } else parts.push(c); });
  req.on('end', () => done(Buffer.concat(parts).toString('utf8')));
  req.on('error', () => done(null));
});
const reply = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://gateway');
  if (req.method === 'GET' && url.pathname === '/health') return reply(res, open ? 200 : 503, { connected: open });
  if (req.method === 'GET' && url.pathname === '/status') {                  // Admin → WhatsApp → Connection, through the bot
    if (!signed(url.pathname, req.headers['x-signature'] as string | undefined)) return reply(res, 401, { error: 'signature' });
    return reply(res, 200, { connected: open, me: open ? (sock?.user?.id ?? null) : null, since: open ? new Date(since).toISOString() : null,
      qr: !open && qrNow ? await QRCode.toDataURL(qrNow, { margin: 1, width: 320 }) : null });
  }
  if (req.method === 'POST' && url.pathname === '/admin') {                  // link by phone number, or unlink (owners, through the bot)
    const raw = await body(req, 2000);
    if (raw === null || !signed(raw, req.headers['x-hub-signature-256'] as string | undefined)) return reply(res, 401, { error: 'signature' });
    let a: { action?: string; phone?: string };
    try { a = JSON.parse(raw); } catch { return reply(res, 400, { error: 'json' }); }
    if (!sock) return reply(res, 503, { error: 'starting' });
    if (a.action === 'logout') { await sock.logout().catch(() => undefined); return reply(res, 200, { ok: true }); }   // a new QR follows
    if (a.action === 'pair') {                                               // "Link with phone number" (the admin page on the bot's own phone)
      const phone = String(a.phone ?? '').replace(/\D/g, '');
      if (open) return reply(res, 409, { error: 'already-linked' });
      if (!/^\d{10,15}$/.test(phone)) return reply(res, 400, { error: 'phone' });
      try { return reply(res, 200, { code: await sock.requestPairingCode(phone) }); } catch (e) { return reply(res, 502, { error: String(e).slice(0, 120) }); }
    }
    return reply(res, 400, { error: 'action' });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
    if (!signed(url.pathname, req.headers['x-signature'] as string | undefined)) return reply(res, 401, { error: 'signature' });
    const m = received.get(decodeURIComponent(url.pathname.slice(7)));
    if (!m || !sock) return reply(res, 404, { error: 'gone' });
    try {
      const bytes = await downloadMediaMessage(m, 'buffer', {}, { logger: log, reuploadRequest: sock.updateMediaMessage });
      const x = m.message ?? {};
      const type = (x.imageMessage ?? x.videoMessage ?? x.documentMessage ?? x.audioMessage ?? x.documentWithCaptionMessage?.message?.documentMessage)?.mimetype || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'content-length': String(bytes.length) });
      return res.end(bytes);
    } catch (e) { log.warn({ e: String(e) }, 'media download failed'); return reply(res, 502, { error: 'download' }); }
  }
  if (req.method !== 'POST' || url.pathname !== '/send') return reply(res, 404, { error: 'not-found' });
  const raw = await body(req);
  if (raw === null) return reply(res, 413, { error: 'too-large' });
  if (!signed(raw, req.headers['x-hub-signature-256'] as string | undefined)) return reply(res, 401, { error: 'signature' });
  if (!sock || !open) return reply(res, 503, { error: 'not-connected' });
  let payload: Record<string, any>;
  try { payload = JSON.parse(raw); } catch { return reply(res, 400, { error: 'json' }); }
  if (payload.status === 'read') {                           // a read receipt for a client's message
    const m = received.get(String(payload.message_id ?? ''));
    if (m) await sock.readMessages([m.key]).catch(() => undefined);
    return reply(res, 200, { success: true });
  }
  try {
    const id = await send(sock, payload);
    return id ? reply(res, 200, { messages: [{ id }] }) : reply(res, 400, { error: 'nothing-sent' });
  } catch (e) { log.warn({ e: String(e) }, 'send failed'); return reply(res, 502, { error: 'send' }); }
}).listen(PORT, () => console.log(`Gateway listening on :${PORT} (POST /send, POST /admin, GET /status, GET /media/<id>, GET /health).`));

/* ------------------------------------------------------------------ telling the bot where it is */

let address = FIXED;
/** POST /gateway on the bot, signed like the webhooks; again every 10 minutes (and after a new tunnel). */
async function register() {
  if (!address) return;
  const raw = JSON.stringify({ url: address, at: Date.now() });
  const r = await fetch(new URL('/gateway', BOT), { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(raw) }, body: raw, signal: AbortSignal.timeout(15_000) })
    .catch((e) => { log.warn({ e: String(e) }, 'the bot is not reachable'); return null; });
  if (r && !r.ok) console.error(`The bot refused this gateway's address (${r.status}): is WA_APP_SECRET the same on both?`);
}
/** The laptop: a Cloudflare quick tunnel (a new https://….trycloudflare.com each start), kept running. */
function tunnel() {
  const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const read = (chunk: Buffer) => {
    const url = tunnelUrl(chunk.toString());
    if (url && url !== address) { address = url; console.log(`Public address: ${url}`); register(); }
  };
  child.stdout.on('data', read); child.stderr.on('data', read);
  child.on('error', () => console.error('No public address: install cloudflared (winget install --id Cloudflare.cloudflared -e) or set PUBLIC_URL.'));
  child.on('exit', (code) => { if (code !== null) { console.error('The tunnel stopped; starting it again.'); setTimeout(tunnel, 5000); } });
}
if (address) register(); else if (env.TUNNEL !== '0') tunnel();
setInterval(register, 10 * 60_000);

if (!db) await mkdir(DATA, { recursive: true });
polls = pollStore ? await pollStore.load().catch(() => ({})) as Record<string, Poll>
  : JSON.parse(await readFile(pollFile, 'utf8').catch(() => '{}'), BufferJSON.reviver);
pollStore?.prune().catch(() => undefined);
await connect();
