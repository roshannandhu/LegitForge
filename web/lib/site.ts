/** Every business fact the site prints lives here.
 *  The COMPANY details (email, WhatsApp, social links, legal details) are edited in Admin →
 *  Company and stored in D1 (lib/company.ts reads them); COMPANY_DEFAULTS is what a build and a
 *  fresh database start with. Anything marked TODO has a working default but must be confirmed.
 *  No server-only imports: client components import from here too. */

export const SITE = {
  name: 'Legit Forge',
  /** Set at build time by the deploy workflow (scripts/cf-setup.mjs): the real domain once the
   *  SITE_URL repo variable exists, else the Pages address. */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://legitforge.example',
  /** Must stay true — it is printed as a promise (§18.6). */
  replyWithin: '2 hours',
  projectsAtATime: '',                        // e.g. '3'; empty = the sentence is left out
  hours: { days: [1, 2, 3, 4, 5, 6], from: 10, to: 19, timeZone: 'Asia/Kolkata', label: 'Monday to Saturday, 10 a.m. to 7 p.m.' },
} as const;

/** The social networks Admin → Company offers, in footer order. `hosts`: the only domains a link
 *  to that network may point at (checked when saved). */
export const SOCIALS = [
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { key: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'github', label: 'GitHub', hosts: ['github.com'] },
] as const;
export type SocialKey = (typeof SOCIALS)[number]['key'];

export interface Company {
  email: string;
  /** Off: the email is printed nowhere (the legal pages point to WhatsApp instead). */
  showEmail: boolean;
  /** E.164 digits only, e.g. "919876543210". Empty = WhatsApp links fall back to /#contact. */
  whatsapp: string;
  /** The message WhatsApp opens with, when a button doesn't bring its own. */
  whatsappText: string;
  /** Empty = not printed anywhere (footer, legal pages, structured data). */
  legalName: string;
  city: string;
  country: string;
  taxId: string;
  social: Record<SocialKey, { url: string; on: boolean }>;
}

export const COMPANY_DEFAULTS: Company = {
  email: 'hello@legitforge.example',          // TODO: set the real one in Admin → Company
  showEmail: true,
  whatsapp: '',
  whatsappText: "Hi Legit Forge, I'd like to talk about a project.",
  legalName: '',
  city: '',
  country: '',
  taxId: '',
  social: Object.fromEntries(SOCIALS.map((s) => [s.key, { url: '', on: false }])) as Company['social'],
};

/** The temporary address stays out of search until the real domain is live. */
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === '1';

/** The studio's node in structured data: pages point at it by @id instead of repeating it. */
export const ORG_ID = `${SITE.url}/#org`;
export const orgRef = { '@type': 'ProfessionalService', '@id': ORG_ID, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon.svg` };

/** The registered details that are filled in, joined for one line (footer, legal pages). */
export const legalLine = (c: Company, withTaxId = true) =>
  [c.legalName, withTaxId ? c.taxId : '', c.city, c.country].filter(Boolean).join(', ');
/** The team lead's capacity promise, only once the number is set. */
export const capacityLine = () => SITE.projectsAtATime
  ? ` We take ${SITE.projectsAtATime} projects at a time, which is why we can tell you exactly what you’ll get and when.`
  : '';

/** The email to print, or '' when it is empty or switched off. */
export const shownEmail = (c: Company) => (c.showEmail ? c.email : '');

/** The social links that are switched on and filled in, in SOCIALS order. */
export const activeSocial = (c: Company) =>
  SOCIALS.filter((s) => c.social[s.key]?.on && c.social[s.key].url).map((s) => ({ ...s, url: c.social[s.key].url }));

export function waLink(c: Pick<Company, 'whatsapp' | 'whatsappText'>, text: string = c.whatsappText) {
  if (!c.whatsapp) return '/#contact';
  return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(text)}`;
}
