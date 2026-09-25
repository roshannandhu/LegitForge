/** Copy for the inner pages (PLAN §3, §7). Home copy stays in content.ts.
 *  Server-only: pages import this; client components get what they need as props.
 *  Style rules: §18.6 — concrete claims we can keep, none of the banned words.
 *  [Bracketed] text is a placeholder and must be replaced before launch. */

import type { DemoKind } from './content';

/* ------------------------------------------------------------ services §7.1 */
export type ServiceSlug = 'website-development' | 'whatsapp-automation' | 'n8n-automation';
export type WorkCategory = 'static' | 'dynamic' | 'whatsapp' | 'n8n';

export interface ServicePage {
  slug: ServiceSlug;
  name: string;               // nav and cards
  topic: string;              // mid-sentence form: "Questions about {topic}"
  demo: DemoKind;
  title: string;              // <title>
  description: string;        // meta description
  h1: string;
  lead: string;
  problem: string[];          // what clients tell us, in their words
  builds: { h: string; p: string }[];
  included: string[];
  price: string;
  timeline: string;
  categories: WorkCategory[]; // which projects count as related
  faq: { q: string; a: string }[];
}

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: 'website-development',
    name: 'Websites and web apps',
    topic: 'websites and web apps',
    demo: 'website',
    title: 'Website development: fast static and dynamic sites',
    description: 'Static websites that load in about a second, and web apps with logins, bookings and dashboards. Fixed quote, weekly previews, you own everything.',
    h1: 'Websites that load in a second, and web apps that run your business',
    lead: 'A static site when your content changes a few times a month. A web app when you need logins, bookings or a dashboard. We tell you which one you need — and when the cheaper one is enough.',
    problem: [
      '“Our site takes forever to open on a phone, and people leave.”',
      '“Only our old developer could change anything, and he stopped replying.”',
      '“We run bookings from a notebook and three WhatsApp groups.”',
    ],
    builds: [
      { h: 'Static websites', p: 'Five to ten pages, built from plain HTML at deploy time and served from Cloudflare’s network. That is why they open in about a second on a normal phone connection. You get a simple editor for text and images.' },
      { h: 'Dynamic websites', p: 'Menus that change daily, a blog, a product list, a “tables free now” counter. Content comes from a small database you edit yourself, and pages still load fast because they are cached until you change something.' },
      { h: 'Web apps', p: 'Logins, bookings, member areas, internal tools and dashboards. Your data lives in a database in your own account, with an admin panel your team can use without us.' },
      { h: 'Quotation and warranty systems', p: 'Our own product. Quotes from saved line items, sent as a link or PDF; warranty records your customers check by scanning a QR code; expiry reminders on WhatsApp.' },
    ],
    included: [
      'A clickable design you can try on your phone before we build',
      'Search basics done properly: titles, descriptions, sitemap, structured data',
      'A contact form that sends every enquiry to you, with spam protection',
      'Hosting set up in your own Cloudflare account',
      'A short training video, and 30 days of free fixes after launch',
    ],
    price: 'Static from [price] · web apps from [price]',
    timeline: 'Static sites 1–2 weeks · web apps 3–6 weeks',
    categories: ['static', 'dynamic'],
    faq: [
      { q: 'Static or dynamic — which do I need?', a: 'If your content changes a few times a month, static: it is cheaper, faster and has less to break. If it changes daily, or people log in, dynamic. We will tell you on the first call, and we will not sell you the bigger one when the smaller one works.' },
      { q: 'Can I update the site myself?', a: 'Yes. Static sites come with a simple editor for text and images; web apps have an admin panel. We record a short video showing how.' },
      { q: 'Will it show up on Google?', a: 'We set up everything search engines read — titles, descriptions, a sitemap, structured data and fast pages. Rankings also depend on your content and competition, so we will not promise a position, and you should be wary of anyone who does.' },
    ],
  },
  {
    slug: 'whatsapp-automation',
    name: 'WhatsApp automation',
    topic: 'WhatsApp automation',
    demo: 'whatsapp',
    title: 'WhatsApp automation for businesses',
    description: 'WhatsApp bots that answer customers, take orders and bookings, and alert your team — on the official WhatsApp Business Platform, with a person one tap away.',
    h1: 'WhatsApp that answers your customers, even at 2 a.m.',
    lead: 'Most of your WhatsApp messages ask the same ten questions. We build a bot on the official WhatsApp Business Platform that answers them instantly, takes orders and bookings, and hands everything else to a person.',
    problem: [
      '“We miss messages at night and lose the order by morning.”',
      '“My staff answer ‘what time do you open?’ fifty times a day.”',
      '“Leads come in on WhatsApp and nobody writes them down.”',
    ],
    builds: [
      { h: 'Answers and menus', p: 'Opening hours, prices, delivery areas, order status — answered in seconds with buttons, not a wall of text. Anything the bot cannot answer goes straight to a person on your team.' },
      { h: 'Orders and bookings', p: 'Customers pick items or a time slot inside WhatsApp. The order lands in your sheet, database or dashboard, and the customer gets a confirmation.' },
      { h: 'Lead capture and alerts', p: 'Every new enquiry is saved with its name and number, and your team gets an alert — so nothing lives only in someone’s phone.' },
      { h: 'Updates and reminders', p: 'Order updates, appointment reminders and warranty expiry notices, sent only to people who agreed to receive them. Anyone can reply STOP.' },
    ],
    included: [
      'Setup on the official WhatsApp Business Platform, on a number you own',
      'Bot flows written with you, in the words your customers use',
      'Hand-off to a person for anything outside the script',
      'Lead capture into your sheet, CRM or database',
      'Monthly care: we watch the bot, fix what breaks and adjust flows',
    ],
    price: '[price] setup + [price]/month · Meta’s message fees at cost',
    timeline: '1–2 weeks, plus Meta’s business verification',
    categories: ['whatsapp'],
    faq: [
      { q: 'Is a WhatsApp bot allowed by Meta?', a: 'Yes, for business bots: support, bookings, orders and FAQs. Since January 2026 Meta does not allow general-purpose AI assistants on WhatsApp Business, so ours only talk about your business and hand anything else to a person.' },
      { q: 'What does it cost per month?', a: 'Two parts: our monthly fee for looking after the bot, and Meta’s own message fees, which we pass on at cost. We keep conversations short so that bill stays small, and you see it itemised.' },
      { q: 'Can I keep my current number?', a: 'Usually yes, but a number on the WhatsApp Business Platform cannot also be used in the normal WhatsApp app. Many businesses use a second number for the bot. We go through the options on the first call.' },
    ],
  },
  {
    slug: 'n8n-automation',
    name: 'n8n workflows',
    topic: 'n8n workflows',
    demo: 'n8n',
    title: 'n8n automation: connect your apps, stop copy-pasting',
    description: 'n8n workflows that move data between your forms, sheets, CRM, invoices and WhatsApp — built, tested and documented, on a server you own.',
    h1: 'n8n automation: connect your apps and stop copy-pasting',
    lead: 'If someone on your team copies data from one app into another every day, that is a workflow. We build it in n8n so the data moves by itself — tested, documented and running on a server you own.',
    problem: [
      '“Every enquiry gets typed into a spreadsheet by hand, eventually.”',
      '“Invoices go out late because someone has to remember.”',
      '“Our tools do not talk to each other, so we do it for them.”',
    ],
    builds: [
      { h: 'Forms to sheets and CRMs', p: 'A website form, a WhatsApp message or an email becomes a clean row in your sheet or CRM, with duplicates caught and your team alerted.' },
      { h: 'Invoices and follow-ups', p: 'A won deal creates the invoice; an unpaid invoice gets a polite reminder on day seven. Nobody has to remember.' },
      { h: 'Reports that arrive on their own', p: 'Yesterday’s orders, this week’s leads, this month’s totals — delivered to WhatsApp or email at the time you choose.' },
      { h: 'AI steps, used carefully', p: 'Sort enquiries, pull details out of an email, draft a reply for a person to check. Always with a human check where a mistake would cost you.' },
    ],
    included: [
      'A map of the workflow, agreed before we build it',
      'Testing with real examples, including the awkward ones',
      'Error alerts: if a step fails, someone hears about it',
      'Plain-language documentation of what runs, when and why',
      'n8n on your own server or n8n Cloud account — you hold the keys',
    ],
    price: 'From [price] per workflow',
    timeline: '2–5 days per workflow',
    categories: ['n8n'],
    faq: [
      { q: 'Why n8n and not Zapier?', a: 'n8n can run on your own server for a flat cost, handles complex logic well, and keeps your data where you choose. For one or two simple steps, Zapier can be fine — we will say so.' },
      { q: 'What happens when a workflow breaks?', a: 'Every workflow sends an alert when a step fails, so it never fails silently. For 30 days after launch we fix it for free; after that, you can keep us on a small monthly care plan.' },
      { q: 'Do I need a server?', a: 'Either a small server in your name (a few dollars a month) or an n8n Cloud account. We set it up; you own it.' },
    ],
  },
];

