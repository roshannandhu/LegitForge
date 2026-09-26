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
};

async function gh<T>(path: string, o: BriefOptions, raw = false): Promise<{ status: number; data: T | null; text: string }> {
  const { token, apiBase = 'https://api.github.com', fetchImpl = fetch } = o;
  const res = await fetchImpl(`${apiBase}${path}`, {
    headers: {
      accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'user-agent': 'legitforge-admin',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, data: !raw && res.ok ? (JSON.parse(text) as T) : null, text };
}

export class BriefError extends Error {}

/** Reads the repo and writes the brief. Throws BriefError with a message for the owner. */
export async function repoBrief(ref: RepoRef, o: BriefOptions = {}): Promise<Brief> {
  const { token } = o;
  const base = `/repos/${ref.owner}/${ref.repo}`;
  let repo: Awaited<ReturnType<typeof gh<Repo>>>;
  try { repo = await gh<Repo>(base, o); }
  catch { throw new BriefError('Couldn’t reach GitHub. Check the connection and try again.'); }
  if (repo.status === 404 || repo.status === 401) {
    throw new BriefError(token
      ? `GitHub can't find ${ref.owner}/${ref.repo}, or the token can't read it. Check the link and the token's repository access.`
      : `GitHub can't find ${ref.owner}/${ref.repo}. If it is private, add the GITHUB_TOKEN secret (README → Admin).`);
  }
  if (repo.status === 403 || repo.status === 429) throw new BriefError('GitHub is rate-limiting us. Try again in a minute (a GITHUB_TOKEN raises the limit).');
  if (!repo.data) throw new BriefError(`GitHub answered ${repo.status}. Try again in a moment.`);
  const r = repo.data;

  const [langs, readme] = await Promise.all([
    gh<Record<string, number>>(`${base}/languages`, o).catch(() => ({ status: 0, data: null, text: '' })),
    gh<string>(`${base}/readme`, o, true).catch(() => ({ status: 0, data: null, text: '' })),
  ]);
  const md = readme.status === 200 ? readme.text.slice(0, 200_000) : '';
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
