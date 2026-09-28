'use server';

/** Admin writes (PLAN §7.8). Every action checks requireAdmin() itself: Server Actions are
 *  public POST endpoints, whatever page they are rendered on. Writes that change the public
 *  site call updateTag('projects') so the pages re-render from D1. */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { isOwner, ownerEmails, requireAdmin, SESSION_COOKIE } from '@/lib/admin/auth';
import * as db from '@/lib/admin/db';
import { getEnv } from '@/lib/cf';
import { getTeam, TEAM_DEFAULTS } from '@/lib/team';
import type { WorkCategory } from '@/lib/pages';
import { BriefError, briefFrom, nameOnly, parseRepo, repoBrief, repoDataFrom, type Brief } from '@/lib/admin/github';
import { companyFromForm } from '@/lib/company';

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const opt = (f: FormData, k: string, max = 2000) => str(f, k, max) || null;
const lines = (f: FormData, k: string) => str(f, k, 8000).split('\n').map((l) => l.trim()).filter(Boolean);
const csv = (f: FormData, k: string) => str(f, k).split(',').map((t) => t.trim()).filter(Boolean);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormState = { error?: string; ok?: string } | undefined;

function refreshPublic() {
  updateTag('projects');
  updateTag('testimonials');
  updateTag('team');           // "projects shipped" and favourites are on the cards
}

/* ------------------------------------------------------------------ projects */
/** "Add from GitHub": the repo link becomes a DRAFT project with its brief filled in
 *  (lib/admin/github.ts). The browser then uploads the cover to /api/admin/upload and opens
 *  the editor; the owner checks it and presses Publish. */
export type GithubResult = { id: string; title: string; alt: string } | { error: string; nameOnly?: boolean };

/** `fetched`: the repo's data as the admin's browser read it from GitHub (github-add.tsx), used
 *  when it checks out (repoDataFrom); else the server reads GitHub itself (serverRepoData: the
 *  public repo page, or the API with GITHUB_TOKEN for private repos). `fromName`: the owner chose
 *  "Create from the name only" after GitHub couldn't be read (a private repo). */
export async function projectFromGithubAction(url: string, fetched?: string, fromName = false): Promise<GithubResult> {
  await requireAdmin();
  const ref = parseRepo(String(url ?? ''));
  if (!ref) return { error: 'That isn’t a GitHub repository link. It looks like https://github.com/owner/repo.' };
  const given = typeof fetched === 'string' && fetched.length < 400_000 ? repoDataFrom(fetched, ref) : null;
  const env = await getEnv();
  const token = env?.GITHUB_TOKEN || process.env.GITHUB_TOKEN || undefined;
  // a fixture server for local tests only: `next dev` with the bypass (production builds drop this)
  const apiBase = process.env.NODE_ENV === 'development' && (env?.ADMIN_DEV_BYPASS || process.env.ADMIN_DEV_BYPASS)
    ? (env?.GITHUB_API_BASE || process.env.GITHUB_API_BASE || undefined) : undefined;
  let b: Brief;
  try { b = fromName === true ? briefFrom(nameOnly(ref)) : given ? briefFrom(given) : await repoBrief(ref, { token, apiBase }); }
  catch (e) {
    return e instanceof BriefError ? { error: e.message, nameOnly: e.nameOnly }
      : { error: 'Couldn’t read that repository. Try again, or create the project from its name.', nameOnly: true };
  }

  let slug = b.slugBase;
  for (let n = 2; await db.slugTaken(slug); n++) slug = `${b.slugBase.slice(0, 55)}-${n}`;
  const id = await db.createProject(b.title, slug);
  await db.updateProject(id, {
    slug, title: b.title, client_type: '', category: b.category, summary: b.summary, challenge: b.challenge,
    result_value: null, result_label: null, stack: JSON.stringify(b.stack), live_url: b.liveUrl,
    status_stamp: b.liveUrl ? 'live' : 'none', tags: JSON.stringify(b.tags), built: JSON.stringify(b.built),
    results: '[]', team: '[]', is_featured: 0, launched_on: b.launchedOn, proof_before: null, proof_after: null,
  });
  revalidatePath('/admin/projects');
  return { id, title: b.title, alt: `Screenshot of ${b.title}` };
}

