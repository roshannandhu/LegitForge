/** The bot's outside calls, all plain fetch (no SDKs: the Worker stays tiny): WhatsApp Cloud
 *  API, Supabase's REST API (PostgREST), Groq and Gemini (both OpenAI-compatible chat), Gemini
 *  embeddings, and Meta's webhook signature. Every call has a timeout and none throws on an AI
 *  failure: the bot always has a fixed reply to fall back on. */

export interface Env {
  DB: D1Database;
  WA_ACCESS_TOKEN: string;
  WA_APP_SECRET: string;
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
  GRAPH_VERSION?: string;
  SITE_URL?: string;
}

const TIMEOUT = 8000;
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ---------------------------------------------------------------------------- Supabase */

/** One PostgREST call. `prefer` defaults to returning the touched rows. Throws on HTTP errors:
 *  the caller decides (the webhook answers 500 so Meta retries). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sb<T = any>(env: Env, method: string, path: string, body?: unknown, prefer = 'return=representation'): Promise<T[]> {
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method,
    headers: { apikey: env.SUPABASE_SECRET_KEY, accept: 'application/json', 'content-type': 'application/json', prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw Object.assign(new Error(`supabase ${method} ${path.split('?')[0]}: ${r.status}`), { status: r.status });
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}
export const q = encodeURIComponent;
/** A pgvector value as PostgREST takes it. */
export const vec = (v: number[]) => `[${v.join(',')}]`;

/* ---------------------------------------------------------------------------- WhatsApp */

/** Sends one message; returns its id, or null when Meta refused it (logged, never thrown). */
async function wa(env: Env, payload: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch(`https://graph.facebook.com/${env.GRAPH_VERSION || 'v25.0'}/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.WA_ACCESS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) { console.error('[wa] send refused', r.status, (await r.text()).slice(0, 300)); return null; }
    return ((await r.json()) as { messages?: { id: string }[] }).messages?.[0]?.id ?? null;
  } catch (e) { console.error('[wa] send failed', String(e).slice(0, 200)); return null; }
}

export const sendText = (env: Env, to: string, body: string) =>
  wa(env, { to, type: 'text', text: { body: clip(body, 4096), preview_url: false } });

export interface Row { id: string; title: string; description?: string }
export const sendList = (env: Env, to: string, body: string, button: string, rows: Row[], footer?: string) =>
  wa(env, { to, type: 'interactive', interactive: {
    type: 'list', body: { text: clip(body, 4096) }, ...(footer ? { footer: { text: clip(footer, 60) } } : {}),
    action: { button, sections: [{ rows }] },
  } });

export const sendButtons = (env: Env, to: string, body: string, buttons: { id: string; title: string }[]) =>
  wa(env, { to, type: 'interactive', interactive: {
    type: 'button', body: { text: clip(body, 1024) },
    action: { buttons: buttons.map((b) => ({ type: 'reply', reply: b })) },
  } });

/** An approved template (needed outside the 24-hour window). Parameters may not hold new lines. */
export const sendTemplate = (env: Env, to: string, name: string, params: string[]) =>
  wa(env, { to, type: 'template', template: {
    name, language: { code: 'en' },
    components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clip(p.replace(/\s+/g, ' ').trim(), 900) })) }],
  } });

/** Blue ticks plus "typing…" while the reply is worked out (Meta clears it when we reply). */
export function markRead(env: Env, messageId: string) {
  return fetch(`https://graph.facebook.com/${env.GRAPH_VERSION || 'v25.0'}/${env.WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WA_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).then(() => undefined, () => undefined);
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

/** Phone numbers and emails never reach an AI provider (Gemini's free tier may keep prompts). */
export const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
  .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 8 ? '[number]' : m));

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
export async function chat<T>(env: Env, o: { system: string; user: string; schema: Schema & object; name: string; prefer: Provider[] }): Promise<T | null> {
  for (const p of o.prefer) {
    const key = p === 'groq' ? env.GROQ_API_KEY : env.GEMINI_API_KEY;
    if (!key) continue;
    const url = p === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const model = p === 'groq' ? env.GROQ_MODEL || 'openai/gpt-oss-20b' : env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
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
export async function embed(env: Env, text: string): Promise<number[] | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.EMBED_MODEL || 'gemini-embedding-001'}:embedContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: redact(text) }] }, outputDimensionality: 768 }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) { console.warn('[ai] embed', r.status); return null; }
    const v = ((await r.json()) as { embedding?: { values?: number[] } }).embedding?.values;
    return Array.isArray(v) && v.length === 768 ? v : null;
  } catch (e) { console.warn('[ai] embed failed', String(e).slice(0, 200)); return null; }
}
