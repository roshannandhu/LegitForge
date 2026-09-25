/** Every business fact the site prints lives here.
 *  Anything in [square brackets] is a placeholder (PLAN §0) — replace before launch.
 *  Anything marked TODO has a working default but must be confirmed. */

export const SITE = {
  name: 'Legit Forge',
  url: 'https://legitforge.example',          // TODO: real domain (also update robots/sitemap)
  city: '[City]',
  country: '[Country]',
  legalName: '[Registered business name]',
  taxId: '[registration or tax number]',
  email: 'hello@legitforge.example',          // TODO
  /** E.164 digits only, e.g. "919876543210". Empty = WhatsApp links fall back to /#contact. */
  whatsappNumber: '',
  whatsappText: "Hi Legit Forge, I'd like to talk about a project.",
  /** Must stay true — it is printed as a promise (§18.6). */
  replyWithin: '2 hours',
  projectsAtATime: '[3]',
  hours: { days: [1, 2, 3, 4, 5, 6], from: 10, to: 19, timeZone: 'Asia/Kolkata', label: 'Monday to Saturday, 10 a.m. to 7 p.m.' },
  social: {
    linkedin: '',                              // only accounts we keep active (§6.12)
    github: '',
    instagram: '',
  },
} as const;

export function waLink(text: string = SITE.whatsappText) {
  if (!SITE.whatsappNumber) return '/#contact';
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export const isExternal = (href: string) => href.startsWith('http');
