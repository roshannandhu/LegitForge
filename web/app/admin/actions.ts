'use server';

/** Admin writes (PLAN §7.8). Every action checks requireAdmin() itself: Server Actions are
 *  public POST endpoints, whatever page they are rendered on. Writes that change the public
 *  site call updateTag('projects') so the pages re-render from D1. */

import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import * as db from '@/lib/admin/db';
import { getEnv } from '@/lib/cf';
import { getTeam, TEAM_DEFAULTS } from '@/lib/team';
import type { WorkCategory } from '@/lib/pages';

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const opt = (f: FormData, k: string, max = 2000) => str(f, k, max) || null;
const lines = (f: FormData, k: string) => str(f, k, 8000).split('\n').map((l) => l.trim()).filter(Boolean);
const csv = (f: FormData, k: string) => str(f, k).split(',').map((t) => t.trim()).filter(Boolean);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormState = { error?: string; ok?: string } | undefined;

function refreshPublic() {
  updateTag('projects');
  updateTag('team');           // "projects shipped" and favourites are on the cards
}

/* ------------------------------------------------------------------ projects */
export async function createProjectAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const title = str(f, 'title', 120);
  const slug = str(f, 'slug', 80) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!title) return { error: 'Give the project a title.' };
  if (!SLUG.test(slug)) return { error: 'The slug can only use lowercase letters, numbers and single hyphens.' };
  if (await db.slugTaken(slug)) return { error: `“${slug}” is already used by another project.` };
  const id = await db.createProject(title, slug);
  redirect(`/admin/projects/${id}`);
}

export async function saveProjectAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const slug = str(f, 'slug', 80);
  const category = str(f, 'category') as WorkCategory;
  const stamp = str(f, 'status_stamp') as (typeof db.STAMPS)[number];
  const liveUrl = opt(f, 'live_url', 300);
  const launched = opt(f, 'launched_on', 10);

  if (!str(f, 'title')) return { error: 'The title is required.' };
  if (!SLUG.test(slug)) return { error: 'The slug can only use lowercase letters, numbers and single hyphens.' };
  if (await db.slugTaken(slug, id)) return { error: `“${slug}” is already used by another project.` };
  if (!db.CATEGORIES.includes(category)) return { error: 'Pick a category.' };
  if (!db.STAMPS.includes(stamp)) return { error: 'Pick a status stamp.' };
  if (!str(f, 'client_type')) return { error: 'Say who the client is, e.g. “Bakery in Kochi”.' };
  if (!str(f, 'summary')) return { error: 'Write a one-line summary.' };
  if (liveUrl && !/^https:\/\/\S+$/.test(liveUrl)) return { error: 'The live URL must start with https://' };
  if (launched && !/^\d{4}-\d{2}-\d{2}$/.test(launched)) return { error: 'The launch date must be a date.' };

  // "value | label | source" per line
  const results = lines(f, 'results').map((l) => {
    const [value = '', label = '', source = ''] = l.split('|').map((x) => x.trim());
    return { value, label, source };
  }).filter((r) => r.value && r.label);
  const team = (await getTeam()).filter((m) => f.get(`team_${m.slug}`) === 'on')
    .map((m) => ({ slug: m.slug, role: str(f, `role_${m.slug}`, 120) }));

  await db.updateProject(id, {
    slug, title: str(f, 'title', 120), client_type: str(f, 'client_type', 120), category, summary: str(f, 'summary', 300),
    challenge: opt(f, 'challenge', 3000), result_value: opt(f, 'result_value', 40), result_label: opt(f, 'result_label', 120),
    stack: JSON.stringify(csv(f, 'stack')), live_url: liveUrl, status_stamp: stamp, tags: JSON.stringify(csv(f, 'tags')),
    built: JSON.stringify(lines(f, 'built')), results: JSON.stringify(results), team: JSON.stringify(team),
    is_featured: f.get('is_featured') === 'on' ? 1 : 0, launched_on: launched,
    proof_before: opt(f, 'proof_before', 40), proof_after: opt(f, 'proof_after', 40),
  });
  refreshPublic();
  revalidatePath('/admin/projects');
  return { ok: 'Saved.' };
}

export async function publishProjectAction(id: string, published: boolean) {
  await requireAdmin();
  await db.setPublished(id, published);
  refreshPublic();
  revalidatePath('/admin/projects');
}

