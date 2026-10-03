import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getEnv } from './cf';
import { atBuild } from './build-cache';
import { COMPANY_DEFAULTS, SOCIALS, type Company } from './site';

/** The company details (Admin → Company): one D1 row (migrations/0008), cached with the tag
 *  'company'. The root layout reads it for every page, so every page carries the tag and a save
 *  (updateTag('company')) re-renders them all on their next visit. The build uses the defaults
 *  (lib/build-cache.ts), like the projects and the team. */

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Stored JSON → a complete Company: missing or wrong-typed fields fall back to the defaults. */
export function normalizeCompany(raw: unknown): Company {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const social = (r.social && typeof r.social === 'object' ? r.social : {}) as Record<string, { url?: unknown; on?: unknown }>;
  const d = COMPANY_DEFAULTS;
  return {
    email: typeof r.email === 'string' ? text(r.email, 254) : d.email,
    showEmail: typeof r.showEmail === 'boolean' ? r.showEmail : d.showEmail,
    whatsapp: text(r.whatsapp, 15).replace(/\D/g, ''),
    whatsappText: text(r.whatsappText, 200) || d.whatsappText,
    legalName: text(r.legalName, 120), city: text(r.city, 80), country: text(r.country, 80), taxId: text(r.taxId, 30),
    social: Object.fromEntries(SOCIALS.map((s) => [s.key, { url: text(social[s.key]?.url, 300), on: social[s.key]?.on === true }])) as Company['social'],
  };
}

/** Straight from D1 (the admin form), or null when there is no row or no database. */
export async function readCompany(): Promise<Company | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;   // never bake local data into a build
  const db = (await getEnv())?.DB;
  if (!db) throw new Error('Company details are temporarily unavailable.');
  try {
    const row = await db.prepare('SELECT data FROM company WHERE id = 1').first<{ data: string }>();
    return row ? normalizeCompany(JSON.parse(row.data)) : null;
  } catch (e) {
    console.error('[company] D1 read failed');
    throw new Error('Company details are temporarily unavailable.', { cause: e });
  }
}

const getCompanyCached = unstable_cache(async () => (await readCompany()) ?? COMPANY_DEFAULTS, ['company'], { tags: ['company'], revalidate: 60 });

/** For pages and layouts. React's cache: one read per request, however many components ask. */
export const getCompany = cache((): Promise<Company> =>
  process.env.NEXT_PHASE === 'phase-production-build' ? atBuild('company', COMPANY_DEFAULTS) : getCompanyCached());

/* ------------------------------------------------------------------ the admin form */
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

/** Admin → Company form → a Company, or the first thing to fix. Links must be https:// on the
 *  network's own domain (never javascript: or another site), the email and number must be real. */
export function companyFromForm(f: FormData): { company: Company } | { error: string } {
  const get = (k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);
  const email = get('email', 254).toLowerCase();
  if (email && !EMAIL.test(email)) return { error: 'The email doesn’t look right, like hello@yourcompany.com.' };
  const showEmail = f.get('showEmail') === 'on';
  if (showEmail && !email) return { error: 'Add the email, or switch “Show on the site” off.' };

  const whatsapp = get('whatsapp', 24).replace(/[\s()+-]/g, '');
  if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) {
    return { error: 'The WhatsApp number is digits with the country code, like 919876543210 (91 for India).' };
  }

  const social = {} as Company['social'];
  for (const s of SOCIALS) {
    const url = get(`social_${s.key}`, 300);
    const on = f.get(`social_${s.key}_on`) === 'on';
    if (url) {
      let host = '';
      try { const u = new URL(url); if (u.protocol === 'https:') host = u.hostname.toLowerCase().replace(/^www\.|^m\./, ''); } catch {}
      if (!host) return { error: `The ${s.label} link must start with https://.` };
      if (!(s.hosts as readonly string[]).some((h) => host === h || host.endsWith(`.${h}`))) {
        return { error: `That ${s.label} link points somewhere else. It should be on ${s.hosts[0]}.` };
      }
    } else if (on) return { error: `Add the ${s.label} link, or switch it off.` };
    social[s.key] = { url, on };
  }

  return {
    company: {
      email, showEmail, whatsapp, whatsappText: get('whatsappText', 200) || COMPANY_DEFAULTS.whatsappText,
      legalName: get('legalName', 120), city: get('city', 80), country: get('country', 80), taxId: get('taxId', 30).toUpperCase(),
      social,
    },
  };
}
