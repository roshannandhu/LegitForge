/** Every business fact the site prints lives here.
 *  Anything in [square brackets] is a placeholder (PLAN §0) — replace before launch.
 *  Anything marked TODO has a working default but must be confirmed. */

export const SITE = {
  name: 'Legit Forge',
  url: 'https://legitforge.example',          // TODO: real domain (also update robots/sitemap)
  /** Empty = not printed anywhere (footer, legal pages, structured data) until filled in. */
  city: '',
  country: '',
  legalName: '',
  taxId: '',
  email: 'hello@legitforge.example',          // TODO
  /** E.164 digits only, e.g. "919876543210". Empty = WhatsApp links fall back to /#contact. */
  whatsappNumber: '',
  whatsappText: "Hi Legit Forge, I'd like to talk about a project.",
  /** Must stay true — it is printed as a promise (§18.6). */
  replyWithin: '2 hours',
  projectsAtATime: '',                        // e.g. '3'; empty = the sentence is left out
  hours: { days: [1, 2, 3, 4, 5, 6], from: 10, to: 19, timeZone: 'Asia/Kolkata', label: 'Monday to Saturday, 10 a.m. to 7 p.m.' },
  social: {
    linkedin: '',                              // only accounts we keep active (§6.12)
    github: '',
    instagram: '',
  },
} as const;

/** The studio's node in structured data: pages point at it by @id instead of repeating it. */
export const ORG_ID = `${SITE.url}/#org`;
export const orgRef = { '@type': 'ProfessionalService', '@id': ORG_ID, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon.svg` };

/** The registered details that are filled in, joined for one line (footer, legal pages). */
export const legalLine = (withTaxId = true) =>
  [SITE.legalName, withTaxId ? SITE.taxId : '', SITE.city, SITE.country].filter(Boolean).join(', ');
/** The team lead's capacity promise, only once the number is set. */
export const capacityLine = () => SITE.projectsAtATime
  ? ` We take ${SITE.projectsAtATime} projects at a time, which is why we can tell you exactly what you’ll get and when.`
  : '';

export function waLink(text: string = SITE.whatsappText) {
  if (!SITE.whatsappNumber) return '/#contact';
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
