/** POST /api/admin/upload — one image for a project (PLAN §7.8). Paste or file pick in the
 *  admin both land here. Alt text is required HERE, not just in the form: two people will
 *  skip an optional field every time. Width and height come from the Images binding when it
 *  is there, else from the browser (checked for sanity); the browser also sends the dominant
 *  colour, the placeholder that stops the card shifting while the image loads. */

import { revalidateTag } from 'next/cache';
import { adminIdentity } from '@/lib/admin/auth';
import { getProjectRow, insertImage } from '@/lib/admin/db';
import { getEnv } from '@/lib/cf';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const KINDS = ['cover', 'gallery', 'before', 'after'] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function POST(req: Request) {
  if (!(await adminIdentity())) return json({ error: 'forbidden' }, 403);
  const env = await getEnv();
  if (!env?.MEDIA || !env.DB) return json({ error: 'Storage is not configured (no MEDIA or DB binding).' }, 503);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: 'Send the image as a form upload.' }, 400); }

  const file = form.get('file');
  const alt = String(form.get('alt') ?? '').trim();
  const projectId = String(form.get('projectId') ?? '');
  const kind = String(form.get('kind') ?? 'gallery') as (typeof KINDS)[number];
  const color = String(form.get('color') ?? '');

  if (!(file instanceof File)) return json({ error: 'Choose or paste an image.' }, 400);
  if (alt.length < 8) return json({ error: 'Describe the image for people who can’t see it (at least 8 characters).' }, 422);
  if (alt.length > 250) return json({ error: 'Keep the description under 250 characters.' }, 422);
  if (!TYPES[file.type]) return json({ error: 'Use a JPEG, PNG or WebP image.' }, 415);
  if (file.size > MAX_BYTES) return json({ error: 'The image is over 5 MB. Export it smaller and try again.' }, 413);
  if (!KINDS.includes(kind)) return json({ error: 'Unknown image kind.' }, 400);
  if (!(await getProjectRow(projectId))) return json({ error: 'That project doesn’t exist.' }, 404);

  const bytes = await file.arrayBuffer();
  let width = Number(form.get('width')), height = Number(form.get('height'));
  try {
    const info = await env.IMAGES?.info(new Blob([bytes]).stream() as Parameters<ImagesBinding['info']>[0]);
    if (info && 'width' in info && info.width && info.height) ({ width, height } = info);
  } catch { /* no Images binding locally: keep the browser's numbers */ }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 12000 || height > 12000) {
    return json({ error: 'Couldn’t read the image size. Try a different file.' }, 422);
  }

  // content-addressed: the same image is stored once, and URLs can be cached forever
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = `projects/${projectId}/${hash.slice(0, 32)}.${TYPES[file.type]}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
  const id = await insertImage({
    project_id: projectId, r2_key: key, alt, kind, width, height,
    dominant_color: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null,
  });

  revalidateTag('projects', { expire: 0 });           // route handlers can't updateTag; expire now instead
  return json({ ok: true, id, key, width, height });
}
