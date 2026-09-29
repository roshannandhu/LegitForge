import 'server-only';
import { unstable_cache } from 'next/cache';
import { TEAM } from './content';
import { MEMBER_DETAILS } from './pages';
import { getEnv } from './cf';
import { isPh, SHOW_PH } from './placeholder';
import { atBuild } from './build-cache';

/** The team for the public pages (PLAN §7.8): published team_members rows once the admin
 *  has any, otherwise TEAM + MEMBER_DETAILS. Same rules as lib/work.ts: never read during
 *  `next build`, and every page is tagged 'team' so the admin's updateTag re-renders it.
 *
 *  The photo URL carries ?v=<card_version>: "Regenerate ID card" bumps it, so the flip and
 *  3D cards (lib/card-art.ts) load the new photo instead of a cached one. */

/** `path` is the person's public page (see withPaths). */
export type Card = (typeof TEAM)[number] & { path: string };
export type Member = Card & {
  bio: string; tools: string[]; links: { label: string; href: string }[]; cardVersion: number;
};

/** "Roshan Raj M" → "Roshan Raj": the name people search for, without single-letter initials. */
export function shortName(name: string) {
  const short = name.split(/\s+/).filter((w) => w.replace(/\./g, '').length > 1).join(' ');
  return short || name.trim();
}

/** Top-level addresses no name may take: the app/ routes and the public/ folders.
 *  A new top-level route or folder belongs in this list too. */
const RESERVED = new Set(['admin', 'api', 'blog', 'contact', 'media', 'og', 'privacy', 'services', 'team', 'terms',
  'work', 'fonts', 'hero', 'lanyard', 'icon', 'apple-icon', 'opengraph-image', 'twitter-image', 'llms', 'robots',
  'sitemap', 'next', 'cdn-cgi']);

/** "Roshan Raj M" → "roshanraj": a person's address at the root of the site, from their name. */
export const handleFor = (name: string) =>
  isPh(name) ? '' : shortName(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Each person's public page: /<handle> from their name (legitforge.pages.dev/roshanraj), so every
 *  person the admin adds gets a page at their own name. /team/<slug> when the name gives no
 *  handle, a reserved one, or one an earlier person (admin order) already has. /team/<slug>
 *  otherwise redirects to /<handle> (app/team/[slug]/page.tsx). */
function withPaths<T extends { slug: string; name: string }>(people: T[]): (T & { path: string })[] {
  const taken = new Set<string>();
  return people.map((m) => {
    const h = handleFor(m.name);
    const free = !!h && !RESERVED.has(h) && !taken.has(h);
    if (free) taken.add(h);
    return { ...m, path: free ? `/${h}` : `/team/${m.slug}` };
  });
}

const PLACEHOLDERS: Member[] = withPaths(TEAM.map((m) => ({ ...m, ...(MEMBER_DETAILS[m.slug] ?? { bio: '', tools: [], links: [] }), cardVersion: 1 })));
/** No published members yet: nobody (the sections hide), or the placeholders when SHOW_PH. */
const FALLBACK: Member[] = SHOW_PH ? PLACEHOLDERS : [];

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
    // public pages never print [bracketed] placeholders (lib/placeholder.ts): an imported default
    // the owner hasn't filled in yet ("[Role]") shows as empty, and an unnamed person not at all
    const real = (s: string | null | undefined) => (s && !isPh(s) ? s : '');
    const rows = (members.results as Row[]).filter((r) => includeHidden || !isPh(r.name));
    return withPaths(rows.map((r) => ({
      slug: r.slug, idCode: r.id_code, name: r.name, role: includeHidden ? r.role : real(r.role), initials: r.initials || monogram(r.name),
      photo: r.photo_key ? `/media/${r.photo_key}?v=${r.card_version}` : '',
      skills: list(r.skills).filter((s) => includeHidden || !isPh(s)), shipped: String(shipped(r.slug)), favorite: r.favorite ?? '—',
      building: includeHidden ? r.building ?? '' : real(r.building),
      bio: includeHidden ? r.bio : real(r.bio), tools: list(r.tools).filter((s) => includeHidden || !isPh(s)), cardVersion: r.card_version,
      links: ([['LinkedIn', r.linkedin_url], ['GitHub', r.github_url], ['Website', r.website_url]] as const)
        .filter(([, href]) => href).map(([label, href]) => ({ label, href: href! })),
    })));
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

/** During `next build` the placeholders, never D1 or a runtime cache entry (a LOCAL server's test
 *  rows would be baked into production pages), but still tagged (lib/build-cache.ts), so the
 *  admin's updateTag('team') re-renders the prerendered pages. */
export const getTeam: typeof getTeamCached = (...args) =>
  process.env.NEXT_PHASE === 'phase-production-build' ? atBuild('team', FALLBACK) : getTeamCached(...args);

/** Only the fields the card components need: bios and links stay on the server. */
export const toCards = (team: Member[]): Card[] =>
  team.map(({ slug, path, idCode, name, role, initials, photo, skills, shipped, favorite, building }) => ({ slug, path, idCode, name, role, initials, photo, skills, shipped, favorite, building }));

/** Defaults the admin imports as its starting rows. */
export const TEAM_DEFAULTS = PLACEHOLDERS;