export async function moveProjectAction(id: string, dir: -1 | 1) {
  await requireAdmin();
  await db.moveProject(id, dir);
  refreshPublic();
  revalidatePath('/admin/projects');
}

export async function deleteProjectAction(id: string) {
  await requireAdmin();
  const keys = await db.deleteProject(id);
  const media = (await getEnv())?.MEDIA;
  if (media && keys.length) await media.delete(keys);
  refreshPublic();
  redirect('/admin/projects');
}

export async function setCoverAction(projectId: string, imageId: string) {
  await requireAdmin();
  await db.setCover(projectId, imageId);
  refreshPublic();
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deleteImageAction(projectId: string, imageId: string) {
  await requireAdmin();
  const key = await db.deleteImage(projectId, imageId);
  const media = (await getEnv())?.MEDIA;
  if (media && key) await media.delete(key);
  refreshPublic();
  revalidatePath(`/admin/projects/${projectId}`);
}

/* ------------------------------------------------------------------ leads */
export async function leadStatusAction(id: string, f: FormData) {
  await requireAdmin();
  const status = str(f, 'status') as db.LeadStatus;
  if (db.LEAD_STATUSES.includes(status)) await db.setLeadStatus(id, status);
  revalidatePath('/admin/leads');
}

/* ------------------------------------------------------------------ testimonials */
export async function saveTestimonialAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const person_name = str(f, 'person_name', 120), quote = str(f, 'quote', 1000);
  if (!person_name || !quote) return { error: 'The name and the quote are required.' };
  await db.saveTestimonial({
    id: str(f, 'id') || undefined, person_name, quote,
    person_role: opt(f, 'person_role', 120), company: opt(f, 'company', 120),
    permission_confirmed: f.get('permission_confirmed') === 'on',
  });
  revalidatePath('/admin/testimonials');
  return { ok: 'Saved.' };
}

export async function publishTestimonialAction(id: string, published: boolean): Promise<FormState> {
  await requireAdmin();
  const ok = await db.setTestimonialPublished(id, published);
  revalidatePath('/admin/testimonials');
  return ok ? { ok: published ? 'Published.' : 'Unpublished.' } : { error: 'Tick “Client gave written permission” before publishing.' };
}

export async function deleteTestimonialAction(id: string) {
  await requireAdmin();
  await db.deleteTestimonial(id);
  revalidatePath('/admin/testimonials');
}

/* ------------------------------------------------------------------ site */
export async function saveStatAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const key = str(f, 'key', 60), value = str(f, 'value', 200);
  if (!/^[a-z_]+$/.test(key)) return { error: 'Keys use lowercase letters and underscores.' };
  if (!value) return { error: 'Enter a value.' };
  await db.setStat(key, value);
  revalidatePath('/admin/site');
  revalidatePath('/', 'layout');
  return { ok: `Saved ${key}.` };
}

/** "Refresh site content": every page that reads D1 re-renders on its next visit. */
export async function refreshSiteAction(): Promise<FormState> {
  await requireAdmin();
  refreshPublic();
  revalidatePath('/', 'layout');
  return { ok: 'Done. Pages update on their next visit.' };
}

/* ------------------------------------------------------------------ team */
export async function importTeamAction() {
  await requireAdmin();
  await db.importMembers(TEAM_DEFAULTS);
  revalidatePath('/admin/team');
}

const httpsOrNull = (v: string | null) => (v && /^https:\/\/\S+$/.test(v) ? v : null);

