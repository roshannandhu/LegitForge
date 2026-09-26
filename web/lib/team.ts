import 'server-only';
import { unstable_cache } from 'next/cache';
import { TEAM } from './content';
import { MEMBER_DETAILS } from './pages';
import { getEnv } from './cf';

/** The team for the public pages (PLAN §7.8): published team_members rows once the admin
 *  has any, otherwise TEAM + MEMBER_DETAILS. Same rules as lib/work.ts: never read during
 *  `next build`, and every page is tagged 'team' so the admin's updateTag re-renders it.
 *
 *  The photo URL carries ?v=<card_version>: "Regenerate ID card" bumps it, so the flip and
 *  3D cards (lib/card-art.ts) load the new photo instead of a cached one. */

export type Card = (typeof TEAM)[number];
export type Member = Card & {
  bio: string; tools: string[]; links: { label: string; href: string }[]; cardVersion: number;
};

const FALLBACK: Member[] = TEAM.map((m) => ({ ...m, ...(MEMBER_DETAILS[m.slug] ?? { bio: '', tools: [], links: [] }), cardVersion: 1 }));

type Row = {
  slug: string; name: string; role: string; id_code: string; bio: string; skills: string; tools: string;
  photo_key: string | null; card_version: number; linkedin_url: string | null; github_url: string | null;
  website_url: string | null; initials: string | null; favorite: string | null; building: string | null;
};
const list = (json: string) => { try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
const monogram = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'LF';

export async function teamFromDb(includeHidden: boolean): Promise<Member[] | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;
  const db = (await getEnv())?.DB;
  if (!db) return null;
  try {
    const [members, projects] = await db.batch([
      db.prepare(
        `SELECT m.*, p.title AS favorite FROM team_members m LEFT JOIN projects p ON p.id = m.favorite_project_id AND p.is_published = 1
          ${includeHidden ? '' : 'WHERE m.is_published = 1'} ORDER BY m.sort_order, m.slug`),
      db.prepare('SELECT team FROM projects WHERE is_published = 1'),
    ]);
    const shipped = (slug: string) => (projects.results as { team: string }[])
      .filter((p) => { try { return (JSON.parse(p.team) as { slug: string }[]).some((t) => t.slug === slug); } catch { return false; } }).length;
    return (members.results as Row[]).map((r) => ({
      slug: r.slug, idCode: r.id_code, name: r.name, role: r.role, initials: r.initials || monogram(r.name),
      photo: r.photo_key ? `/media/${r.photo_key}?v=${r.card_version}` : '',
      skills: list(r.skills), shipped: String(shipped(r.slug)), favorite: r.favorite ?? '—', building: r.building ?? '',
      bio: r.bio, tools: list(r.tools), cardVersion: r.card_version,
      links: ([['LinkedIn', r.linkedin_url], ['GitHub', r.github_url], ['Website', r.website_url]] as const)
        .filter(([, href]) => href).map(([label, href]) => ({ label, href: href! })),
    }));
  } catch (e) {
    console.error('[team] D1 read failed, showing the defaults', e);
    return null;
  }
}

const getTeamCached = unstable_cache(
  async (): Promise<Member[]> => {
    const rows = await teamFromDb(false);
    return rows && rows.length ? rows : FALLBACK;
  },
  ['team-members'],
  { tags: ['team'] },
);

/** During `next build` the placeholders, without touching the cache: .next/cache survives between
 *  builds, and a list cached by a LOCAL server (test rows) would be baked into production pages. */
export const getTeam: typeof getTeamCached = (...args) =>
  process.env.NEXT_PHASE === 'phase-production-build' ? Promise.resolve(FALLBACK) : getTeamCached(...args);

/** Only the fields the card components need: bios and links stay on the server. */
export const toCards = (team: Member[]): Card[] =>
  team.map(({ slug, idCode, name, role, initials, photo, skills, shipped, favorite, building }) => ({ slug, idCode, name, role, initials, photo, skills, shipped, favorite, building }));

/** Defaults the admin imports as its starting rows. */
export const TEAM_DEFAULTS = FALLBACK;