export const serviceBySlug = (slug: string) => SERVICE_PAGES.find((s) => s.slug === slug);

/* ------------------------------------------------------------ work §7.2 */
export const WORK_FILTERS: { id: 'all' | WorkCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'static', label: 'Static' },
  { id: 'dynamic', label: 'Dynamic' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'n8n', label: 'n8n' },
];

/** Case study detail, keyed by project slug (PROJECTS in content.ts holds the card fields).
 *  Placeholders until the admin (§7.8) serves real projects from D1. */
export const CASE_STUDIES: Record<string, {
  category: WorkCategory;
  challenge: string;
  built: string[];
  results: { value: string; label: string; source: string }[];
  stack: string[];
  team: { slug: string; role: string }[];
}> = {
  'project-one': {
    category: 'static',
    challenge: '[In the client’s words: what was wrong before we started.]',
    built: ['[Feature one]', '[Feature two]', '[Feature three]'],
    results: [{ value: '[+38%]', label: '[more enquiries in 60 days]', source: '[Source: contact form records, Jan–Mar]' }],
    stack: ['Next.js', 'Cloudflare', 'WhatsApp Cloud API'],
    team: [{ slug: 'member-one', role: '[built the site]' }, { slug: 'member-two', role: '[set up the WhatsApp flow]' }],
  },
  'project-two': {
    category: 'whatsapp',
    challenge: '[In the client’s words: what was wrong before we started.]',
    built: ['[Feature one]', '[Feature two]', '[Feature three]'],
    results: [{ value: '[4.2 s]', label: '[average WhatsApp reply]', source: '[Source: WhatsApp Manager, last 30 days]' }],
    stack: ['WhatsApp Cloud API', 'n8n', 'Google Sheets'],
    team: [{ slug: 'member-two', role: '[built the bot and workflows]' }],
  },
  'project-three': {
    category: 'dynamic',
    challenge: '[In the client’s words: what was wrong before we started.]',
    built: ['[Feature one]', '[Feature two]', '[Feature three]'],
    results: [{ value: '[312]', label: '[warranties issued]', source: '[Source: system records, first 6 months]' }],
    stack: ['Next.js', 'Cloudflare D1', 'WhatsApp Cloud API'],
    team: [{ slug: 'member-one', role: '[built the app]' }, { slug: 'member-two', role: '[built the reminders]' }],
  },
};

/* ------------------------------------------------------------- team §7.3 */
export const MEMBER_DETAILS: Record<string, {
  bio: string;
  tools: string[];
  links: { label: string; href: string }[];
}> = {
  'member-one': {
    bio: '[60–120 words, first person: what you build, what you care about, one concrete thing you are proud of.]',
    tools: ['Next.js', 'TypeScript', 'Cloudflare', 'Figma'],
    links: [],
  },
  'member-two': {
    bio: '[60–120 words, first person: what you build, what you care about, one concrete thing you are proud of.]',
    tools: ['n8n', 'WhatsApp Cloud API', 'PostgreSQL', 'Google Sheets'],
    links: [],
  },
};
