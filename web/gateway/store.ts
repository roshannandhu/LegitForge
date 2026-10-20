/** The WhatsApp Web login (Baileys' auth state: the creds and the signal keys) and the bot's open
 *  polls, kept in Supabase (public.wa_auth, bot/supabase/009_gateway.sql). A free Render service
 *  loses its disk on every restart, and the same login moves to the laptop without a new QR. Plain
 *  PostgREST fetch, like the bot (no SDK). Baileys' helpers are passed in, so the tests run without
 *  installing Baileys (the site's CI installs only web/). */

export type Rest = <T = Record<string, unknown>>(method: string, path: string, body?: unknown, prefer?: string) => Promise<T[]>;

/** PostgREST for the wa_auth table, with Supabase's secret key (as the bot's io.ts sb()). */
export function rest(url: string, key: string, f: typeof fetch = fetch): Rest {
  return async (method, path, body, prefer = 'return=representation') => {
    const r = await f(`${url.replace(/\/+$/, '')}/rest/v1/${path}`, {
      method, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json', prefer },
    });
    if (!r.ok) throw new Error(`supabase ${method} ${path.split('?')[0]}: ${r.status}`);
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  };
}

/** What the store needs from Baileys (BufferJSON, initAuthCreds, proto.Message.AppStateSyncKeyData). */
export interface Kit {
  BufferJSON: { replacer: (k: string, v: unknown) => unknown; reviver: (k: string, v: unknown) => unknown };
  initAuthCreds: () => unknown;
  syncKey: (v: unknown) => unknown;
}

const list = (keys: string[]) => keys.map((k) => encodeURIComponent(`"${k}"`)).join(',');
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Baileys' AuthenticationState over wa_auth rows ("wa:creds", "wa:<type>-<id>"): the same get /
 *  set as useMultiFileAuthState, one upsert and one delete per set (in chunks of 100). */
export async function supabaseAuth(db: Rest, kit: Kit, prefix = 'wa:') {
  const json = (v: unknown) => JSON.parse(JSON.stringify(v, kit.BufferJSON.replacer));        // bytes → jsonb-safe
  const back = (v: unknown) => JSON.parse(JSON.stringify(v), kit.BufferJSON.reviver);
  const read = async (keys: string[]) => {
    const found = new Map<string, unknown>();
    for (const part of chunks(keys, 100)) {
      for (const r of await db<{ key: string; value: unknown }>('GET', `wa_auth?key=in.(${list(part)})&select=key,value`)) found.set(r.key, back(r.value));
    }
    return found;
  };
  const upsert = async (rows: { key: string; value: unknown }[]) => {
    const at = new Date().toISOString();
    for (const part of chunks(rows, 100)) await db('POST', 'wa_auth?on_conflict=key', part.map((r) => ({ ...r, updated_at: at })), 'resolution=merge-duplicates,return=minimal');
  };
  const creds = (await read([`${prefix}creds`])).get(`${prefix}creds`) ?? kit.initAuthCreds();
  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const got = await read(ids.map((id) => `${prefix}${type}-${id}`));
        const out: Record<string, unknown> = {};
        for (const id of ids) {
          const v = got.get(`${prefix}${type}-${id}`);
          if (v !== undefined) out[id] = type === 'app-state-sync-key' ? kit.syncKey(v) : v;
        }
        return out;
      },
      set: async (data: Record<string, Record<string, unknown>>) => {
        const up: { key: string; value: unknown }[] = [], gone: string[] = [];
        for (const type of Object.keys(data)) for (const id of Object.keys(data[type] ?? {})) {
          const v = data[type][id], key = `${prefix}${type}-${id}`;
          if (v) up.push({ key, value: json(v) }); else gone.push(key);
        }
        if (up.length) await upsert(up);
        for (const part of chunks(gone, 100)) await db('DELETE', `wa_auth?key=in.(${list(part)})`, undefined, 'return=minimal');
      },
    },
  };
  return {
    state,
    saveCreds: () => upsert([{ key: `${prefix}creds`, value: json(state.creds) }]),
    /** Logged out: forget the login (a new QR follows), keep the polls. */
    clear: () => db('DELETE', `wa_auth?key=like.${encodeURIComponent(`${prefix}*`)}`, undefined, 'return=minimal'),
  };
}

/** The bot's open polls (a vote is read with the poll message's secret): one row each. */
export function supabasePolls(db: Rest, kit: Kit) {
  return {
    load: async () => Object.fromEntries((await db<{ key: string; value: unknown }>('GET', 'wa_auth?key=like.poll%3A*&order=updated_at.desc&limit=300&select=key,value'))
      .map((r) => [r.key.slice(5), JSON.parse(JSON.stringify(r.value), kit.BufferJSON.reviver)])),
    save: (id: string, poll: unknown) => db('POST', 'wa_auth?on_conflict=key',
      [{ key: `poll:${id}`, value: JSON.parse(JSON.stringify(poll, kit.BufferJSON.replacer)), updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal'),
    /** Polls older than 30 days can no longer be voted on usefully. */
    prune: () => db('DELETE', `wa_auth?key=like.poll%3A*&updated_at=lt.${encodeURIComponent(new Date(Date.now() - 30 * 86_400_000).toISOString())}`, undefined, 'return=minimal'),
  };
}
