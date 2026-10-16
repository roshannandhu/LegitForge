/** Client-facing service copy. Homepage copy stays in content.ts.
 *  Published work and company settings come from the admin-managed content. */

import type { DemoKind } from './content';

export type ServiceSlug = 'digital-signage' | 'website-development' | 'whatsapp-automation' | 'n8n-automation' | 'seo' | 'nfc';
export type WorkCategory = 'static' | 'dynamic' | 'whatsapp' | 'n8n';

export interface ServicePage {
  slug: ServiceSlug;
  name: string;
  topic: string;
  demo: DemoKind;
  title: string;
  description: string;
  /** Search terms combined with the city from Admin → Company. */
  keywords: string[];
  h1: string;
  lead: string;
  audience: string;
  builds: { h: string; p: string }[];
  /** The two facts in "Quotes and timelines" and on /services: a few words each. */
  price: string;
  timeline: string;
  /** The conditions under the facts, said once per page: what is separate, what moves dates. */
  priceNote: string;
  /** Only what the cards, the price note and the FAQ don't already say. */
  faq: { q: string; a: string }[];
}

const SERVICE_PAGE_CONTENT: ServicePage[] = [
  {
    slug: 'website-development',
    name: 'Websites and web apps',
    topic: 'websites and web apps',
    demo: 'website',
    title: 'Business websites and custom web apps',
    description: 'Business websites, editable content and web apps for bookings, dashboards and customer records. Clear scope, a fixed written quote and 30 days of fixes.',
    keywords: ['website design', 'website development', 'web development company', 'freelance web developer', 'web app development', 'small business website', 'ecommerce website development', 'booking website', 'custom software development'],
    h1: 'A website to bring enquiries. An app to manage the work.',
    lead: 'Show customers what you do, or give your team a better way to handle bookings and records. We help you choose the scope that fits your business.',
    audience: 'Local businesses, portfolios and teams that need a website or a browser-based business tool.',
    builds: [
      { h: 'Business websites', p: 'Service pages, work galleries, contact forms and clear call or WhatsApp actions. A suitable choice when visitors mainly need to understand your business and enquire.' },
      { h: 'Editable websites', p: 'An editor for the content you change regularly: text, images, menus, articles or product lists. We agree which fields your team can manage before building.' },
      { h: 'Web apps', p: 'Bookings, member areas, dashboards and internal tools, with logins, agreed user roles and records your team can manage. Integrations and payment flows are scoped separately.' },
      { h: 'Quotation and warranty systems', p: 'Prepare quotes from saved items, share a link or PDF, and let customers look up warranty records by QR code. Exports, reminders and approval steps are agreed in the scope.' },
    ],
    price: 'Fixed written quote after scoping',
    timeline: 'Websites 1–2 weeks · web apps 3–6 weeks',
    priceNote: 'We quote after discussing your pages, features and integrations, and confirm dates once content and scope are ready. Hosting, paid tools and any ongoing support are agreed separately.',
    faq: [
      { q: 'Can I start with a website and add an app later?', a: 'Yes. We can plan the website around your current needs and discuss later workflows separately. We explain which decisions affect a future addition before agreeing the first build.' },
      { q: 'Can I update the site myself?', a: 'Yes, for the content fields agreed in the scope. Editable websites have an editor; web apps have the relevant admin tools. We provide a short training video at handover.' },
      { q: 'What happens after launch?', a: 'The 30 days of free fixes start at launch. After that, maintenance and new features are quoted when you need them.' },
      { q: 'Will the website rank on Google?', a: 'We include the agreed search basics. Search visibility also depends on your content, location and competition; a new website does not guarantee a ranking. Ongoing SEO can be scoped separately.' },
    ],
  },
  {
    slug: 'whatsapp-automation',
    name: 'WhatsApp automation',
    topic: 'WhatsApp automation',
    demo: 'whatsapp',
    title: 'WhatsApp automation for customer enquiries and bookings',
    description: 'WhatsApp flows for approved answers, enquiries and bookings, with human handoff. Account requirements, integrations and costs agreed before launch.',
    keywords: ['WhatsApp automation', 'WhatsApp chatbot for business', 'WhatsApp Business API', 'WhatsApp auto reply for business', 'AI chatbot for business'],
    h1: 'Help customers take the next step on WhatsApp.',
    lead: 'Answer repeat questions, collect the details your team needs and guide customers through an agreed enquiry or booking flow. Hand conversations to a person when they need individual help.',
    audience: 'Shops, clinics, restaurants and service teams with repeat WhatsApp enquiries.',
    builds: [
      { h: 'Approved answers and menus', p: 'Opening hours, services, delivery areas and other answers you approve, with clear options for the customer. Questions outside the agreed flow lead to a human handoff.' },
      { h: 'Enquiries, orders and bookings', p: 'Collect the fields your business needs and send them to the agreed sheet, CRM or booking system. Confirmations depend on the connected system and its availability.' },
      { h: 'Team handoff and alerts', p: 'Agree who receives an enquiry, where it is recorded and how your team takes over. Alert channels and working hours are part of the setup.' },
      { h: 'Customer updates', p: 'Appointment reminders or order updates using the agreed platform features and approved message content. Consent and opt-out handling are included in the flow design.' },
    ],
    price: 'Fixed written quote for the build',
    timeline: 'Usually 1–2 weeks',
    priceNote: 'The time counts from when scope and account access are ready; account eligibility, verification and message approvals can move the launch date. Ongoing support, platform messaging charges and other paid integrations are separate and explained before you approve.',
    // human handoff is the "Team handoff" card and an FAQ; costs are the price note; each demo
    faq: [
      { q: 'Can I keep my current number?', a: 'We check the options for your current setup and account eligibility before agreeing the work. Depending on those requirements, the integration may use your current number or a separate business number.' },
      { q: 'Can the bot answer everything?', a: 'It handles the approved topics and flows in your scope. Questions outside those flows need a human handoff. AI answers, if included, require their own agreed limits and testing.' },
      { q: 'Is ongoing support compulsory?', a: 'The build and any ongoing support are quoted separately. We agree who looks after answers, platform accounts and connected tools after the included fixes period.' },
    ],
  },
  {
    slug: 'n8n-automation',
    name: 'n8n workflows',
    topic: 'n8n workflows',
    demo: 'n8n',
    title: 'n8n workflows for enquiries, records and routine tasks',
    description: 'Connect forms, sheets, CRMs and other business tools with n8n. Agreed triggers, tested actions, configured failure alerts and clear handover responsibilities.',
    keywords: ['automation agency', 'business automation', 'AI automation for small business', 'AI integration services', 'n8n automation expert', 'workflow automation'],
    h1: 'Connect the tools your team already uses.',
    lead: 'Turn a repeated task into an agreed trigger, action and result: an enquiry becomes a record, a completed job starts an invoice, or a scheduled report reaches your team.',
    audience: 'Teams that repeatedly move information between forms, spreadsheets and business tools.',
    builds: [
      { h: 'Enquiry → customer record', p: 'A form submission starts the workflow, checks the agreed fields and creates or updates a record in your sheet or CRM. Duplicate handling is defined for the records you use.' },
      { h: 'Completed job → invoice or follow-up', p: 'An agreed status change starts the next action, such as preparing an invoice or sending a reminder through a connected account.' },
      { h: 'Schedule → team report', p: 'A scheduled run gathers the agreed figures and sends a summary to your chosen channel. The result depends on access to the source records.' },
      { h: 'Message → assisted draft', p: 'An optional AI step can classify an enquiry, extract fields or prepare a draft. We agree where a person must review the result before it is used.' },
    ],
    price: 'Fixed written quote per workflow',
    timeline: 'Simple workflows 2–5 days',
    priceNote: 'The time counts from when access and example records are ready; more connections or approvals get their own schedule. Hosting, paid app or AI usage and any ongoing support are agreed separately.',
    faq: [
      { q: 'Do I need a new app?', a: 'Usually the goal is to connect your existing tools. We check their connection options and access requirements first; a custom app is only a separate option when the workflow needs one.' },
      { q: 'What happens if a connected service is unavailable?', a: 'The workflow uses the failure handling and alert route agreed for that task. We document how to inspect the failure and retry safely; an unavailable account or service may need your team to intervene.' },
      { q: 'Who maintains it after launch?', a: 'We choose an n8n Cloud account or a server with you during scoping, and the quote names who pays for hosting, keeps credentials valid and handles updates. Thirty days of free fixes are included; further support, workflow changes and third-party account issues are agreed separately.' },
    ],
  },
  {
    slug: 'seo',
    name: 'SEO',
    topic: 'SEO',
    demo: 'seo',
    title: 'Local SEO and Google Business Profile improvements',
    description: 'Local SEO for your listing, website content and search basics. Agreed areas, available reporting and clear next steps, without ranking guarantees.',
    keywords: ['SEO services', 'local SEO', 'Google Business Profile setup', 'rank on Google Maps'],
    h1: 'Make your business easier to find and understand.',
    lead: 'Keep your listing accurate and your website useful for the services and areas you cover. We agree the improvements, track available search activity and explain the next steps.',
    audience: 'Local shops, clinics and service businesses that want clearer listings and useful search-focused pages.',
    builds: [
      { h: 'Listing and website audit', p: 'Review your current business listing, website pages and available search data. Agree the priority fixes and the services or areas to focus on.' },
      { h: 'Google Business Profile improvements', p: 'Update appropriate categories, services, hours, contact details and supplied photos. Prepare a straightforward way to request honest customer reviews.' },
      { h: 'Useful service and area pages', p: 'Explain what you offer, where you work and how to contact you. Improve existing pages or write the additional pages agreed in your scope.' },
      { h: 'Search basics and reporting', p: 'Address agreed title, description, sitemap, indexing and page performance issues. Report available impressions, clicks or contact activity, with the source and next actions explained.' },
    ],
    price: 'Setup and monthly work quoted in writing',
    timeline: 'Initial setup 1–2 weeks',
    priceNote: 'The quote sets the pages, listing work and reporting included, and any monthly work: content updates, listing checks and reports. New pages or locations are agreed before they are added. Setup time counts from when access and content are ready.',
    faq: [
      { q: 'Can you guarantee a ranking?', a: 'No. Search platforms decide the results, which vary with location, competition and other factors. We commit to the agreed work and explain the available measurements.' },
      { q: 'How long until I see a change?', a: 'We agree dates for the work, then review the available data over time. Search platforms may take time to process changes, and the timing or size of an improvement cannot be guaranteed.' },
      { q: 'Do I need a new website?', a: 'Not always. We assess your existing site first and explain whether the agreed fixes can be made there. A replacement website would be a separately scoped decision.' },
    ],
  },
  {
    slug: 'nfc',
    name: 'NFC cards and tags',
    topic: 'NFC cards and tags',
    demo: 'nfc',
    title: 'NFC business cards, review tags and product links',
    description: 'Branded NFC cards and tags for contact pages, honest review requests, menus and warranty lookups. Agreed quantities, tested links and a QR code fallback.',
    keywords: ['NFC business card', 'digital business card', 'Google review NFC card', 'NFC warranty sticker'],
    h1: 'A tap or scan takes customers to the right page.',
    lead: 'Use a card, counter tag or product sticker to open your contact details, menu, review link or warranty page. Agree the design and destination before the physical items are made.',
    audience: 'Sales teams, shops, restaurants and product or service brands that share a useful link in person.',
    builds: [
      { h: 'Business cards', p: 'Open a contact page, WhatsApp link or work gallery. We agree the information displayed and how you will update it later.' },
      { h: 'Review and counter tags', p: 'Take a customer to your Google review page or another agreed destination. The customer chooses their own rating and words.' },
      { h: 'Warranty and service stickers', p: 'Link a product to the agreed warranty lookup or service page. Individual product records and integrations are scoped with the system they connect to.' },
      { h: 'Menus and product links', p: 'Open a menu, catalogue or product page from a table or shelf. A managed destination can be updated later without replacing the physical tag.' },
    ],
    price: 'Fixed written quote per order',
    timeline: 'About a week after artwork approval',
    priceNote: 'The quote covers the physical items and any page or system work; quantity, material, artwork and destination updates are agreed before production. Printing, quantities and delivery can move the date.',
    faq: [
      { q: 'Does tapping work on every phone?', a: 'No. The phone needs compatible NFC support, and its settings, case or the tag’s placement may affect reading. We provide a QR fallback and test the agreed tag setup before handover.' },
      { q: 'Do customers need a special app?', a: 'The tag or QR code opens a normal link in the phone browser. The destination may have its own requirements, such as a login to post a review.' },
      { q: 'Can the link change later?', a: 'Yes, when the tag uses a managed destination agreed in the scope; a tag with a fixed direct link has different limits. We explain how updates work, who makes them and any ongoing arrangement before production.' },
    ],
  },
  {
    slug: 'digital-signage',
    name: 'MR Signage',
    topic: 'MR Signage',
    demo: 'signage',
    title: 'MR Signage for Android TV and tablet screens',
    description: 'Manage Android TV and tablet playlists with MR Signage: screen groups, schedules and playback of downloaded content. Monthly subscription quoted per screen.',
    keywords: ['digital signage software', 'digital signage', 'Android TV signage app', 'tablet signage app', 'digital menu board', 'cloud digital signage subscription'],
    h1: 'Manage your screen playlists from one dashboard.',
    lead: 'MR Signage is our digital signage app with a monthly per-screen subscription. Publish menus, offers and other media to paired Android TVs or tablets, with schedules for each screen or group.',
    audience: 'Shops, restaurants, clinics, branches and businesses that manage advertising screens.',
    builds: [
      { h: 'Playlists and screen groups', p: 'Upload images or videos and choose the playlist for a screen, group or branch. Your content team can manage media from the dashboard.' },
      { h: 'Scheduled content', p: 'Set dates, weekdays and time windows for menus, offers or campaigns. Agree the screen locations and schedules during setup.' },
      { h: 'Downloaded offline playback', p: 'The player can continue scheduled playback of content already downloaded to the device. An internet connection is needed to receive new content and dashboard updates.' },
      { h: 'Advertising and screen status', p: 'Available plan features include advertising slots, playback reports and screen status. We confirm the features and reporting you need in your subscription quote.' },
    ],
    price: 'Monthly subscription per screen',
    timeline: 'First screens typically in a day',
    priceNote: 'The plan confirms screen count, storage, features and support; any hardware and installation work are agreed separately. The day counts from when compatible hardware, internet access and your media are ready; larger rollouts get an agreed schedule.',
    faq: [
      { q: 'Can I use the screens I already have?', a: 'Usually, if they are Android TVs, TV boxes or tablets on Android 8.0 or newer. We check your models, storage and screen placement before agreeing setup; we can discuss hardware options if needed.' },
      { q: 'What happens without internet?', a: 'The player can keep playing content it has already downloaded. New content, schedule changes and remote status need the connection to return; device power, storage and local settings also affect playback.' },
      { q: 'How does the subscription work?', a: 'You pay per screen, per month. The chosen package sets the storage and features included, and the quote explains how to add screens later.' },
      { q: 'Can I sell advertising on the screens?', a: 'Advertising plans, time slots and playback reports are available features. We confirm the plan and report requirements for your screen setup before you subscribe.' },
    ],
  },
];
/** The public service order puts MR Signage last, consistently with the home ledger. */
export const SERVICE_PAGES: ServicePage[] = [
  ...SERVICE_PAGE_CONTENT.filter((s) => s.slug !== 'digital-signage'),
  ...SERVICE_PAGE_CONTENT.filter((s) => s.slug === 'digital-signage'),
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
    bio: 'AI & ML engineer at Legit Forge building fast web applications, intelligent automation, and custom AI integrations for small businesses.',
    tools: ['Next.js', 'TypeScript', 'Cloudflare', 'Figma'],
    links: [],
  },
  'member-two': {
    bio: 'Full stack developer at Legit Forge building dependable web platforms, quotation and warranty systems, and business automation workflows with n8n and WhatsApp Cloud API.',
    tools: ['n8n', 'WhatsApp Cloud API', 'PostgreSQL', 'Google Sheets'],
    links: [],
  },
};