/** Rollback for "Add from GitHub" when the cover upload fails: drops the draft it just made. */
export async function discardDraftAction(id: string) {
  await requireAdmin();
  const row = await db.getProjectRow(id);
  if (!row || row.is_published) return;
  const keys = await db.deleteProject(id);
  const media = (await getEnv())?.MEDIA;
  if (media && keys.length) await media.delete(keys);
  revalidatePath('/admin/projects');
}

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

/** Publishing needs what every card and case study shows: a client line and a summary. A draft
 *  from "Add from GitHub" has no client line yet, so the owner checks it before it goes live. */
export async function publishProjectAction(id: string, published: boolean): Promise<FormState> {
  await requireAdmin();
  if (published) {
    const row = await db.getProjectRow(id);
    if (!row) return { error: 'That project no longer exists.' };
    if (!row.client_type.trim() || !row.summary.trim()) return { error: 'Fill in the client and the one-line summary, save, then publish.' };
  }
  await db.setPublished(id, published);
  refreshPublic();
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  return { ok: published ? 'Published.' : 'Unpublished.' };
}

/** The star in Admin → Projects: show this project on the home page's rail (or not). */
export async function featureProjectAction(id: string, featured: boolean) {
  await requireAdmin();
  await db.setFeatured(id, featured);
  refreshPublic();
  revalidatePath('/admin/projects');
}

export async function moveProjectAction(id: string, dir: -1 | 1) {
  await requireAdmin();
  await db.moveProject(id, dir);
  refreshPublic();
  revalidatePath('/admin/projects');
}

export async function deleteProjectAction(id: string, f: FormData) {
  await requireAdmin();
  if (f.get('confirm') !== 'on') return;
  const keys = await db.deleteProject(id);
  const media = (await getEnv())?.MEDIA;
  if (media && keys.length) await media.delete(keys);
  refreshPublic();
  revalidatePath('/admin/projects');
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

/** Delete a lead for good (spam, tests). The button asks first. */
export async function deleteLeadAction(id: string) {
  await requireAdmin();
  await db.deleteLead(id);
  revalidatePath('/admin/leads');
  revalidatePath('/admin');    // the overview's counts
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
  updateTag('testimonials');
  revalidatePath('/admin/testimonials');
  return { ok: 'Saved.' };
}

export async function publishTestimonialAction(id: string, published: boolean): Promise<FormState> {
  await requireAdmin();
  const ok = await db.setTestimonialPublished(id, published);
  if (ok) updateTag('testimonials');
  revalidatePath('/admin/testimonials');
  return ok ? { ok: published ? 'Published.' : 'Unpublished.' } : { error: 'Tick “Client gave written permission” before publishing.' };
}

export async function deleteTestimonialAction(id: string) {
  await requireAdmin();
  await db.deleteTestimonial(id);
  updateTag('testimonials');
  revalidatePath('/admin/testimonials');
}

/* ------------------------------------------------------------------ site */
/** "Refresh site content" (Admin → Overview): every page that reads D1 re-renders on its next visit. */
export async function refreshSiteAction(): Promise<FormState> {
  await requireAdmin();
  refreshPublic();
  updateTag('company');
  revalidatePath('/', 'layout');
  return { ok: 'Done. Pages update on their next visit.' };
}

/* ------------------------------------------------------------------ team */
export async function importTeamAction() {
  await requireAdmin();
  await db.importMembers(TEAM_DEFAULTS);
  updateTag('team');           // the imported people are published: the public pages show them now
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
  const before = await db.getMember(id);
  if (!before) return { error: 'That person no longer exists.' };
  // the favourite must still exist (a project deleted in another tab would fail the foreign key)
  const fav = opt(f, 'favorite_project_id', 40);
  const favOk = !fav || (await db.projectTitles()).some((p) => p.id === fav);
  await db.updateMember(id, {
    slug, name: str(f, 'name', 80), role: str(f, 'role', 80), id_code: idCode, bio,
    skills: JSON.stringify(csv(f, 'skills').slice(0, 6)), tools: JSON.stringify(csv(f, 'tools').slice(0, 12)),
    linkedin_url: httpsOrNull(opt(f, 'linkedin_url', 300)), github_url: httpsOrNull(opt(f, 'github_url', 300)),
    website_url: httpsOrNull(opt(f, 'website_url', 300)), favorite_project_id: favOk ? fav : null,
    initials: str(f, 'initials', 3).toUpperCase() || null,
    building: opt(f, 'building', 60),
  });
  if (before.slug !== slug) { await db.renameCredits(before.slug, slug); updateTag('projects'); }
  updateTag('team');
  revalidatePath('/admin/team');
  revalidatePath(`/admin/team/${id}`);
  return { ok: 'Saved.' };
}

export async function publishMemberAction(id: string, published: boolean) {
  await requireAdmin();
  if (published && !(await db.getMember(id))?.bio.trim()) return;   // the button only shows once the profile is filled in
  await db.setMemberPublished(id, published);
  updateTag('team');
  revalidatePath('/admin/team');
}

export async function createMemberAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(f, 'name', 80), role = str(f, 'role', 80);
  const slug = str(f, 'slug', 60) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!name || !role) return { error: 'Name and role are required.' };
  if (!SLUG.test(slug)) return { error: 'The slug can only use lowercase letters, numbers and single hyphens.' };
  if (await db.memberSlugTaken(slug)) return { error: `“${slug}” is taken.` };
  const id = await db.createMember(name, role, slug);
  revalidatePath('/admin/team');
  redirect(`/admin/team/${id}`);
}

