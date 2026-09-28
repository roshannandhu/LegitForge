/** "Add from GitHub" (Admin → Projects): one repo link becomes a draft project brief, from
 *  GitHub's own data only (no AI, no cost). The repo's description, README, languages, topics
 *  and homepage fill the fields the owner would otherwise type; numbers (results, before and
 *  after) are never invented and stay empty for the owner. Private repos need GITHUB_TOKEN
 *  (a fine-grained, read-only token), set as a Worker secret. */

import type { WorkCategory } from '@/lib/pages';

export type RepoRef = { owner: string; repo: string };

export interface Brief {
  title: string;
  slugBase: string;
  summary: string;
  challenge: string | null;
  built: string[];
  stack: string[];
  tags: string[];
  category: WorkCategory;
  liveUrl: string | null;
  launchedOn: string | null;
  repoUrl: string;
}

/** Any GitHub repo URL (https, www, .git, /tree/…, owner/repo) → { owner, repo }, or null. */
export function parseRepo(input: string): RepoRef | null {
  const s = input.trim().replace(/^git@github\.com:/i, 'https://github.com/');
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#].*)?$/i.exec(s)
    ?? /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(s);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/* ---------------------------------------------------------------- markdown helpers */

/** Markdown/HTML → plain text: no badges, images, links (keeps their words), code, emphasis. */
export function plain(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                    // images and badges
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                  // links keep their text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(\S[^*_~]*?)\1/g, '$2')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Top-level blocks of a README, with the heading each sits under. */
function blocks(md: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  let heading = '';
  for (const raw of md.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = raw.split('\n');
    const h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[0]);
    if (h) {
      heading = plain(h[1]);
      const rest = lines.slice(1).join('\n').trim();
      if (rest) out.push({ heading, text: rest });
      continue;
    }
    out.push({ heading, text: raw.trim() });
  }
  return out;
}

const isList = (t: string) => /^\s*([-*+]|\d+[.)])\s+/m.test(t);
const isTable = (t: string) => /^\s*\|/.test(t);

/** First prose paragraph (not a list, table, badge row or one-liner), optionally under a heading. */
function firstParagraph(md: string, under?: RegExp): string | null {
  for (const b of blocks(md)) {
    if (under && !under.test(b.heading)) continue;
    if (isList(b.text) || isTable(b.text)) continue;
    const t = plain(b.text).replace(/\s*\n\s*/g, ' ');
    if (t.length >= 40 && /[a-z]/.test(t)) return t;
  }
  return null;
}

/** Bullet items under a matching heading. */
function bullets(md: string, under: RegExp, max = 6): string[] {
  const items: string[] = [];
  for (const b of blocks(md)) {
    if (!under.test(b.heading) || !isList(b.text)) continue;
    for (const l of b.text.split('\n')) {
      const m = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.+)$/.exec(l);
      if (!m) continue;
      const t = plain(m[1]).replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s:–—-]+/u, '').trim();
      if (t.length >= 3) items.push(t.length > 110 ? t.slice(0, 107).trimEnd() + '…' : t);
      if (items.length >= max) return items;
    }
  }
  return items;
}

/** Cut to a sentence boundary under `max` characters. */
export function clip(text: string, max = 300): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')).trimEnd() + '…';
}

const ACRONYMS = new Set(['wa', 'ai', 'ui', 'ux', 'api', 'seo', 'nfc', 'crm', 'erp', 'pos', 'sms', 'qr', 'cms', 'pwa', 'b2b', 'ev', 'hr']);
const titleCase = (name: string) =>
  name.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project';

/* ---------------------------------------------------------------- the site's words */

// frameworks and tools worth naming in "Stack" when they appear as topics or in the README
const TOOLS: [RegExp, string][] = [
  [/\bnext(\.?js)?\b/i, 'Next.js'], [/\breact\b/i, 'React'], [/\bvue\b/i, 'Vue'], [/\bsvelte\b/i, 'Svelte'],
  [/\bastro\b/i, 'Astro'], [/\btailwind/i, 'Tailwind CSS'], [/\bnode(\.?js)?\b/i, 'Node.js'], [/\bexpress\b/i, 'Express'],
  [/\bdjango\b/i, 'Django'], [/\bflask\b/i, 'Flask'], [/\blaravel\b/i, 'Laravel'], [/\bsupabase\b/i, 'Supabase'],
  [/\bfirebase\b/i, 'Firebase'], [/\bpostgres(ql)?\b/i, 'PostgreSQL'], [/\bmysql\b/i, 'MySQL'], [/\bmongo(db)?\b/i, 'MongoDB'],
  [/\bprisma\b/i, 'Prisma'], [/\bcloudflare\b/i, 'Cloudflare'], [/\bvercel\b/i, 'Vercel'], [/\bn8n\b/i, 'n8n'],
  [/\bwhatsapp\b/i, 'WhatsApp Cloud API'], [/\bstripe\b/i, 'Stripe'], [/\brazorpay\b/i, 'Razorpay'], [/\bwordpress\b/i, 'WordPress'],
];

