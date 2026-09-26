import 'server-only';
import { getEnv } from '@/lib/cf';
import type { D1Result } from '@cloudflare/workers-types';
import type { WorkCategory } from '@/lib/pages';

/** D1 queries for the admin (PLAN §7.8). Callers check requireAdmin() first. */

export async function adminDb(): Promise<D1Database> {
  const db = (await getEnv())?.DB;
  if (!db) throw new Error('No D1 binding: run `npm run db:migrate:local` and use `npm run dev` or `npm run preview`.');
  return db;
}

export const CATEGORIES: WorkCategory[] = ['static', 'dynamic', 'whatsapp', 'n8n'];
export const STAMPS = ['live', 'in-use', 'none'] as const;
export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/* ------------------------------------------------------------------ projects */
export interface ProjectRow {
  id: string; slug: string; title: string; client_type: string; category: WorkCategory; summary: string;
  challenge: string | null; result_value: string | null; result_label: string | null; stack: string;
  live_url: string | null; status_stamp: (typeof STAMPS)[number]; tags: string; built: string; results: string;
  team: string; is_featured: number; is_published: number; sort_order: number; launched_on: string | null;
  updated_at: string; image_count?: number; proof_before: string | null; proof_after: string | null;
}
export interface ImageRow {
  id: string; project_id: string; r2_key: string; alt: string; kind: 'cover' | 'gallery' | 'before' | 'after';
  width: number | null; height: number | null; dominant_color: string | null; sort_order: number;
}
export type ProjectInput = Omit<ProjectRow, 'id' | 'is_published' | 'sort_order' | 'updated_at' | 'image_count'>;

export async function listProjects() {
  const db = await adminDb();
  return (await db.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM project_images i WHERE i.project_id = p.id) AS image_count
       FROM projects p ORDER BY p.sort_order, p.created_at`,
  ).all<ProjectRow>()).results;
}

export async function getProjectRow(id: string) {
  return (await adminDb()).prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
}

export async function slugTaken(slug: string, exceptId?: string) {
  const row = await (await adminDb()).prepare('SELECT id FROM projects WHERE slug = ? AND id != ?').bind(slug, exceptId ?? '').first();
  return !!row;
}

export async function createProject(title: string, slug: string) {
  const db = await adminDb();
  const id = crypto.randomUUID();
  const last = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM projects').first<{ m: number }>();
  await db.prepare(
    `INSERT INTO projects (id, slug, title, client_type, category, summary, sort_order) VALUES (?, ?, ?, '', 'static', '', ?)`,
  ).bind(id, slug, title, (last?.m ?? -1) + 1).run();
  return id;
}

export async function updateProject(id: string, v: ProjectInput) {
  await (await adminDb()).prepare(
    `UPDATE projects SET slug = ?, title = ?, client_type = ?, category = ?, summary = ?, challenge = ?,
       result_value = ?, result_label = ?, stack = ?, live_url = ?, status_stamp = ?, tags = ?, built = ?,
       results = ?, team = ?, is_featured = ?, launched_on = ?, proof_before = ?, proof_after = ?, updated_at = datetime('now') WHERE id = ?`,
  ).bind(v.slug, v.title, v.client_type, v.category, v.summary, v.challenge, v.result_value, v.result_label, v.stack,
    v.live_url, v.status_stamp, v.tags, v.built, v.results, v.team, v.is_featured, v.launched_on, v.proof_before, v.proof_after, id).run();
}

export async function setPublished(id: string, published: boolean) {
  await (await adminDb()).prepare(`UPDATE projects SET is_published = ?, updated_at = datetime('now') WHERE id = ?`).bind(published ? 1 : 0, id).run();
}

/** Swap with the neighbour, then renumber 0..n so the order never drifts. */
export async function moveProject(id: string, dir: -1 | 1) {
  const db = await adminDb();
  const ids = (await db.prepare('SELECT id FROM projects ORDER BY sort_order, created_at').all<{ id: string }>()).results.map((r) => r.id);
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await db.batch(ids.map((pid, n) => db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?').bind(n, pid)));
}

export async function deleteProject(id: string) {
  const db = await adminDb();
  const keys = (await db.prepare('SELECT r2_key FROM project_images WHERE project_id = ?').bind(id).all<{ r2_key: string }>()).results;
  await db.batch([
    db.prepare('DELETE FROM project_images WHERE project_id = ?').bind(id),
    db.prepare('DELETE FROM projects WHERE id = ?').bind(id),
  ]);
  return keys.map((k) => k.r2_key);
}

/* ------------------------------------------------------------------ images */
export async function listImages(projectId: string) {
  return (await (await adminDb()).prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY kind = \'cover\' DESC, sort_order')
    .bind(projectId).all<ImageRow>()).results;
}

export async function insertImage(v: Omit<ImageRow, 'id' | 'sort_order'>) {
  const db = await adminDb();
  const id = crypto.randomUUID();
  const last = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m, COUNT(*) AS n FROM project_images WHERE project_id = ?')
    .bind(v.project_id).first<{ m: number; n: number }>();
  const kind = last?.n ? v.kind : 'cover';                      // the first image is the cover
  await db.prepare(
    `INSERT INTO project_images (id, project_id, r2_key, alt, kind, width, height, dominant_color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, v.project_id, v.r2_key, v.alt, kind, v.width, v.height, v.dominant_color, (last?.m ?? -1) + 1).run();
  return id;
}

