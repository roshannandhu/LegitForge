/** The bot's outside calls, all plain fetch (no SDKs: the Worker stays tiny): WhatsApp Cloud
 *  API, Supabase's REST API (PostgREST), Groq and Gemini (both OpenAI-compatible chat), Gemini
 *  embeddings, and Meta's webhook signature. Every call has a timeout and none throws on an AI
 *  failure: the bot always has a fixed reply to fall back on. */

import { metaSend, shown } from './channels';
import { decryptApiKey } from '../lib/ai/crypto';
import type { AiKeyRecord } from '../lib/ai/types';
import { executeAiCompletion } from '../lib/ai/adapters';

export interface Env {
  DB: D1Database;
  /** The website's R2 bucket: files clients send go under leads/<lead id>/ (private; only
   *  Admin → Leads serves them). Without it, files get "please type". */
  MEDIA?: R2Bucket;
  WA_ACCESS_TOKEN: string;
  WA_APP_SECRET: string;
  AI_ENCRYPTION_KEY?: string;
  WA_VERIFY_TOKEN: string;
  WA_PHONE_NUMBER_ID: string;
  /** Team members' WhatsApp numbers (digits, e.g. 919876543210), comma-separated. */
  TEAM_WHATSAPP: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_MODEL?: string;
  GEMINI_MODEL?: string;
  EMBED_MODEL?: string;
  WHISPER_MODEL?: string;
  /** Calls on the team's Google Calendar (bot/calendar.ts): the owner's OAuth client, its refresh
   *  token (calendar scope) and the calendar (legitforge@gmail.com). Unset: the team arranges calls. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  CALENDAR_ID?: string;
  /** Sales (phase 5, bot/pay.ts and worker.ts): Razorpay keys for payment links (else the UPI ID
   *  is given in words), the Google review link, and the approved marketing template that revives
   *  leads after 30 quiet days (empty = off: each one costs money). */
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  UPI_ID?: string;
  GOOGLE_REVIEW_URL?: string;
  REVIVE_TEMPLATE?: string;
  /** "baileys": WhatsApp through the WhatsApp Web gateway (web/gateway) at BAILEYS_URL, signed
   *  with WA_APP_SECRET; anything else (the default): Meta's Cloud API. */
  WA_TRANSPORT?: string;
  BAILEYS_URL?: string;
  /** AI requests a day in all (chat, embeddings, voice notes); past it, the fixed text and the team. Default 1500. */
  AI_DAILY_CAP?: string;
  /** More channels (phase 7, bot/channels.ts): the Facebook Page's access token (Messenger and
   *  Instagram replies), the Page id and the Instagram account id (only their messages are read). */
  FB_PAGE_TOKEN?: string;
  FB_PAGE_ID?: string;
  IG_ACCOUNT_ID?: string;
  GRAPH_VERSION?: string;
  /** Days after the first client during which every AI answer is a draft for the team (default 14; 0 = off). */
  TRAINING_DAYS?: string;
  SITE_URL?: string;
  /** Per invocation (never a binding): outside calls made so far, and when it started. Workers
   *  Free allows 50 subrequests per invocation (D1 calls count too), so turns stop early. */
  run?: {
    calls: number; t0: number; open?: Set<string>; roster?: unknown[]; settings?: Record<string, string>;
    /** What went out this run, stored in one write at its end (worker.ts flushOut). */
    out?: { wamid: string; to: string; body: string; at: number; options?: { id: string; title: string }[]; team?: boolean }[];
    /** Clients erased this run: nothing of theirs is stored afterwards. */
    gone?: Set<string>;
    /** The day's AI requests (aiAllowed): read once a run, the rest added at its end (flushAi). */
    ai?: { key: string; used: number; extra: number };
    refused?: boolean;
    phrases?: { lang: string; phrase: string; meaning: string }[];
  };
}

/** One more outside call for this invocation's budget. */
export const count = (env: Env) => { if (env.run) env.run.calls++; };
/** Room for `n` more calls (and time) in this invocation? */
export const room = (env: Env, n: number) => !env.run || (env.run.calls + n <= 48 && Date.now() - env.run.t0 < 18_000);

/** Now (tests move it). */
export const clock = { now: () => Date.now() };

