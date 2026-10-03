import { getCloudflareContext } from '@opennextjs/cloudflare';
import { publicEvent, storePublicEvent } from '@/lib/analytics';
import { SERVICE_PAGES } from '@/lib/pages';

const empty = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
const MAX_BYTES = 2048;

async function boundedJson(req: Request): Promise<unknown> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(body));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

/** Best-effort analytics: input is strictly projected onto public, known values. */
export async function POST(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) return empty();
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return empty();
  const raw = await boundedJson(req);
  const event = publicEvent(raw, SERVICE_PAGES.map((s) => s.slug));
  if (!event) return empty();
  try {
    const cf = await getCloudflareContext({ async: true });
    const db = cf.env.DB;
    if (!db || !cf.env.HASH_SALT) return empty();
    if (event.name === 'project_open') {
      if (!await db.prepare('SELECT 1 FROM projects WHERE slug = ? AND is_published = 1').bind(event.props.slug!).first()) return empty();
    }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`events:${cf.env.HASH_SALT}:${req.headers.get('cf-connecting-ip') ?? 'local'}`));
    const key = `events:${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    await storePublicEvent(db, event, key, req.headers.get('cf-ipcountry'));
  } catch { console.error('[analytics] event storage unavailable'); }
  return empty();
}