const SIGNALS = {
  whatsapp: /\bwhats\s?app\b|\bwa\s?bot\b|\bwaba\b/i,
  n8n: /\bn8n\b|\bworkflow automation\b|\bzapier\b|\bmake\.com\b/i,
  app: /\bdashboard\b|\badmin panel\b|\blog ?in\b|\bauth(entication)?\b|\bdatabase\b|\bcrud\b|\bapi\b|\bbackend\b|\bsupabase\b|\bfirebase\b|\bprisma\b|\bpostgres|\bmysql\b|\bmongo/i,
  seo: /\bseo\b|\bsearch engine\b|\bgoogle business\b/i,
  nfc: /\bnfc\b/i,
  quote: /\bquot(e|ation)s?\b|\binvoice/i,
  warranty: /\bwarrant(y|ies)\b/i,
};

/* ---------------------------------------------------------------- GitHub */

type Repo = { name: string; full_name: string; description: string | null; homepage: string | null; topics?: string[];
  language: string | null; created_at: string; private: boolean; html_url: string };

export type BriefOptions = {
  token?: string;
  /** tests only: a fixture server instead of GitHub */
  apiBase?: string;
  fetchImpl?: typeof fetch;
  /** in the admin's browser: only CORS-safelisted headers (no preflight), never a token */
  browser?: boolean;
};

/** What the brief is written from: the three GitHub answers. */
export type RepoData = { repo: Repo; languages: Record<string, number> | null; readme: string };

