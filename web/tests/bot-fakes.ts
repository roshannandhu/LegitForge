/** Fakes for tests/bot.test.ts: the outside services the WhatsApp bot calls, behind one
 *  globalThis.fetch. Not a *.test.ts file, so the test runner only loads it through the test.
 *  - Supabase: a small PostgREST (the filters, upserts and RPC the bot uses), in memory.
 *  - WhatsApp Graph API: records every send; ids come back as wamid.out.N.
 *  - Groq / Gemini chat: a test-supplied responder per task (extract, answer, translate, faq).
 *  - Gemini embeddings: words hashed into 768 numbers, so the same text matches itself. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const KEY: Record<string, string> = { contacts: 'wa_id', messages: 'wamid', questions: 'id', knowledge: 'id' };
const UNIQUE: Record<string, string[]> = { contacts: ['code'] };

export function fakeSupabase(now: () => number) {
  const tables: Record<string, Row[]> = { contacts: [], messages: [], questions: [], knowledge: [] };
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
      return test(row, k, v);
    }));
  }
  const project = (rows: Row[], params: URLSearchParams) => {
    const sel = params.get('select');
    return structuredClone(sel && sel !== '*' ? rows.map((r) => Object.fromEntries(sel.split(',').map((c) => [c, r[c]]))) : rows);
  };
  function defaults(table: string, row: Row): Row {
    const t = new Date(now()).toISOString();
    if (table === 'questions') return { status: 'pending', answer: null, answered_by: null, answered_at: null, client_told_at: null, created_at: t, ...row, id: row.id ?? ++seq };
    if (table === 'knowledge') return { embedding: null, status: 'pending', question_id: null, decided_by: null, decided_at: null, created_at: t, ...row, id: row.id ?? ++seq };
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
        .filter((k) => k.status === 'approved' && k.embedding)
        .map((k) => ({ id: k.id, question_en: k.question_en, answer_en: k.answer_en, similarity: cosine(qv, JSON.parse(k.embedding)) }))
        .filter((k) => k.similarity > body.match_threshold)
        .sort((a, b) => b.similarity - a.similarity).slice(0, body.match_count));
    }
    const table = path, params = url.searchParams;
    if (method === 'GET') {
      let rows = filtered(table, params);
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
        const existing = tables[table].find((r) => r[key] === row[key] && row[key] != null);
        if (existing) {
          if (prefer.includes('ignore-duplicates')) continue;
          if (prefer.includes('merge-duplicates')) { Object.assign(existing, row); made.push(existing); continue; }
          return json(409, { code: '23505', message: `duplicate ${key}` });
        }
        for (const u of UNIQUE[table] ?? []) if (tables[table].some((r) => r[u] === row[u])) return json(409, { code: '23505', message: `duplicate ${u}` });
        tables[table].push(row);
        made.push(row);
      }
      return back(made);
    }
    if (method === 'PATCH') {
      const rows = filtered(table, params);
      for (const r of rows) Object.assign(r, structuredClone(body));
      return back(rows);
    }
    if (method === 'DELETE') {
      const gone = new Set(filtered(table, params));
      tables[table] = tables[table].filter((r) => !gone.has(r));
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

export type Task = 'extract' | 'answer' | 'translate' | 'faq';
/** Return the JSON object the model would give, or a status number to fail with. */
export type Responder = (task: Task, user: string, provider: 'groq' | 'gemini', system: string) => unknown;
export interface Sent { to: string; type: string; body: string; ids: string[]; template?: string; id: string }

export function installFakes(sb: ReturnType<typeof fakeSupabase>) {
  const sent: Sent[] = [];
  const reads: string[] = [];
  const aiBodies: string[] = [];
  const state = { ai: ((): unknown => 500) as Responder, graphDown: false, embedDown: false, onSend: undefined as undefined | ((s: Sent) => Promise<void>) };
  let n = 0;
  const counter = { calls: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    counter.calls++;
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.host === 'sb.test') return sb.handle(url, init);
    if (url.host === 'graph.facebook.com') {
      const b = JSON.parse(String(init.body));
      if (b.status === 'read') { reads.push(b.message_id); return Response.json({ success: true }); }
      if (state.graphDown) return new Response('{"error":{}}', { status: 400 });
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
  return { sent, reads, aiBodies, state, counter, restore: () => { globalThis.fetch = original; } };
}
