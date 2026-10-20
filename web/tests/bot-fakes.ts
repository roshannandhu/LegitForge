import { toBaileys } from '../gateway/convert';

/** Fakes for tests/bot.test.ts: the outside services the WhatsApp bot calls, behind one
 *  globalThis.fetch. Not a *.test.ts file, so the test runner only loads it through the test.
 *  - Supabase: a small PostgREST (the filters, upserts and RPC the bot uses), in memory.
 *  - WhatsApp Graph API: records every send; ids come back as wamid.out.N.
 *  - Groq / Gemini chat: a test-supplied responder per task (extract, answer, translate, faq).
 *  - Gemini embeddings: words hashed into 768 numbers, so the same text matches itself.
 *  - WhatsApp media (state.media) and Groq Whisper (state.voice) for voice notes and files. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const KEY: Record<string, string> = { contacts: 'wa_id', messages: 'wamid', questions: 'id', knowledge: 'id', settings: 'key', alerts: 'id', calls: 'id' };
const UNIQUE: Record<string, string[]> = { contacts: ['code'], questions: ['wamid'], calls: ['start_at'] };
/** The schema's CHECK constraints (bot/supabase/schema.sql), so a value Postgres would refuse fails here too. */
const CHECK: Record<string, Record<string, string[]>> = {
  contacts: { step: ['start', 'returning', 'service', 'language', 'name', 'business', 'need', 'details', 'refs', 'timeline', 'contact', 'done'], mode: ['bot', 'human', 'stopped', 'blocked'], lang: ['en', 'ml', 'mg', 'hi', 'hg', 'kn', 'kg', 'ta', 'tg'] },
  messages: { dir: ['in', 'out'] },
  questions: { status: ['pending', 'answered'], kind: ['question', 'draft', 'decision', 'price', 'auto'] },
  knowledge: { status: ['pending', 'approved', 'rejected', 'superseded', 'archived'], source: ['site', 'team'] },
};
const broken = (table: string, row: Row) =>
  Object.entries(CHECK[table] ?? {}).find(([col, ok]) => row[col] != null && !ok.includes(row[col]))?.[0];