export async function setCover(projectId: string, imageId: string) {
  const db = await adminDb();
  await db.batch([
    db.prepare(`UPDATE project_images SET kind = 'gallery' WHERE project_id = ? AND kind = 'cover'`).bind(projectId),
    db.prepare(`UPDATE project_images SET kind = 'cover' WHERE project_id = ? AND id = ?`).bind(projectId, imageId),
  ]);
}

export async function deleteImage(projectId: string, imageId: string) {
  const db = await adminDb();
  const row = await db.prepare('SELECT r2_key FROM project_images WHERE id = ? AND project_id = ?').bind(imageId, projectId).first<{ r2_key: string }>();
  await db.prepare('DELETE FROM project_images WHERE id = ? AND project_id = ?').bind(imageId, projectId).run();
  return row?.r2_key ?? null;
}

/* ------------------------------------------------------------------ leads */
export interface LeadRow {
  id: string; source: string; name: string | null; phone: string | null; service: string | null; budget: string | null;
  message: string | null; whatsapp_consent: number; status: LeadStatus; created_at: string;
}

export async function listLeads(status?: LeadStatus) {
  const db = await adminDb();
  const q = status
    ? db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC').bind(status)
    : db.prepare('SELECT * FROM leads ORDER BY created_at DESC');
  return (await q.all<LeadRow>()).results;
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await (await adminDb()).prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, id).run();
}

/* ------------------------------------------------------------------ testimonials */
export interface TestimonialRow {
  id: string; person_name: string; person_role: string | null; company: string | null; quote: string;
  permission_confirmed: number; is_published: number; created_at: string;
}

export async function listTestimonials() {
  return (await (await adminDb()).prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all<TestimonialRow>()).results;
}

export async function saveTestimonial(v: { id?: string; person_name: string; person_role: string | null; company: string | null; quote: string; permission_confirmed: boolean }) {
  const db = await adminDb();
  if (v.id) {
    // withdrawing permission also unpublishes
    await db.prepare(
      `UPDATE testimonials SET person_name = ?, person_role = ?, company = ?, quote = ?, permission_confirmed = ?,
         is_published = CASE WHEN ? = 1 THEN is_published ELSE 0 END WHERE id = ?`,
    ).bind(v.person_name, v.person_role, v.company, v.quote, v.permission_confirmed ? 1 : 0, v.permission_confirmed ? 1 : 0, v.id).run();
    return v.id;
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO testimonials (id, person_name, person_role, company, quote, permission_confirmed) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, v.person_name, v.person_role, v.company, v.quote, v.permission_confirmed ? 1 : 0).run();
  return id;
}

/** Publishing needs the client's written permission (§7.8): refused otherwise. */
export async function setTestimonialPublished(id: string, published: boolean) {
  const db = await adminDb();
  if (published) {
    const row = await db.prepare('SELECT permission_confirmed FROM testimonials WHERE id = ?').bind(id).first<{ permission_confirmed: number }>();
    if (!row?.permission_confirmed) return false;
  }
  await db.prepare('UPDATE testimonials SET is_published = ? WHERE id = ?').bind(published ? 1 : 0, id).run();
  return true;
}

export async function deleteTestimonial(id: string) {
  await (await adminDb()).prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run();
}

/* ------------------------------------------------------------------ site stats */
export const STAT_KEYS = ['projects_live', 'median_reply_minutes', 'last_launch'] as const;

export async function listStats() {
  return (await (await adminDb()).prepare('SELECT key, value, updated_at FROM site_stats ORDER BY key').all<{ key: string; value: string; updated_at: string }>()).results;
}