export async function moveMemberAction(id: string, dir: -1 | 1) {
  await requireAdmin();
  await db.moveMember(id, dir);
  updateTag('team');
  revalidatePath('/admin/team');
}

export async function deleteMemberAction(id: string, f: FormData) {
  await requireAdmin();
  if (f.get('confirm') !== 'on') return;
  const gone = await db.getMember(id);
  const key = await db.deleteMember(id);
  if (gone) { await db.renameCredits(gone.slug, null); updateTag('projects'); }
  const media = (await getEnv())?.MEDIA;
  if (media && key) await media.delete(key);
  updateTag('team');
  revalidatePath('/admin/team');
  redirect('/admin/team');
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

/* ------------------------------------------------------------------ access */
/** Admin → Access: the Google accounts that may sign in besides the owners (ADMIN_EMAILS).
 *  lib/admin/auth.ts checks this list on every request, so a removal takes effect at once.
 *  Only owners may change it: an added admin can't add more people or lock others out. */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export async function addAdminEmailAction(_: FormState, f: FormData): Promise<FormState> {
  const who = await requireAdmin();
  if (!(await isOwner(who))) return { error: 'Only the owners can change who can sign in.' };
  const email = str(f, 'email', 254).toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter the Google account’s email, like name@gmail.com.' };
  if ((await ownerEmails()).includes(email)) return { error: `${email} is an owner: it can always sign in.` };
  await db.addAdminEmail(email, who);
  revalidatePath('/admin/access');
  return { ok: `${email} can now sign in with Google.` };
}

export async function removeAdminEmailAction(email: string) {
  if (!(await isOwner(await requireAdmin()))) return;
  await db.removeAdminEmail(email);
  revalidatePath('/admin/access');
}

/** Sign out. The one action without requireAdmin(): it only ever removes access. */
export async function signOutAction() {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0 });
  redirect('/admin/sign-in');
}

/** Owners: end every admin session on every device (a lost phone, a shared computer), this one too. */
export async function signOutEverywhereAction() {
  if (!(await isOwner(await requireAdmin()))) return;
  await db.signOutEverywhere();
  await signOutAction();
}

/* ------------------------------------------------------------------ company */
/** Admin → Company: email, WhatsApp, social links, legal details (lib/company.ts checks them).
 *  Owners only: the WhatsApp number is where every customer chat goes, so an added admin can't
 *  redirect it. Every page re-renders with the new details on its next visit. */
export async function saveCompanyAction(_: FormState, f: FormData): Promise<FormState> {
  const who = await requireAdmin();
  if (!(await isOwner(who))) return { error: 'Only the owners can change the company details.' };
  const r = companyFromForm(f);
  if ('error' in r) return { error: r.error };
  await db.saveCompany(r.company);
  updateTag('company');
  revalidatePath('/admin/company');
  return { ok: 'Saved. Every page shows the new details on its next visit.' };
}
