'use server';

/** Admin writes (PLAN §7.8). Every action checks requireAdmin() itself: Server Actions are
 *  public POST endpoints, whatever page they are rendered on. Writes that change the public
 *  site call updateTag('projects') so the pages re-render from D1. */

import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import * as db from '@/lib/admin/db';
import { getEnv } from '@/lib/cf';
import { TEAM } from '@/lib/content';
import type { WorkCategory } from '@/lib/pages';

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const opt = (f: FormData, k: string, max = 2000) => str(f, k, max) || null;
const lines = (f: FormData, k: string) => str(f, k, 8000).split('\n').map((l) => l.trim()).filter(Boolean);
const csv = (f: FormData, k: string) => str(f, k).split(',').map((t) => t.trim()).filter(Boolean);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormState = { error?: string; ok?: string } | undefined;

function refreshPublic() {
  updateTag('projects');
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
  const team = TEAM.filter((m) => f.get(`team_${m.slug}`) === 'on')
    .map((m) => ({ slug: m.slug, role: str(f, `role_${m.slug}`, 120) }));

  await db.updateProject(id, {
    slug, title: str(f, 'title', 120), client_type: str(f, 'client_type', 120), category, summary: str(f, 'summary', 300),
    challenge: opt(f, 'challenge', 3000), result_value: opt(f, 'result_value', 40), result_label: opt(f, 'result_label', 120),
    stack: JSON.stringify(csv(f, 'stack')), live_url: liveUrl, status_stamp: stamp, tags: JSON.stringify(csv(f, 'tags')),
    built: JSON.stringify(lines(f, 'built')), results: JSON.stringify(results), team: JSON.stringify(team),
    is_featured: f.get('is_featured') === 'on' ? 1 : 0, launched_on: launched,
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
