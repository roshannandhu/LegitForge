import { getEnv } from '@/lib/cf';

/** The website chat bubble (components/chat) → the bot (bot/admin.ts BotAdmin.fetch through the
 *  BOT service binding): one origin, so the bot's own address stays off the site and no CORS or
 *  CSP exception is needed. The bot applies the limits; this only passes the visitor's address on. */
export const dynamic = 'force-dynamic';

async function forward(req: Request) {
  const bot = ((await getEnv()) as unknown as { BOT?: { fetch(r: Request): Promise<Response> } } | null)?.BOT;
  if (!bot) return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  if (Number(req.headers.get('content-length') ?? 0) > 4000) return Response.json({ error: 'too-large' }, { status: 413 });
  const body = req.method === 'POST' ? await req.text() : undefined;
  if (body && body.length > 4000) return Response.json({ error: 'too-large' }, { status: 413 });
  return bot.fetch(new Request(`https://bot/chat${new URL(req.url).search}`, {
    method: req.method, body,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': req.headers.get('cf-connecting-ip') ?? '' },
  }));
}

export const GET = forward;
export const POST = forward;