const TIMEOUT = 8000;
const graph = (env: Env) => `https://graph.facebook.com/${env.GRAPH_VERSION || 'v25.0'}`;

/** WhatsApp through the WhatsApp Web (Baileys) gateway instead of Meta's Cloud API (web/gateway). */
export const viaGateway = (env: Env) => env.WA_TRANSPORT === 'baileys';
/** Where the gateway is: the BAILEYS_URL secret, else the address it registered itself (POST
 *  /gateway, worker.ts hello: on Render, or the laptop's fresh tunnel), re-read once a minute. */
let registered: { url: string | null; at: number } | null = null;
export async function gatewayBase(env: Env): Promise<string | null> {
  if (env.BAILEYS_URL) return env.BAILEYS_URL.replace(/\/+$/, '');
  if (!registered || clock.now() - registered.at > 60_000) {
    const row = await env.DB?.prepare("SELECT value FROM bot_settings WHERE key = 'gateway_url'").first<{ value: string }>().catch(() => null);
    registered = { url: row?.value || null, at: clock.now() };
  }
  return registered.url;
}
/** After the gateway registers a new address (and between tests). */
export const forgetGateway = () => { registered = null; };
async function gatewayUrl(env: Env, path: string) {
  const base = await gatewayBase(env);
  if (!base) throw new Error('the gateway has not registered its address yet');
  return `${base}${path}`;
}
/** `sha256=<hex>`, the gateway checks it as the bot checks Meta's (same secret both ways). */
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  return `sha256=${[...sig].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
/** The gateway's own pages for Admin → WhatsApp → Connection (status and QR, link by phone number,
 *  log out), signed like everything else between the bot and the gateway. */
export async function gatewayCall(env: Env, method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const sig = await hmac(env.WA_APP_SECRET, raw ?? path);
  const r = await fetch(await gatewayUrl(env, path), { method, body: raw, signal: AbortSignal.timeout(TIMEOUT),
    headers: raw ? { 'content-type': 'application/json', 'x-hub-signature-256': sig } : { 'x-signature': sig } });
  return { status: r.status, data: await r.json().catch(() => ({})) as Record<string, unknown> };
}

/** A WhatsApp send (or read receipt): the Cloud API, or the gateway with the same body, signed. */
async function waPost(env: Env, body: string) {
  return viaGateway(env)
    ? fetch(await gatewayUrl(env, '/send'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': await hmac(env.WA_APP_SECRET, body) }, body, signal: AbortSignal.timeout(TIMEOUT) })
    : fetch(`${graph(env)}/${env.WA_PHONE_NUMBER_ID}/messages`, { method: 'POST', headers: { authorization: `Bearer ${env.WA_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(TIMEOUT) });
}
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ---------------------------------------------------------------------------- Supabase */

