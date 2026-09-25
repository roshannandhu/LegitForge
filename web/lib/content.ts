/** All page copy in one place. Sources: PLAN §6 (sections) and §18 (copy).
 *  [Bracketed] text is a placeholder — the plan forbids launching with any of it. */

/* ------------------------------------------------------------ services §6.3 */
export type DemoKind = 'website' | 'app' | 'whatsapp' | 'n8n';

export const SERVICES: {
  id: DemoKind; name: string; line: string; audience: string; price: string; link: string; href: string; demoLabel: string;
}[] = [
  {
    id: 'website', name: 'Static websites',
    line: 'A fast site that loads in about a second and is easy to update.',
    audience: 'Local businesses, portfolios, launches',
    price: 'From [price]', link: 'See website packages', href: '#pricing',
    demoLabel: 'Demo: a wireframe becomes a finished page, and its speed score reads 99.',
  },
  {
    id: 'app', name: 'Web apps',
    line: 'Bookings, dashboards, member areas and internal tools: software that works with your data.',
    audience: 'Growing businesses',
    price: 'From [price]', link: 'See web app examples', href: '#work',
    demoLabel: 'Demo: a dashboard with a sales chart, three totals and a new booking arriving.',
  },
  {
    id: 'whatsapp', name: 'WhatsApp automation',
    line: 'Answer customers instantly, send order updates and collect leads on WhatsApp.',
    audience: 'Shops, clinics, restaurants, service businesses',
    price: 'From [price]', link: 'See WhatsApp automation', href: '#live-test',
    demoLabel: 'Demo: a WhatsApp bot answers a delivery question and takes an order.',
  },
  {
    id: 'n8n', name: 'n8n workflows',
    line: 'Connect your apps so data moves by itself: forms, sheets, CRM, invoices.',
    audience: 'Teams stuck copying and pasting',
    price: 'From [price]', link: 'See n8n workflows', href: '#process',
    demoLabel: 'Demo: a form entry travels through a sheet, an AI step, WhatsApp and a team alert.',
  },
];

/* ------------------------------------------------------------- process §6.6 */
export const PROCESS = [
  { n: 1, step: 'Talk', when: 'Days 1–2', what: 'A 20-minute call or WhatsApp chat. We write a one-page scope with a fixed price.', get: 'Scope and fixed quote' },
  { n: 2, step: 'Design', when: 'Days 3–7', what: 'A clickable design you can try on your phone. Two rounds of changes included.', get: 'Design link' },
  { n: 3, step: 'Build', when: 'Weeks 2–3', what: 'We build it and send a preview link every week.', get: 'Weekly preview links' },
  { n: 4, step: 'Launch and care', when: 'Weeks 3–4', what: 'We go live, record a training video and fix anything for 30 days. You get every login.', get: 'Your site, your code, your accounts' },
];

/* ------------------------------------------------------------ projects §6.7
   No real work is loaded yet. These are placeholders so the layout can be
   built and reviewed; the admin (§7.8) replaces them. Never publish them. */
export type Stamp = 'live' | 'in-use' | 'none';
export const PROJECTS: {
  slug: string; title: string; client: string; resultValue: string; resultLabel: string;
  tags: string[]; stamp: Stamp; liveUrl?: string; initials: string;
}[] = [
  { slug: 'project-one',   title: '[Project name]', client: '[Bakery in City]',       resultValue: '[+38%]', resultLabel: '[more enquiries in 60 days]', tags: ['Website', 'WhatsApp'], stamp: 'live',   initials: 'P1' },
  { slug: 'project-two',   title: '[Project name]', client: '[Clinic in City]',       resultValue: '[4.2 s]', resultLabel: '[average WhatsApp reply]',    tags: ['WhatsApp', 'n8n'],     stamp: 'in-use', initials: 'P2' },
  { slug: 'project-three', title: '[Project name]', client: '[Appliance dealer]',     resultValue: '[312]', resultLabel: '[warranties issued]',          tags: ['Web app', 'Warranty'], stamp: 'live',   initials: 'P3' },
];

/* ---------------------------------------------------------------- team §6.8 */
/** photo: a square-ish portrait in public/team/, e.g. '/team/member-one.jpg' (about 800px,
 *  same origin). Empty shows the monogram. It appears on every card layer (2D, flip, 3D). */