export function fakeSupabase(now: () => number) {
  const tables: Record<string, Row[]> = { contacts: [], messages: [], questions: [], knowledge: [], settings: [], alerts: [], calls: [] };
  let seq = 0;
  const state = { down: false };

  const split = (s: string) => {                       // top-level commas, quotes respected
    const out: string[] = []; let cur = '', quoted = false;
    for (const ch of s) {
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cmp = (a: unknown, b: string) => {
    const x = typeof a === 'number' ? a : Number.isFinite(Number(a)) && a !== '' && /^-?\d+(\.\d+)?$/.test(String(a)) ? Number(a) : String(a);
    const y = typeof x === 'number' ? Number(b) : b;
    return x < y ? -1 : x > y ? 1 : 0;
  };
  function test(row: Row, col: string, cond: string): boolean {
    if (cond.startsWith('not.')) return !test(row, col, cond.slice(4));
    const dot = cond.indexOf('.'), op = cond.slice(0, dot), val = cond.slice(dot + 1), v = row[col];
    switch (op) {
      case 'eq': return v != null && String(v) === val;
      case 'neq': return v == null || String(v) !== val;
      case 'is': return val === 'null' ? v == null : String(v) === val;
      case 'lt': return v != null && cmp(v, val) < 0;
      case 'gt': return v != null && cmp(v, val) > 0;
      case 'lte': return v != null && cmp(v, val) <= 0;
      case 'gte': return v != null && cmp(v, val) >= 0;
      case 'in': return v != null && split(val.replace(/^\(|\)$/g, '')).includes(String(v));
      case 'like': return v != null && (val.endsWith('*') ? String(v).startsWith(val.slice(0, -1)) : String(v) === val);   // prefixes only
      case 'cs': { const want = JSON.parse(val) as unknown[]; return Array.isArray(v) && want.every((x) => v.includes(x)); }
      default: throw new Error(`fake PostgREST: unsupported operator ${op}`);
    }
  }
  function filtered(table: string, params: URLSearchParams) {
    const rows = tables[table];
    if (!rows) throw new Error(`fake PostgREST: no table ${table}`);
    return rows.filter((row) => [...params].every(([k, v]) => {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) return true;
      if (k === 'or') return split(v.replace(/^\(|\)$/g, '')).some((part) => {
        const d = part.indexOf('.');
        return test(row, part.slice(0, d), part.slice(d + 1));
      });
      if (k.includes('->')) { const [col, key] = k.split('->'); return test({ [k]: row[col]?.[key] }, k, v); }   // a jsonb field
      return test(row, k, v);
    }));
  }
  const project = (rows: Row[], params: URLSearchParams) => {
    const sel = params.get('select');
    return structuredClone(sel && sel !== '*' ? rows.map((r) => Object.fromEntries(sel.split(',').map((c) => [c, r[c]]))) : rows);
  };
  function defaults(table: string, row: Row): Row {
    const t = new Date(now()).toISOString();
    if (table === 'questions') return { status: 'pending', kind: 'question', draft: null, draft_en: null, answer: null, answered_by: null, answered_at: null, client_told_at: null, created_at: t, ...row, id: row.id ?? ++seq };
    if (table === 'knowledge') return { embedding: null, status: 'pending', question_id: null, decided_by: null, decided_at: null, translations: {}, translations_ok: false, wins: 0, created_at: t, ...row, id: row.id ?? ++seq };
    if (table === 'contacts') return { won_counted: false, created_at: t, ...row };
    if (table === 'calls') return { event_id: null, meet: null, reminded: false, created_at: t, ...row, id: row.id ?? ++seq };
    if (table === 'alerts') return { wa_id: null, lead_id: null, question_id: null, buttons: null, later: [], next_at: null, link: {}, created_at: t, ...row, id: row.id ?? ++seq };
    return { created_at: t, ...row };
  }
  const json = (status: number, body?: unknown) => new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function handle(url: URL, init: RequestInit) {
    if (state.down) return json(503, { message: 'down' });
    const path = url.pathname.replace(/^\/rest\/v1\//, ''), method = init.method ?? 'GET';
    const prefer = String((init.headers as Record<string, string>)?.prefer ?? '');
    const back = (rows: Row[]) => (prefer.includes('return=minimal') ? json(201) : json(200, structuredClone(rows)));
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (path === 'rpc/match_knowledge') {
      const qv = JSON.parse(body.query_embedding) as number[];
      return json(200, tables.knowledge
        .filter((k) => k.status === 'approved' && k.embedding && (!k.review_at || Date.parse(k.review_at) > Date.now()))
        .map((k) => ({ id: k.id, question_en: k.question_en, answer_en: k.answer_en, translations: k.translations ?? {}, translations_ok: !!k.translations_ok, wins: k.wins ?? 0, similarity: cosine(qv, JSON.parse(k.embedding)) }))
        .filter((k) => k.similarity > body.match_threshold)
        .sort((a, b) => b.similarity - a.similarity).slice(0, body.match_count));
    }
    const table = path, params = url.searchParams;
    if (method === 'GET') {
      let rows = filtered(table, params);
      if (prefer.includes('count=exact')) {                         // sbCount: the total in Content-Range
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': `0-0/${rows.length}` } });
      }
      const order = params.get('order');
      if (order) {
        const keys = order.split(',').map((o) => o.split('.'));
        rows = [...rows].sort((a, b) => {
          for (const [col, dir] of keys) { const c = cmp(a[col], String(b[col])); if (c) return dir === 'desc' ? -c : c; }
          return 0;
        });
      }
      const limit = params.get('limit');
      return json(200, project(limit ? rows.slice(0, Number(limit)) : rows, params));
    }
    if (method === 'POST') {
      const list: Row[] = (Array.isArray(body) ? body : [body]).map((r) => defaults(table, r));
      const key = params.get('on_conflict') ?? KEY[table];
      const made: Row[] = [];
      for (const row of list) {
        const bad = broken(table, row);
        if (bad) return json(400, { code: '23514', message: `check ${bad}` });
        if (table === 'questions' && !tables.contacts.some((c) => c.wa_id === row.wa_id)) return json(409, { code: '23503', message: 'no contact' });
        const existing = tables[table].find((r) => r[key] === row[key] && row[key] != null);
        if (existing) {
          if (prefer.includes('ignore-duplicates')) continue;
          if (prefer.includes('merge-duplicates')) { Object.assign(existing, row); made.push(existing); continue; }
          return json(409, { code: '23505', message: `duplicate ${key}` });
        }
        for (const u of UNIQUE[table] ?? []) if (row[u] != null && tables[table].some((r) => r[u] === row[u])) return json(409, { code: '23505', message: `duplicate ${u}` });
        tables[table].push(row);
        made.push(row);
      }
      return back(made);
    }
    if (method === 'PATCH') {
      const rows = filtered(table, params);
      const bad = broken(table, body);
      if (bad) return json(400, { code: '23514', message: `check ${bad}` });
      for (const r of rows) Object.assign(r, structuredClone(body));
      return back(rows);
    }
    if (method === 'DELETE') {
      const gone = new Set(filtered(table, params));
      tables[table] = tables[table].filter((r) => !gone.has(r));
      if (table === 'contacts') {                       // on delete cascade, as in the schema
        const ids = new Set([...gone].map((c) => c.wa_id));
        tables.questions = tables.questions.filter((x) => !ids.has(x.wa_id));
        tables.alerts = tables.alerts.filter((x) => !ids.has(x.wa_id));
        tables.calls = tables.calls.filter((x) => !ids.has(x.wa_id));
      }
      if (table === 'contacts' || table === 'questions') {
        const qs = new Set(tables.questions.map((x) => x.id));
        for (const k of tables.knowledge) if (k.question_id != null && !qs.has(k.question_id)) k.question_id = null;   // on delete set null
      }
      return back([...gone]);
    }
    return json(405);
  }
  return { tables, state, handle };
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? dot / Math.sqrt(x * y) : 0;
};

/** Bag of words → 768 numbers (similar wording → similar vectors). */
export function fakeEmbedding(text: string) {
  const v = new Array(768).fill(0);
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
    v[h % 768] += 1;
  }
  return v;
}

export type Task = 'extract' | 'answer' | 'translate' | 'faq' | 'translations' | 'tone';
/** Return the JSON object the model would give, or a status number to fail with. */
export type Responder = (task: Task, user: string, provider: 'groq' | 'gemini', system: string) => unknown;
export interface Sent { to: string; type: string; body: string; ids: string[]; template?: string; id: string }

export function installFakes(sb: ReturnType<typeof fakeSupabase>) {
  const sent: Sent[] = [];
  const reads: string[] = [];
  const aiBodies: string[] = [];
  const state = {
    ai: ((): unknown => 500) as Responder, graphDown: false, interactiveDown: false,
    gateway: { connected: false, me: null as string | null, qr: 'data:image/png;base64,QR' as string | null, admin: [] as unknown[] }, embedDown: false, onSend: undefined as undefined | ((s: Sent) => Promise<void>),
    /** Files clients "sent": media id → bytes and type (size overrides the reported file_size). */
    media: {} as Record<string, { type: string; bytes: Uint8Array; size?: number; status?: number }>,
    /** Groq Whisper: the words for a voice note (given the language hint), or a status to fail with. */
    voice: ((): string | number => 500) as (lang: string) => string | number,
    /** Google Calendar: busy times and the events the bot made; Razorpay: the links asked for. */
    calendar: { busy: [] as { start: string; end: string }[], events: [] as Row[] },
    razorpay: [] as Row[],
  };
  const whisper: string[] = [], downloads: string[] = [];
  let n = 0;
  const counter = { calls: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    counter.calls++;
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.host === 'sb.test') return sb.handle(url, init);
    if (url.host === 'oauth2.googleapis.com') {
      const b = new URLSearchParams(String(init.body));
      return b.get('refresh_token') === 'grefresh' && b.get('grant_type') === 'refresh_token' && b.get('client_id') === 'gid' && b.get('client_secret') === 'gsecret'
        ? Response.json({ access_token: 'g-access' }) : new Response('{}', { status: 400 });
    }
    if (url.host === 'www.googleapis.com') {
      if ((init.headers as Record<string, string>)?.authorization !== 'Bearer g-access') return new Response('{}', { status: 401 });
      const cal = state.calendar;
      if (url.pathname.endsWith('/freeBusy')) {
        const b = JSON.parse(String(init.body)), from = Date.parse(b.timeMin), to = Date.parse(b.timeMax);
        const busy = [...cal.busy, ...cal.events.map((e) => ({ start: e.start.dateTime, end: e.end.dateTime }))]
          .filter((x) => Date.parse(x.start) < to && Date.parse(x.end) > from);
        return Response.json({ calendars: { [b.items[0].id]: { busy } } });
      }
      if ((init.method ?? 'GET') === 'POST' && url.pathname.endsWith('/events')) {
        const b = JSON.parse(String(init.body)), id = b.id ?? `ev-${cal.events.length + 1}`;
        if (cal.events.some((e) => e.id === id)) return new Response('{}', { status: 409 });
        const meet = b.conferenceData && url.searchParams.get('conferenceDataVersion') === '1';   // as Google: no Meet without it
        const ev = { ...b, id, hangoutLink: meet ? `https://meet.google.com/abc-${id}` : undefined, htmlLink: `https://calendar.google.com/event?eid=${id}` };
        cal.events.push(ev);
        return Response.json(ev);
      }
      if ((init.method ?? 'GET') === 'GET' && url.pathname.includes('/events/')) {
        const ev = cal.events.find((e) => e.id === decodeURIComponent(url.pathname.split('/').pop()!));
        return ev ? Response.json(ev) : new Response('{}', { status: 404 });
      }
      if (init.method === 'DELETE') {
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        cal.events = cal.events.filter((e) => e.id !== id);
        return new Response(null, { status: 204 });
      }
    }
    if (url.host === 'api.razorpay.com') {
      if ((init.headers as Record<string, string>)?.authorization !== `Basic ${btoa('rzp_test_x:rzp-secret')}`) return new Response('{}', { status: 401 });
      const b = JSON.parse(String(init.body));
      state.razorpay.push(b);
      return Response.json({ id: `plink_${state.razorpay.length}`, short_url: `https://rzp.io/i/lf${state.razorpay.length}` });
    }
    if (url.host === 'gw.test') {                                                     // the WhatsApp Web (Baileys) gateway
      if (url.pathname.startsWith('/media/')) {
        if (!String((init.headers as Record<string, string>)?.['x-signature']).startsWith('sha256=')) return new Response('{}', { status: 401 });
        downloads.push(decodeURIComponent(url.pathname.slice(7)));
        const f = state.media[decodeURIComponent(url.pathname.slice(7))];
        return f ? new Response(f.bytes as unknown as BodyInit, { headers: { 'content-type': f.type, 'content-length': String(f.size ?? f.bytes.byteLength) } }) : new Response('{}', { status: 404 });
      }
      if (url.pathname === '/health') return Response.json({ connected: state.gateway.connected }, { status: state.gateway.connected ? 200 : 503 });
      if (url.pathname === '/status') {
        if (!String((init.headers as Record<string, string>)?.['x-signature']).startsWith('sha256=')) return new Response('{}', { status: 401 });
        const g = state.gateway;
        return Response.json({ connected: g.connected, me: g.connected ? g.me : null, since: g.connected ? '2026-10-18T06:00:00.000Z' : null, qr: g.connected ? null : g.qr });
      }
      if (!String((init.headers as Record<string, string>)?.['x-hub-signature-256']).startsWith('sha256=')) return new Response('{}', { status: 401 });
      const b = JSON.parse(String(init.body));
      if (url.pathname === '/admin') {
        state.gateway.admin.push(b);
        if (b.action === 'logout') { state.gateway.connected = false; return Response.json({ ok: true }); }
        return state.gateway.connected ? new Response('{}', { status: 409 }) : Response.json({ code: 'ABCD-EFGH' });
      }
      if (b.status === 'read') { reads.push(b.message_id); return Response.json({ success: true }); }
      const outs = toBaileys(b);                                                      // what the gateway sends on WhatsApp Web
      const s: Sent = { id: `gw.out.${++n}`, to: b.to ?? b.recipient, type: outs.map((o) => o.kind).join('+'),
        body: outs.map((o) => (o.kind === 'text' ? o.text : o.name)).join('\n---\n'), ids: outs.flatMap((o) => (o.kind === 'poll' ? o.options.map((x) => x.id) : [])) };
      sent.push(s);
      Object.assign(s, { outs, raw: b });
      return Response.json({ messages: [{ id: s.id }] });
    }
    if (url.host === 'graph.facebook.com' && (init.method ?? 'GET') === 'GET') {        // a media id's address
      const id = decodeURIComponent(url.pathname.split('/').pop()!), f = state.media[id];
      if (!f) return new Response('{"error":{}}', { status: 404 });
      if (f.status) return new Response('{"error":{}}', { status: f.status });
      if (!String((init.headers as Record<string, string>)?.authorization).startsWith('Bearer ')) return new Response('{}', { status: 401 });
      return Response.json({ url: `https://lookaside.fbsbx.com/${id}`, mime_type: f.type, file_size: f.size ?? f.bytes.byteLength });
    }
    if (url.host === 'lookaside.fbsbx.com') {
      downloads.push(url.pathname.slice(1));
      if (!String((init.headers as Record<string, string>)?.authorization).startsWith('Bearer ')) return new Response('', { status: 401 });
      const f = state.media[url.pathname.slice(1)];
      return f ? new Response(f.bytes as unknown as BodyInit, { headers: { 'content-type': f.type } }) : new Response('', { status: 404 });
    }
    if (url.host === 'api.groq.com' && url.pathname.endsWith('/audio/transcriptions')) {
      const lang = String((init.body as FormData).get('language') ?? '');
      whisper.push(lang);
      const out = state.voice(lang);
      return typeof out === 'number' ? new Response('{}', { status: out }) : Response.json({ text: out });
    }
    if (url.host === 'graph.facebook.com' && url.pathname.endsWith('/me/messages')) {     // Messenger / Instagram Send API
      const b = JSON.parse(String(init.body));
      if ((init.headers as Record<string, string>)?.authorization !== 'Bearer page-token') return new Response('{}', { status: 401 });
      const s: Sent = { id: `meta.out.${++n}`, to: `meta:${b.recipient.id}`, type: 'meta', body: b.message.text,
        ids: (b.message.quick_replies ?? []).map((x: { payload: string }) => x.payload) };
      sent.push(s);
      Object.assign(s, { raw: b });
      return Response.json({ recipient_id: b.recipient.id, message_id: s.id });
    }
    if (url.host === 'graph.facebook.com') {
      const b = JSON.parse(String(init.body));
      if (b.status === 'read') { reads.push(b.message_id); return Response.json({ success: true }); }
      if (state.graphDown || (state.interactiveDown && b.type === 'interactive')) return new Response('{"error":{}}', { status: 400 });
      const i = b.interactive;
      const s: Sent = {
        id: `wamid.out.${++n}`, to: b.to ?? b.recipient, type: b.type === 'interactive' ? i.type : b.type,
        body: b.text?.body ?? i?.body?.text ?? b.template?.components?.[0]?.parameters?.map((p: { text: string }) => p.text).join(' | ') ?? '',
        ids: i?.action?.sections?.[0]?.rows?.map((r: { id: string }) => r.id) ?? i?.action?.buttons?.map((x: { reply: { id: string } }) => x.reply.id) ?? [],
        template: b.template?.name,
      };
      sent.push(s);
      Object.assign(s, { raw: b });
      await state.onSend?.(s);
      return Response.json({ messages: [{ id: s.id }] });
    }
    if (url.host === 'generativelanguage.googleapis.com' && url.pathname.endsWith(':embedContent')) {
      const b = JSON.parse(String(init.body));
      aiBodies.push(String(init.body));
      if (state.embedDown) return new Response('{}', { status: 429 });
      return Response.json({ embedding: { values: fakeEmbedding(b.content.parts[0].text) } });
    }
    if (url.host === 'api.groq.com' || url.host === 'generativelanguage.googleapis.com') {
      aiBodies.push(String(init.body));
      const b = JSON.parse(String(init.body));
      const provider = url.host === 'api.groq.com' ? 'groq' : 'gemini';
      const task = b.response_format.json_schema.name as Task;
      const out = state.ai(task, b.messages[1].content, provider, b.messages[0].content);
      if (typeof out === 'number') return new Response('{}', { status: out });
      return Response.json({ choices: [{ message: { content: JSON.stringify(out) } }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return { sent, reads, aiBodies, whisper, downloads, state, counter, restore: () => { globalThis.fetch = original; } };
}