export async function setStat(key: string, value: string) {
  await (await adminDb()).prepare(
    `INSERT INTO site_stats (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(key, value).run();
}

/* ------------------------------------------------------------------ overview */
export async function overview() {
  const db = await adminDb();
  const [leads, projects, testimonials] = await db.batch<{ a: number; b: number }>([
    db.prepare(`SELECT COUNT(*) AS a, SUM(status = 'new') AS b FROM leads`),
    db.prepare('SELECT COUNT(*) AS a, SUM(is_published) AS b FROM projects'),
    db.prepare('SELECT COUNT(*) AS a, SUM(is_published) AS b FROM testimonials'),
  ]);
  const one = (r: D1Result<{ a: number; b: number }>) => ({ total: r.results[0]?.a ?? 0, sub: r.results[0]?.b ?? 0 });
  return { leads: one(leads), projects: one(projects), testimonials: one(testimonials) };
}

/* ------------------------------------------------------------------ team */
export interface MemberRow {
  id: string; slug: string; name: string; role: string; id_code: string; bio: string; skills: string; tools: string;
  photo_key: string | null; card_version: number; linkedin_url: string | null; github_url: string | null;
  website_url: string | null; favorite_project_id: string | null; is_published: number; sort_order: number; initials: string | null;
  building: string | null;
}

export async function listMembers() {
  return (await (await adminDb()).prepare('SELECT * FROM team_members ORDER BY sort_order, slug').all<MemberRow>()).results;
}

export async function getMember(id: string) {
  return (await adminDb()).prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first<MemberRow>();
}

/** First run: copy the people in lib/content.ts + lib/pages.ts into the table, once. */
export async function importMembers(people: { slug: string; idCode: string; name: string; role: string; initials: string;
  skills: string[]; bio: string; tools: string[]; links: { label: string; href: string }[] }[]) {
  const db = await adminDb();
  const link = (p: (typeof people)[number], label: string) => p.links.find((l) => l.label === label)?.href ?? null;
  await db.batch(people.map((p, i) => db.prepare(
    `INSERT OR IGNORE INTO team_members (id, slug, name, role, id_code, bio, skills, tools, linkedin_url, github_url, website_url, initials, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), p.slug, p.name, p.role, p.idCode, p.bio, JSON.stringify(p.skills), JSON.stringify(p.tools),
    link(p, 'LinkedIn'), link(p, 'GitHub'), link(p, 'Website'), p.initials, i)));
}

export async function updateMember(id: string, v: Pick<MemberRow, 'slug' | 'name' | 'role' | 'id_code' | 'bio' | 'skills' | 'tools' |
  'linkedin_url' | 'github_url' | 'website_url' | 'favorite_project_id' | 'initials' | 'building'>) {
  await (await adminDb()).prepare(
    `UPDATE team_members SET slug = ?, name = ?, role = ?, id_code = ?, bio = ?, skills = ?, tools = ?, linkedin_url = ?,
       github_url = ?, website_url = ?, favorite_project_id = ?, initials = ?, building = ? WHERE id = ?`,
  ).bind(v.slug, v.name, v.role, v.id_code, v.bio, v.skills, v.tools, v.linkedin_url, v.github_url, v.website_url,
    v.favorite_project_id, v.initials, v.building, id).run();
}

export async function memberConflict(id: string, slug: string, idCode: string) {
  return (await adminDb()).prepare('SELECT slug, id_code FROM team_members WHERE id != ? AND (slug = ? OR id_code = ?)')
    .bind(id, slug, idCode).first<{ slug: string; id_code: string }>();
}

export async function setMemberPublished(id: string, published: boolean) {
  await (await adminDb()).prepare('UPDATE team_members SET is_published = ? WHERE id = ?').bind(published ? 1 : 0, id).run();
}

/** "Regenerate ID card": a new card_version changes the photo URL, so every card redraws. */
export async function bumpCard(id: string) {
  await (await adminDb()).prepare('UPDATE team_members SET card_version = card_version + 1 WHERE id = ?').bind(id).run();
}

/** Returns the old key, to delete from R2. */
export async function setMemberPhoto(id: string, key: string | null) {
  const db = await adminDb();
  const old = await db.prepare('SELECT photo_key FROM team_members WHERE id = ?').bind(id).first<{ photo_key: string | null }>();
  await db.prepare('UPDATE team_members SET photo_key = ?, card_version = card_version + 1 WHERE id = ?').bind(key, id).run();
  return old?.photo_key ?? null;
}

export async function publishedProjectTitles() {
  return (await (await adminDb()).prepare('SELECT id, title FROM projects ORDER BY sort_order').all<{ id: string; title: string }>()).results;
}
