/** GET /media/<key> — uploaded project images from R2 (PLAN §7.8). Keys are content hashes,
 *  so every response is cacheable forever. Only project images and team photos are served. */

import { getEnv } from '@/lib/cf';

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join('/');
  if (!/^(projects|team)\/[0-9a-f-]{36}\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await (await getEnv())?.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body as unknown as ReadableStream, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
    },
  });
}