/** One PostgREST call. `prefer` defaults to returning the touched rows. Throws on HTTP errors:
 *  the caller decides (the webhook answers 500 so Meta retries). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sb<T = any>(env: Env, method: string, path: string, body?: unknown, prefer = 'return=representation'): Promise<T[]> {
  count(env);
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method,
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, accept: 'application/json', 'content-type': 'application/json', prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw Object.assign(new Error(`supabase ${method} ${path.split('?')[0]}: ${r.status}`), { status: r.status });
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}
export const q = encodeURIComponent;

/** How many rows match (PostgREST's exact count, not capped by its 1,000-row page). */
export async function sbCount(env: Env, path: string): Promise<number> {
  count(env);
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}${path.includes('?') ? '&' : '?'}select=*&limit=1`, {
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, prefer: 'count=exact' }, signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw Object.assign(new Error(`supabase count ${path.split('?')[0]}: ${r.status}`), { status: r.status });
  return Number(r.headers.get('content-range')?.split('/')[1]) || 0;
}
/** A pgvector value as PostgREST takes it. */
export const vec = (v: number[]) => `[${v.join(',')}]`;

/* ---------------------------------------------------------------------------- WhatsApp */

/** Sends one message; returns its id, or null when Meta refused it (logged, never thrown). */
async function wa(env: Env, { to, ...payload }: { to: string } & Record<string, unknown>): Promise<string | null> {
  if (/^(web|fb|ig):/.test(to)) {
    // The other channels (phase 7): the website chat is stored for the bubble to read (no
    // templates: it has no 24-hour window to open); Messenger and Instagram go through Meta.
    const id = to.startsWith('web:') ? (payload.type === 'template' ? null : `web.out.${crypto.randomUUID()}`) : await metaSend(env, to, payload);
    if (id) env.run?.out?.push({ wamid: id, to, at: clock.now(), ...shown(payload) });
    return id;
  }
  count(env);
  try {
    // a phone number goes in `to`; a business-scoped user id (clients with a username) or a WhatsApp Web LID in `recipient`
    const r = await waPost(env, JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...(/^\d+$/.test(to) ? { to } : { recipient: to }), ...payload }));
    if (env.run) env.run.refused = !r.ok;                     // refused, not merely slow: orNumbered may send the numbers
    if (!r.ok) { console.error('[wa] send refused', r.status, (await r.text()).slice(0, 300)); return null; }
    const id = ((await r.json()) as { messages?: { id: string }[] }).messages?.[0]?.id ?? null;
    if (id) env.run?.out?.push({ wamid: id, to, at: clock.now(), ...shown(payload) });
    return id;
  } catch (e) { console.error('[wa] send failed', String(e).slice(0, 200)); return null; }
}

export const sendText = (env: Env, to: string, body: string) =>
  wa(env, { to, type: 'text', text: { body: clip(body, 4096), preview_url: false } });
/** A team member's reply on Messenger or Instagram after their 24 hours (Meta allows a person 7 days). */
export const sendHumanText = (env: Env, to: string, body: string) =>
  wa(env, { to, type: 'text', text: { body: clip(body, 4096), preview_url: false }, tag: 'HUMAN_AGENT' });

export interface Row { id: string; title: string; description?: string }
/** A list or buttons Meta refused on WhatsApp: the same choices as numbered text, and a typed
 *  number answers it like a tap (worker.ts optionFor). */
async function orNumbered(env: Env, to: string, id: string | null, body: string, options: { id: string; title: string }[]) {
  // only when Meta refused it: a timeout may still have delivered the buttons (never both)
  if (id || /^(web|fb|ig):/.test(to) || env.run?.refused === false) return id;
  // one option (Skip) is in the question's own words already: typing it answers it
  const alt = await sendText(env, to, options.length > 1 ? `${body}\n\n${options.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}` : body);
  const sent = env.run?.out?.find((o) => o.wamid === alt);
  if (sent) sent.options = options;
  return alt;
}

export const sendList = async (env: Env, to: string, body: string, button: string, rows: Row[], footer?: string) =>
  orNumbered(env, to, await wa(env, { to, type: 'interactive', interactive: {
    type: 'list', body: { text: clip(body, 4096) }, ...(footer ? { footer: { text: clip(footer, 60) } } : {}),
    action: { button, sections: [{ title: clip(button, 24), rows }] },
  } }), body, rows.map((r) => ({ id: r.id, title: r.title })));

export const sendButtons = async (env: Env, to: string, body: string, buttons: { id: string; title: string }[]) =>
  orNumbered(env, to, await wa(env, { to, type: 'interactive', interactive: {
    type: 'button', body: { text: clip(body, 1024) },
    action: { buttons: buttons.map((b) => ({ type: 'reply', reply: b })) },
  } }), body, buttons);

/** An approved template (needed outside the 24-hour window). Parameters may not hold new lines. */
export const sendTemplate = (env: Env, to: string, name: string, params: string[]) =>
  wa(env, { to, type: 'template', template: {
    name, language: { code: 'en' },
    components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clip(p.replace(/\s+/g, ' ').trim(), 900) })) }],
  } });

/** Blue ticks plus "typing…" while the reply is worked out (Meta clears it when we reply). */
export function markRead(env: Env, messageId: string) {
  count(env);
  return waPost(env, JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }))
    .then(() => undefined, () => undefined);
}

/** Meta signs every webhook POST: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body, app secret). */
export async function validSignature(secret: string, raw: ArrayBuffer, header: string | null) {
  const hex = /^sha256=([0-9a-f]{64})$/i.exec(header ?? '')?.[1];
  if (!hex) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sig, raw);
}

/* ---------------------------------------------------------------------------------- AI */

/** Phone numbers and emails never reach an AI provider (Gemini's free tier may keep prompts).
 *  Any script's digits (९८७६…, ൯൮…), split by spaces, dots, dashes, slashes or commas. */
export const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
  .replace(/\+?\p{Nd}[\p{Nd}\s().\/,-]{6,}\p{Nd}/gu, (m) => (m.replace(/\P{Nd}/gu, '').length >= 8 ? '[number]' : m));

export type Provider = 'groq' | 'gemini';
type Schema = { required: string[]; properties: Record<string, { type: string; enum?: readonly string[] }> };

function valid(out: unknown, schema: Schema): boolean {
  if (!out || typeof out !== 'object') return false;
  const o = out as Record<string, unknown>;
  return schema.required.every((k) => {
    const p = schema.properties[k];
    return typeof o[k] === p.type && (!p.enum || p.enum.includes(o[k] as string));
  });
}

/** One JSON answer from the first provider that gives a valid one, else null. Both speak the
 *  OpenAI chat format; model names are Worker vars, so a model change needs no code change. */
/** The day's AI requests in all (D1 bot_limits `ai:<day>`): past AI_DAILY_CAP (default 1500)
 *  the bot uses its fixed text and the team, as when an AI is busy, and never another provider.
 *  One D1 write a run; the rest are counted here and added when the run ends (flushAi). */
async function aiAllowed(env: Env, team = false): Promise<boolean> {
  const cap = Number(env.AI_DAILY_CAP || 1500), run = env.run;
  if (!env.DB) return true;                                  // bot/seed.ts: no D1, no cap
  if (run?.ai) { run.ai.extra++; return team || run.ai.used + run.ai.extra <= cap; }
  const key = `ai:${new Date(clock.now()).toISOString().slice(0, 10)}`;
  count(env);
  const row = await env.DB.prepare('INSERT INTO bot_limits (key, n, at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(key, clock.now()).first<{ n: number }>().catch(() => null);
  const used = row?.n ?? 0;                                  // D1 unreachable: no cap rather than no AI
  if (run) run.ai = { key, used, extra: 0 };
  if (used > cap && !team) console.error('[ai] the daily AI cap (AI_DAILY_CAP) is reached: fixed text until tomorrow');
  return team || used <= cap;                                // the team's and admin's saves are counted, never blocked
}
/** The run's other AI requests, added to the day's count (worker.ts flushOut). */
export async function flushAi(env: Env) {
  const a = env.run?.ai;
  if (!a?.extra) return;
  const extra = a.extra;
  a.extra = 0;
  await env.DB.prepare('UPDATE bot_limits SET n = n + ? WHERE key = ?').bind(extra, a.key).run().catch(() => {});
}

export async function chat<T>(env: Env, o: { system: string; user: string; schema: Schema & object; name: string; prefer: Provider[] }): Promise<T | null> {
  if (!(await aiAllowed(env))) return null;

  // 1. Try active keys from D1 ai_keys vault with automatic failover
  if (env.DB) {
    try {
      const records = (await env.DB.prepare(
        `SELECT * FROM ai_keys 
         WHERE is_active = 1 
           AND (cooldown_until IS NULL OR datetime(cooldown_until) <= datetime('now'))
         ORDER BY sort_order ASC, created_at ASC`
      ).all<AiKeyRecord>().catch(() => ({ results: [] }))).results || [];

      if (records.length > 0) {
        // Order keys by preference: preferred providers first, then others
        const sortedKeys = [...records].sort((a, b) => {
          const aPref = o.prefer.indexOf(a.provider as Provider);
          const bPref = o.prefer.indexOf(b.provider as Provider);
          const aRank = aPref === -1 ? 99 : aPref;
          const bRank = bPref === -1 ? 99 : bPref;
          if (aRank !== bRank) return aRank - bRank;
          return a.sort_order - b.sort_order;
        });

        for (const keyRecord of sortedKeys) {
          let secretKey: string;
          try {
            secretKey = decryptApiKey(keyRecord.api_key_encrypted, keyRecord.key_nonce, env.AI_ENCRYPTION_KEY || env.WA_APP_SECRET);
          } catch (e) {
            console.warn(`[ai] failed to decrypt key ${keyRecord.name}`, e);
            continue;
          }

          count(env);
          const res = await executeAiCompletion(keyRecord, secretKey, {
            system: o.system,
            user: redact(o.user),
            schema: o.schema,
            name: o.name,
            timeoutMs: TIMEOUT,
          });

          if (res.ok && res.content) {
            try {
              const out = JSON.parse(res.content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
              if (valid(out, o.schema)) {
                await env.DB.prepare("UPDATE ai_keys SET last_used_at = datetime('now'), status = 'healthy' WHERE id = ?").bind(keyRecord.id).run().catch(() => {});
                return out as T;
              }
            } catch {
              console.warn(`[ai] ${keyRecord.provider} (${keyRecord.name}) returned invalid JSON shape`);
            }
          }

          // Mark rate limit or error in background and failover immediately
          if (res.status === 'rate_limited') {
            const cooldown = new Date(Date.now() + (res.retryAfterSec || 60) * 1000).toISOString();
            await env.DB.prepare("UPDATE ai_keys SET status = 'rate_limited', cooldown_until = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?")
              .bind(cooldown, res.error || 'Rate limit', keyRecord.id).run().catch(() => {});
            console.warn(`[ai] ${keyRecord.provider} (${keyRecord.name}) rate limited; failing over to next key...`);
          } else if (res.status === 'invalid') {
            await env.DB.prepare("UPDATE ai_keys SET status = 'invalid', last_error = ?, updated_at = datetime('now') WHERE id = ?")
              .bind(res.error || 'Invalid key', keyRecord.id).run().catch(() => {});
            console.warn(`[ai] ${keyRecord.provider} (${keyRecord.name}) credentials invalid; failing over...`);
          } else {
            console.warn(`[ai] ${keyRecord.provider} (${keyRecord.name}) failed: ${res.error}; failing over...`);
          }
        }
      }
    } catch (e) {
      console.warn('[ai] error reading ai_keys from D1', e);
    }
  }

  // 2. Fall back to Worker environment variables if no D1 keys or all failed
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return null;
  for (const p of o.prefer) {
    const key = p === 'groq' ? env.GROQ_API_KEY : env.GEMINI_API_KEY;
    if (!key) continue;
    const url = p === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const model = p === 'groq' ? env.GROQ_MODEL || 'openai/gpt-oss-20b' : env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    count(env);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: o.system }, { role: 'user', content: redact(o.user) }],
          response_format: { type: 'json_schema', json_schema: { name: o.name, strict: true, schema: o.schema } },
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!r.ok) { console.warn(`[ai] ${p} ${r.status}`); continue; }
      const content = ((await r.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
      const out = typeof content === 'string' ? JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')) : null;
      if (valid(out, o.schema)) return out as T;
      console.warn(`[ai] ${p} returned an invalid shape`);
    } catch (e) { console.warn(`[ai] ${p} failed`, String(e).slice(0, 200)); }
  }
  return null;
}

/** 768 numbers for the knowledge base (Gemini embeddings), or null. */
export async function embed(env: Env, text: string, team = false): Promise<number[] | null> {
  let geminiKey = env.GEMINI_API_KEY;
  if (!geminiKey && env.DB) {
    const k = await env.DB.prepare("SELECT api_key_encrypted, key_nonce FROM ai_keys WHERE provider = 'gemini' AND is_active = 1 AND (cooldown_until IS NULL OR datetime(cooldown_until) <= datetime('now')) ORDER BY sort_order ASC LIMIT 1").first<{ api_key_encrypted: string; key_nonce: string }>().catch(() => null);
    if (k) {
      try { geminiKey = decryptApiKey(k.api_key_encrypted, k.key_nonce, env.AI_ENCRYPTION_KEY || env.WA_APP_SECRET); } catch {}
    }
  }
  if (!geminiKey || !(await aiAllowed(env, team))) return null;
  count(env);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.EMBED_MODEL || 'gemini-embedding-001'}:embedContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: redact(text) }] }, outputDimensionality: 768 }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) { console.warn('[ai] embed', r.status); return null; }
    const v = ((await r.json()) as { embedding?: { values?: number[] } }).embedding?.values;
    return Array.isArray(v) && v.length === 768 ? v : null;
  } catch (e) { console.warn('[ai] embed failed', String(e).slice(0, 200)); return null; }
}

/* ------------------------------------------------------------------------------- media */

/** A file a client sent: WhatsApp media id → its bytes and type (two calls: the media's
 *  address, then the download, both with the access token, which only goes to Meta's own
 *  hosts). 'big' over `max` bytes (or no size given); null when it is gone or refused; 'retry'
 *  when Meta is busy or slow (5xx, 429, a timeout). */
export async function media(env: Env, id: string, max: number): Promise<{ bytes: ArrayBuffer; type: string } | 'big' | 'retry' | null> {
  const auth = { authorization: `Bearer ${env.WA_ACCESS_TOKEN}` };
  const passing = (status: number) => status === 429 || status >= 500;
  if (viaGateway(env)) {                                    // the gateway still holds the message: it downloads the file
    try {
      count(env);
      const path = `/media/${encodeURIComponent(id)}`;
      const r = await fetch(await gatewayUrl(env, path), { headers: { 'x-signature': await hmac(env.WA_APP_SECRET, path) }, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) return passing(r.status) ? 'retry' : null;
      if (Number(r.headers.get('content-length') ?? 0) > max) return 'big';
      const bytes = await r.arrayBuffer();
      return bytes.byteLength > max ? 'big' : { bytes, type: r.headers.get('content-type') || 'application/octet-stream' };
    } catch (e) { console.error('[wa] gateway media failed', String(e).slice(0, 200)); return 'retry'; }
  }
  try {
    count(env);
    const meta = await fetch(`${graph(env)}/${encodeURIComponent(id)}`, { headers: auth, signal: AbortSignal.timeout(TIMEOUT) });
    if (!meta.ok) { console.error('[wa] media lookup refused', meta.status); return passing(meta.status) ? 'retry' : null; }
    const m = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!m.url || !/^https:\/\/([\w-]+\.)*(fbsbx|facebook|whatsapp)\.(com|net)\//.test(m.url)) return null;
    if (!(Number(m.file_size) <= max)) return 'big';
    count(env);
    const r = await fetch(m.url, { headers: auth, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) { console.error('[wa] media download refused', r.status); return passing(r.status) ? 'retry' : null; }
    const type = m.mime_type || r.headers.get('content-type') || 'application/octet-stream';
    if (/^text\/html/i.test(r.headers.get('content-type') ?? '')) return null;   // an error page, not their file
    const bytes = await r.arrayBuffer();
    return bytes.byteLength > max ? 'big' : { bytes, type };
  } catch (e) { console.error('[wa] media failed', String(e).slice(0, 200)); return 'retry'; }
}

/** A voice note as text (Groq Whisper; Groq keeps no audio). `lang` is a hint (ISO 639-1). */
export async function transcribe(env: Env, audio: ArrayBuffer, type: string, lang?: string): Promise<string | null> {
  let groqKey = env.GROQ_API_KEY;
  if (!groqKey && env.DB) {
    const k = await env.DB.prepare("SELECT api_key_encrypted, key_nonce FROM ai_keys WHERE provider = 'groq' AND is_active = 1 AND (cooldown_until IS NULL OR datetime(cooldown_until) <= datetime('now')) ORDER BY sort_order ASC LIMIT 1").first<{ api_key_encrypted: string; key_nonce: string }>().catch(() => null);
    if (k) {
      try { groqKey = decryptApiKey(k.api_key_encrypted, k.key_nonce, env.AI_ENCRYPTION_KEY || env.WA_APP_SECRET); } catch {}
    }
  }
  if (!groqKey || !(await aiAllowed(env))) return null;
  const form = new FormData();
  form.append('file', new Blob([audio], { type }), type.includes('mpeg') ? 'voice.mp3' : 'voice.ogg');
  form.append('model', env.WHISPER_MODEL || 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  if (lang) form.append('language', lang);
  count(env);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form, signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) { console.warn('[ai] transcription', r.status); return null; }
    return ((await r.json()) as { text?: string }).text?.trim() || null;
  } catch (e) { console.warn('[ai] transcription failed', String(e).slice(0, 200)); return null; }
}