export async function saveMemberAction(id: string, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const slug = str(f, 'slug', 60), idCode = str(f, 'id_code', 12).toUpperCase();
  if (!str(f, 'name') || !str(f, 'role')) return { error: 'Name and role are required.' };
  if (!SLUG.test(slug)) return { error: 'The slug can only use lowercase letters, numbers and single hyphens.' };
  if (!/^LF-\d{3}$/.test(idCode)) return { error: 'The ID code looks like LF-001.' };
  const clash = await db.memberConflict(id, slug, idCode);
  if (clash) return { error: clash.slug === slug ? `“${slug}” is taken.` : `${idCode} is taken.` };
  for (const k of ['linkedin_url', 'github_url', 'website_url']) {
    const v = opt(f, k, 300);
    if (v && !httpsOrNull(v)) return { error: 'Links must start with https://' };
  }
  const bio = str(f, 'bio', 1200);
  if (bio.length < 40) return { error: 'Write a bio of at least a couple of sentences.' };
  await db.updateMember(id, {
    slug, name: str(f, 'name', 80), role: str(f, 'role', 80), id_code: idCode, bio,
    skills: JSON.stringify(csv(f, 'skills').slice(0, 6)), tools: JSON.stringify(csv(f, 'tools').slice(0, 12)),
    linkedin_url: httpsOrNull(opt(f, 'linkedin_url', 300)), github_url: httpsOrNull(opt(f, 'github_url', 300)),
    website_url: httpsOrNull(opt(f, 'website_url', 300)), favorite_project_id: opt(f, 'favorite_project_id', 40),
    initials: str(f, 'initials', 3).toUpperCase() || null,
    building: opt(f, 'building', 60),
  });
  updateTag('team');
  revalidatePath('/admin/team');
  revalidatePath(`/admin/team/${id}`);
  return { ok: 'Saved.' };
}

export async function publishMemberAction(id: string, published: boolean) {
  await requireAdmin();
  await db.setMemberPublished(id, published);
  updateTag('team');
  revalidatePath('/admin/team');
}

export async function regenerateCardAction(id: string): Promise<FormState> {
  await requireAdmin();
  await db.bumpCard(id);
  updateTag('team');
  revalidatePath(`/admin/team/${id}`);
  return { ok: 'The ID card will redraw on every page.' };
}

export async function removeMemberPhotoAction(id: string) {
  await requireAdmin();
  const old = await db.setMemberPhoto(id, null);
  const media = (await getEnv())?.MEDIA;
  if (media && old) await media.delete(old);
  updateTag('team');
  revalidatePath(`/admin/team/${id}`);
}

/* ------------------------------------------------------------------ cover capture */
/** "Capture cover" (PLAN §7.8 item 2): screenshots the live site at 1440 × 900 (the cover) and
 *  390 × 844 (a gallery image) through Cloudflare Browser Rendering, straight into R2, so every
 *  cover is framed the same. Needs the BROWSER binding, which only exists on Cloudflare (it is
 *  a paid add-on and there is no local version): elsewhere this says so and does nothing. */
export async function captureCoverAction(projectId: string): Promise<FormState> {
  await requireAdmin();
  const env = await getEnv();
  const row = await db.getProjectRow(projectId);
  if (!row?.live_url) return { error: 'Add the project’s live URL first, then save.' };
  if (!env?.BROWSER || !env.MEDIA) {
    return { error: 'Cover capture runs on Cloudflare only: it needs the Browser Rendering binding (BROWSER). Paste a screenshot instead.' };
  }
  const { default: puppeteer } = await import('@cloudflare/puppeteer');
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(env.BROWSER as unknown as Parameters<typeof puppeteer.launch>[0]);
    const page = await browser.newPage();
    const shots: { kind: 'cover' | 'gallery'; w: number; h: number; alt: string; mobile: boolean }[] = [
      { kind: 'cover', w: 1440, h: 900, alt: `${row.title}: the live website on a laptop`, mobile: false },
      { kind: 'gallery', w: 390, h: 844, alt: `${row.title}: the live website on a phone`, mobile: true },
    ];
    for (const s of shots) {
      await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1, isMobile: s.mobile, hasTouch: s.mobile });
      await page.goto(row.live_url, { waitUntil: 'networkidle0', timeout: 30_000 });
      const bytes = new Uint8Array(await page.screenshot({ type: 'jpeg', quality: 82 }) as Uint8Array);
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const key = `projects/${projectId}/${hash.slice(0, 32)}.jpg`;
      await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } });
      const id = await db.insertImage({ project_id: projectId, r2_key: key, alt: s.alt, kind: s.kind, width: s.w, height: s.h, dominant_color: null });
      if (s.kind === 'cover') await db.setCover(projectId, id);
    }
  } catch (e) {
    console.error('[capture]', e);
    return { error: 'The live site couldn’t be captured (it may be slow or blocking bots; details are in the server log). Paste a screenshot instead.' };
  } finally {
    await browser?.close();
  }
  refreshPublic();
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: 'Captured: the laptop view is now the cover, and the phone view is in the gallery.' };
}
