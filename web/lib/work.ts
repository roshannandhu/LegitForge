import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Cover, Project } from '@/components/work/project-card';
import { PROJECTS } from './content';
import { CASE_STUDIES, type WorkCategory } from './pages';
import { getEnv } from './cf';

/** Projects for the public pages (PLAN §7.8): published rows from D1 once the admin has
 *  published any, otherwise the placeholders in lib/content.ts + lib/pages.ts. `next build`
 *  has no database, so the build renders the placeholders, and each page is tagged
 *  'projects': the admin's updateTag('projects') re-renders them from D1. */

export type CaseStudy = (typeof CASE_STUDIES)[string];
export type WorkProject = Project & { category: WorkCategory; study: CaseStudy; published: boolean; updatedAt?: string };

const EMPTY: CaseStudy = { category: 'static', challenge: '', built: [], results: [], stack: [], team: [] };

const FALLBACK: WorkProject[] = PROJECTS.map((p) => {
  const study = CASE_STUDIES[p.slug] ?? EMPTY;
  return { ...p, category: study.category, study, published: true };
});

type Row = {
  slug: string; title: string; client_type: string; category: WorkCategory; summary: string;
  challenge: string | null; result_value: string | null; result_label: string | null; stack: string;
  live_url: string | null; status_stamp: 'live' | 'in-use' | 'none'; tags: string; built: string;
  results: string; team: string; is_published: number; updated_at: string;
  proof_before: string | null; proof_after: string | null;
  r2_key: string | null; cover_alt: string | null; width: number | null; height: number | null; dominant_color: string | null;
};

const list = <T,>(json: string | null): T[] => {
  try { const v = JSON.parse(json ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
export const initials = (title: string) =>
  title.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'LF';

function toWork(r: Row): WorkProject {
  const cover: Cover | undefined = r.r2_key && r.width && r.height
    ? { src: `/media/${r.r2_key}`, alt: r.cover_alt ?? '', width: r.width, height: r.height, color: r.dominant_color }
    : undefined;
  return {
    slug: r.slug, title: r.title, client: r.client_type,
    resultValue: r.result_value ?? '', resultLabel: r.result_label ?? '',
    tags: list<string>(r.tags), stamp: r.status_stamp, liveUrl: r.live_url ?? undefined,
    ...(r.proof_before && r.proof_after ? { before: r.proof_before, after: r.proof_after } : {}),
    initials: initials(r.title), cover, category: r.category, published: r.is_published === 1,
    updatedAt: r.updated_at.replace(' ', 'T') + 'Z',          // D1 datetime('now') is UTC
    study: {
      category: r.category, challenge: r.challenge ?? r.summary, built: list(r.built), results: list(r.results),
      stack: list(r.stack), team: list(r.team),
    },
  };
}

/** Every project row with its cover (the image marked cover, else the first). */
export async function projectsFromDb(includeDrafts: boolean): Promise<WorkProject[] | null> {
  // never at build: the dev bindings would bake the LOCAL test database into production pages
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;
  const db = (await getEnv())?.DB;
  if (!db) return null;
  try {
    const { results } = await db.prepare(
      `SELECT p.*, i.r2_key, i.alt AS cover_alt, i.width, i.height, i.dominant_color
         FROM projects p
         LEFT JOIN project_images i ON i.id = (
           SELECT id FROM project_images WHERE project_id = p.id ORDER BY kind = 'cover' DESC, sort_order LIMIT 1)
        ${includeDrafts ? '' : 'WHERE p.is_published = 1'}
        ORDER BY p.sort_order, p.created_at`,
    ).all<Row>();
    return results.map(toWork);
  } catch (e) {
    console.error('[work] D1 read failed, showing the placeholders', e);   // e.g. migrations not applied yet
    return null;
  }
}

const getProjectsCached = unstable_cache(
  async (): Promise<WorkProject[]> => {
    const rows = await projectsFromDb(false);
    return rows && rows.length ? rows : FALLBACK;
  },
  ['work-projects'],
  { tags: ['projects'] },
);

/** During `next build` the placeholders, without touching the cache: .next/cache survives between
 *  builds, and a list cached by a LOCAL server (test rows) would be baked into production pages. */
export const getProjects: typeof getProjectsCached = (...args) =>
  process.env.NEXT_PHASE === 'phase-production-build' ? Promise.resolve(FALLBACK) : getProjectsCached(...args);

export async function getProject(slug: string) {
  return (await getProjects()).find((p) => p.slug === slug);
}

/** For the admin preview: drafts included, never cached. */
export async function getProjectForPreview(slug: string) {
  return (await projectsFromDb(true))?.find((p) => p.slug === slug) ?? FALLBACK.find((p) => p.slug === slug);
}
