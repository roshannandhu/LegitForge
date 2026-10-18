import { getEnv } from '@/lib/cf';

/** The website chat bubble (components/chat) → the bot (bot/admin.ts BotAdmin.fetch through the
 *  BOT service binding): one origin, so the bot's own address stays off the site and no CORS or
 *  CSP exception is needed. The bot applies the limits; this only passes the visitor's address on
 *  and reads at most 4 KB (with or without a Content-Length). */
export const dynamic = 'force-dynamic';

const MAX = 4000;
const tooBig = () => Response.json({ error: 'too-large' }, { status: 413 });

async function capped(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX) return null;
  const reader = req.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return new TextDecoder().decode(all);
}

async function forward(req: Request) {
  const bot = ((await getEnv()) as unknown as { BOT?: { fetch(r: Request): Promise<Response> } } | null)?.BOT;
  if (!bot) return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  const body = req.method === 'POST' ? await capped(req) : undefined;
  if (body === null) return tooBig();
  return bot.fetch(new Request(`https://bot/chat${new URL(req.url).search}`, {
    method: req.method, body,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': req.headers.get('cf-connecting-ip') ?? '' },
  }));
}

export const GET = forward;
export const POST = forward;