export const TEAM: { slug: string; idCode: string; name: string; role: string; initials: string;
  photo: string; skills: string[]; shipped: string; favorite: string }[] = [
  { slug: 'member-one', idCode: 'LF-001', name: '[Name]', role: '[Role]', initials: 'N1', photo: '',
    skills: ['Next.js', 'Cloudflare', 'Design systems'], shipped: '[N]', favorite: '[Favourite build]' },
  { slug: 'member-two', idCode: 'LF-002', name: '[Name]', role: '[Role]', initials: 'N2', photo: '',
    skills: ['n8n', 'WhatsApp Cloud API', 'Databases'], shipped: '[N]', favorite: '[Favourite build]' },
];

/* ------------------------------------------------------ hallmarks §6.9/§18.6 */
export const MAKERS_PROMISE = [
  'Fixed price before we start. No surprise invoices.',
  'A preview link every week. You watch it being built.',
  'You own everything — code, domain, WhatsApp number, workflows.',
  '30 days of free fixes after launch.',
];

export const WONT_DO = [
  "We won't take a project we can't finish. If it isn't our strength, we'll say so and name someone better.",
  "We won't disappear after launch. 30 days of fixes are included, in writing.",
  "We won't hold your site hostage. The repo, the domain and the Cloudflare account are yours from day one.",
  "We won't quote a number we can't hold. If the scope grows, we tell you before we do the work, not after.",
];

/** Empty until a client gives written permission (§6.9). The block hides itself when empty. */
export const TESTIMONIALS: { quote: string; name: string; role: string; company: string }[] = [];

/* ------------------------------------------------------------- pricing §6.10 */
export const PRICING = [
  { service: 'Static website', from: '[price]', time: '1–2 weeks', includes: 'Up to 5 pages, contact form, SEO setup, 30 days of fixes' },
  { service: 'Web app', from: '[price]', time: '3–6 weeks', includes: 'Logins, database, admin panel' },
  { service: 'Quotation and warranty system', from: '[price]', time: '3–6 weeks', includes: 'Quotes as links or PDFs, warranty lookup by QR, CSV export any time' },
  { service: 'WhatsApp automation', from: '[price] setup + [price]/month', time: '1–2 weeks', includes: "Bot flows, lead capture, team alerts. Meta's message fees are billed at cost." },
  { service: 'n8n workflow', from: '[price] per workflow', time: '2–5 days', includes: 'Build, testing, documentation, 30 days of fixes' },
];

/* ----------------------------------------------------------------- FAQ §6.10 */
export const FAQ = [
  { q: 'How long does a website take?',
    a: 'A typical five-page website takes two to four weeks from our first call to launch. You see a clickable design in the first week and a preview link every week after that. Bigger projects get their own written plan.' },
  { q: 'Do I own my website, domain and accounts?',
    a: 'Yes. The code, the domain, the hosting account, your WhatsApp number and every workflow are in your name from day one. If you ever leave us, you take everything with you.' },
  { q: 'What does WhatsApp automation cost per month?',
    a: "Two parts: our fee for building and looking after the bot, and Meta's own message fees, which we pass on at cost. From 1 October 2026, Meta charges for replies sent inside the 24-hour customer-service window after the first 1,000 a month per number; incoming messages stay free. We keep conversations short so that bill stays small." },
  { q: 'Is a WhatsApp bot allowed by Meta?',
    a: "Yes, for business bots: support, bookings, orders and FAQs. Since January 2026 Meta doesn't allow general-purpose AI assistants on WhatsApp Business, so ours only talk about your business and hand anything else to a person." },
  { q: 'Can I edit the site myself?',
    a: 'Yes. Static sites come with a simple way to change text and images, and web apps have an admin panel. We record a short training video at launch.' },
  { q: 'Can you build a quotation or warranty system for us?',
    a: 'Yes — it is our own product. Quotes built from saved line items and sent as a link or PDF, and warranty records your customers can check by scanning a code. Expiry reminders go out on WhatsApp automatically.' },
  { q: 'What do you need from me to start?',
    a: "A 20-minute conversation about what you want. After that: your logo, your text if you have it, and access to any accounts we'll connect. We send you a short checklist." },
  { q: 'What happens after launch?',
    a: 'Thirty days of free fixes, in writing. After that, you ask us for changes whenever you need them.' },
  { q: 'There are only two of you. What if one of you is unavailable?',
    a: "Both of us know every project, your code lives in your own repository, and every project ships with notes on how it works. You are never depending on one person's memory." },
  { q: 'Do you use AI to build?',
    a: 'Yes, for some routine code, the same way we use any tool. Every line is read, tested and owned by one of us, and nothing ships that we could not explain to you.' },
];

/* quench §6.11: the form options (NEEDS, BUDGETS) live in lib/lead.ts, next to their
   validator, because the form ships them to the browser and this file must not. */