async function gh<T>(path: string, o: BriefOptions, raw = false): Promise<{ status: number; data: T | null; text: string }> {
  const { token, apiBase = 'https://api.github.com', fetchImpl = fetch, browser } = o;
  const accept = raw ? 'application/vnd.github.raw' : 'application/vnd.github+json';
  const res = await fetchImpl(`${apiBase}${path}`, {
    headers: browser ? { accept } : {
      accept,
      'user-agent': 'legitforge-admin',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, data: !raw && res.ok ? (JSON.parse(text) as T) : null, text };
}

/** A message for the owner. `nameOnly`: the repo can't be read, so offer "Create from the name only". */
export class BriefError extends Error {
  nameOnly: boolean;
  constructor(message: string, nameOnly = false) { super(message); this.nameOnly = nameOnly; }
}
/** The API is out of requests (403/429) or unreachable. Never shown: the caller reads the repo page. */
class ApiBusy extends BriefError {}

/** Reads the repo and writes the brief (server). Throws BriefError with a message for the owner. */
export async function repoBrief(ref: RepoRef, o: BriefOptions = {}): Promise<Brief> {
  return briefFrom(await serverRepoData(ref, o));
}

/** On the server: the API only with GITHUB_TOKEN (5,000 an hour; private repos too), else
 *  GitHub's public repo page (fetchRepoPage), which the API's hourly limit doesn't cover. Without
 *  a token the API allows 60 an hour PER IP, and the Worker's IPs are shared by every Cloudflare
 *  customer (and a phone's by everyone on its mobile network), so the API is usually out: never
 *  make the owner wait for it. */
export async function serverRepoData(ref: RepoRef, o: BriefOptions = {}): Promise<RepoData> {
  if (o.token || o.apiBase) {
    try { return await fetchRepoData(ref, o); }
    catch (e) { if (!(e instanceof ApiBusy)) throw e; }
  }
  let page: RepoData | null;
  try { page = await fetchRepoPage(ref, o.fetchImpl); }
  catch { throw new BriefError('GitHub didn’t answer just now. Try again, or create the project from its name and fill in the rest.', true); }
  if (!page) throw new BriefError(`GitHub shows no public repository at ${ref.owner}/${ref.repo}: it is private, or the link is wrong. Make it public on GitHub and try again, or create the project from its name and fill in the rest.`, true);
  return page;
}

/** A public repo without the API: the repo page's own data (the embedded JSON GitHub's page is
 *  built from: description, website, topics, created date, README file name) and the raw README
 *  (raw.githubusercontent.com). Neither counts against the API's hourly limit. No languages
 *  there: the stack comes from the topics and the README. null when GitHub has no public repo
 *  at that address (private or missing); throws when the page can't be read. Server only:
 *  github.com sends no CORS headers. */
export async function fetchRepoPage(ref: RepoRef, fetchImpl: typeof fetch = fetch): Promise<RepoData | null> {
  const res = await fetchImpl(`https://github.com/${ref.owner}/${ref.repo}`, {
    headers: { accept: 'text/html', 'user-agent': 'legitforge-admin' }, cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github.com answered ${res.status}`);
  const json = /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/.exec(await res.text())?.[1];
  const p = json ? (JSON.parse(json) as { payload?: Record<string, any> }).payload : null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const about = p?.sidebarAbout, r = p?.codeViewLayoutRoute?.repo;
  const name = str(r?.name, 100), owner = str(r?.ownerLogin, 39);
  if (!about || !name || !owner) throw new Error('GitHub’s page has changed');
  if (r.private === true || about.repo?.isPrivate === true) return null;

  const files: unknown[] = Array.isArray(p?.codeViewRepoRoute?.tree?.items) ? p.codeViewRepoRoute.tree.items : [];
  const readmeName = files.map((i) => str((i as { name?: unknown })?.name, 100)).find((n) => n && /^readme(\.(md|markdown|mdx|txt))?$/i.test(n));
  const readme = readmeName
    ? await fetchImpl(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/${encodeURIComponent(readmeName)}`, { cache: 'no-store' })
        .then((x) => (x.ok ? x.text() : '')).catch(() => '')
    : '';
  const topics = Array.isArray(about.topics) ? about.topics.map((t: { name?: unknown }) => str(t?.name, 50)).filter(Boolean).slice(0, 20) as string[] : [];
  return {
    repo: {
      name, full_name: `${owner}/${name}`, html_url: `https://github.com/${owner}/${name}`, private: false,
      description: str(about.description, 1000), homepage: str(about.website, 300), topics, language: null,
      created_at: str(r.createdAt, 40) ?? '',
    },
    languages: null,
    readme: readme.slice(0, 200_000),
  };
}

/** When GitHub can't be read (a private repo): a brief from the link alone, for the owner to fill in. */
export const nameOnly = (ref: RepoRef): RepoData => ({
  repo: { name: ref.repo, full_name: `${ref.owner}/${ref.repo}`, html_url: `https://github.com/${ref.owner}/${ref.repo}`,
    description: null, homepage: null, topics: [], language: null, created_at: '', private: true },
  languages: null,
  readme: '',
});

/** The three GitHub API answers for a repo: in the admin's browser (public repos; its own
 *  connection may still have API requests left, and the API adds the languages), or on the server
 *  with GITHUB_TOKEN (serverRepoData). Throws BriefError; ApiBusy when the API is out or down. */
export async function fetchRepoData(ref: RepoRef, o: BriefOptions = {}): Promise<RepoData> {
  const { token } = o;
  const base = `/repos/${ref.owner}/${ref.repo}`;
  let repo: Awaited<ReturnType<typeof gh<Repo>>>;
  try { repo = await gh<Repo>(base, o); }
  catch { throw new ApiBusy('GitHub’s API is unreachable.'); }
  if (repo.status === 404 || repo.status === 401) {
    throw new BriefError(token
      ? `GitHub can't find ${ref.owner}/${ref.repo}, or the token can't read it. Check the link and the token's repository access, or create the project from its name and fill in the rest.`
      : `GitHub can't find ${ref.owner}/${ref.repo}: it is private, or the link is wrong.`, true);
  }
  if (repo.status === 403 || repo.status === 429 || repo.status >= 500) throw new ApiBusy(`GitHub’s API answered ${repo.status}.`);
  if (!repo.data) throw new ApiBusy(`GitHub’s API answered ${repo.status}.`);

  const [langs, readme] = await Promise.all([
    gh<Record<string, number>>(`${base}/languages`, o).catch(() => ({ status: 0, data: null, text: '' })),
    gh<string>(`${base}/readme`, o, true).catch(() => ({ status: 0, data: null, text: '' })),
  ]);
  return { repo: repo.data, languages: langs.data, readme: readme.status === 200 ? readme.text.slice(0, 200_000) : '' };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);

/** RepoData the admin's browser fetched (JSON), checked before the server uses it: the right repo,
 *  the right types, bounded sizes. null when it doesn't hold up (the server then fetches itself). */
export function repoDataFrom(json: string, ref: RepoRef): RepoData | null {
  try {
    const d = JSON.parse(json) as { repo?: Record<string, unknown>; languages?: unknown; readme?: unknown };
    const r = d.repo;
    if (!r || typeof r !== 'object') return null;
    const full = str(r.full_name, 200), html = str(r.html_url, 300), name = str(r.name, 100), created = str(r.created_at, 40);
    if (!full || full.toLowerCase() !== `${ref.owner}/${ref.repo}`.toLowerCase()) return null;
    if (!html?.startsWith('https://github.com/') || !name || !created) return null;
    const langs = d.languages && typeof d.languages === 'object' && !Array.isArray(d.languages)
      ? Object.fromEntries(Object.entries(d.languages as Record<string, unknown>).slice(0, 50)
          .filter((e): e is [string, number] => typeof e[1] === 'number').map(([k, v]) => [k.slice(0, 40), v]))
      : null;
    return {
      repo: {
        name, full_name: full, html_url: html, created_at: created, private: r.private === true,
        description: str(r.description, 1000), homepage: str(r.homepage, 300), language: str(r.language, 40),
        topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === 'string').slice(0, 20).map((t) => t.slice(0, 50)) : [],
      },
      languages: langs,
      readme: typeof d.readme === 'string' ? d.readme.slice(0, 200_000) : '',
    };
  } catch {
    return null;
  }
}

/** Writes the brief from the repo's data (no network). */
export function briefFrom({ repo: r, languages, readme }: RepoData): Brief {
  const langs = { data: languages };
  const md = readme;
  const topics = r.topics ?? [];
  const haystack = [r.description ?? '', topics.join(' '), md.slice(0, 20_000)].join('\n');

  // title: the README's first heading when it is a real name, else the repo name, title-cased
  const h1 = /^\s{0,3}#\s+(.+?)\s*#*\s*$/m.exec(md)?.[1];
  const h1Text = h1 ? plain(h1).replace(/[^\p{L}\p{N}\s&'’.,:-]/gu, '').trim() : '';
  const title = h1Text && h1Text.length <= 60 && slugify(h1Text) !== slugify(r.name) ? h1Text : titleCase(r.name);

  const summary = clip(plain(r.description ?? '') || firstParagraph(md) || `${title}: a project by Legit Forge.`, 300);
  const challengeText = firstParagraph(md, /problem|why|background|about|overview|motivation|introduction/i);
  const challenge = challengeText && challengeText !== summary ? clip(challengeText, 400) : null;
  const built = bullets(md, /feature|what it does|highlights|functionality|capabilit/i);

  const byBytes = Object.entries(langs.data ?? {}).sort((a, b) => b[1] - a[1]).map(([l]) => l)
    .filter((l) => !/^(Dockerfile|Makefile|Shell|Batchfile|PowerShell|Procfile)$/.test(l)).slice(0, 5);
  const tools = TOOLS.filter(([re]) => re.test(topics.join(' ')) || re.test(md.slice(0, 20_000))).map(([, n]) => n);
  const stack = [...new Set([...tools, ...byBytes])].slice(0, 8);

  const has = (k: keyof typeof SIGNALS) => SIGNALS[k].test(haystack);
  const tags: string[] = [];
  if (has('whatsapp')) tags.push('WhatsApp');
  if (has('n8n')) tags.push('n8n');
  if (has('app')) tags.push('Web app');
  if (has('seo')) tags.push('SEO');
  if (has('nfc')) tags.push('NFC');
  if (has('quote')) tags.push('Quote');
  if (has('warranty')) tags.push('Warranty');
  if (!tags.includes('Web app') && (r.homepage || /\bwebsite\b|\blanding page\b|\bsite\b/i.test(haystack))) tags.unshift('Website');
  if (!tags.length) tags.push('Website');

  // the category is what the project IS, so it reads only the name, description and topics
  // (a README that mentions a WhatsApp order form doesn't make a bakery site a WhatsApp bot)
  const core = [r.name, r.description ?? '', topics.join(' ')].join(' ');
  const category: WorkCategory = SIGNALS.whatsapp.test(core) ? 'whatsapp' : SIGNALS.n8n.test(core) ? 'n8n'
    : tags.includes('Web app') ? 'dynamic' : 'static';
  const liveUrl = r.homepage && /^https:\/\/\S+$/.test(r.homepage.trim()) ? r.homepage.trim() : null;

  return {
    title, slugBase: slugify(title), summary, challenge, built, stack, tags: tags.slice(0, 4), category, liveUrl,
    launchedOn: r.created_at ? r.created_at.slice(0, 10) : null, repoUrl: r.html_url,
  };
}
