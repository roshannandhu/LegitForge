/** GET /admin/leads/files/leads/<lead id>/<file> — a file a client sent the WhatsApp bot
 *  (bot/worker.ts keep()), admins only. Never cached. Only photos open in the browser; anything
 *  else (PDF, video, a disguised page) downloads, so nothing a client sent runs on this origin. */

import { adminIdentity } from '@/lib/admin/auth';
import { getEnv } from '@/lib/cf';

export const dynamic = 'force-dynamic';
const INLINE = /^image\/(jpeg|png|webp)$/;

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!(await adminIdentity())) return new Response('Forbidden', { status: 403 });
  const key = (await params).key.join('/');
  if (!/^leads\/[0-9a-f-]{36}\/[\w.-]{1,90}$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await (await getEnv())?.MEDIA.get(key);
  if (!obj) return new Response('This file has expired (files are kept 90 days) or was deleted.', { status: 404 });
  const type = obj.httpMetadata?.contentType ?? '';
  const inline = INLINE.test(type);
  return new Response(obj.body as unknown as ReadableStream, {
    headers: {
      'content-type': inline ? type : 'application/octet-stream',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${key.split('/').pop()}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
