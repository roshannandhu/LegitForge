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
  problem: string[];          // fit statements, never fictional customer quotations
  builds: { h: string; p: string }[];
  included: string[];
  price: string;
  timeline: string;
  preparation: string[];
  details: { h: string; p: string }[];
  categories: WorkCategory[];
  serviceTags: string[];      // related work requires matching recorded project tags
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
    problem: [
      'Present your services and make it easy to contact you.',
      'Update products, menus or articles without asking a developer each time.',
      'Manage bookings, customer records or team tasks in one place.',
    ],
    builds: [
      { h: 'Business websites', p: 'Service pages, work galleries, contact forms and clear call or WhatsApp actions. A suitable choice when visitors mainly need to understand your business and enquire.' },
      { h: 'Editable websites', p: 'An editor for the content you change regularly: text, images, menus, articles or product lists. We agree which fields your team can manage before building.' },
      { h: 'Web apps', p: 'Bookings, member areas, dashboards and internal tools, with logins, agreed user roles and records your team can manage. Integrations and payment flows are scoped separately.' },
      { h: 'Quotation and warranty systems', p: 'Prepare quotes from saved items, share a link or PDF, and let customers look up warranty records by QR code. Exports, reminders and approval steps are agreed in the scope.' },
    ],
    included: [
      'A clickable design to review on your phone before the build',
      'The agreed pages, content editor or app workflows, tested on phone and desktop',
      'Website search basics: titles, descriptions and sitemap, with suitable structured data',
      'Enquiry handling and spam protection where a form is included',
      'Account handover, a short training video and 30 days of free fixes after launch',
    ],
    price: 'A fixed written quote after discussing pages, features and integrations. Hosting, paid tools and any ongoing support are agreed separately.',
    timeline: 'Typical build: websites 1–2 weeks; web apps 3–6 weeks. The written plan confirms dates after content and scope are ready.',
    preparation: [
      'Your logo, business details, service text and images, or a list of content you need help preparing',
      'The pages or workflows you need, and examples of the records your team handles',
      'Access to your domain and any accounts the agreed build will connect',
    ],
    details: [
      { h: 'Choosing a website or an app', p: 'A website helps visitors evaluate and contact your business. An app adds tasks such as booking a slot, updating a record or viewing a private dashboard. We agree the user journey first, then choose the appropriate build.' },
      { h: 'Roles, data and integrations', p: 'We define who can view, edit or approve records, what data is required, and which existing tools need to connect. Payment providers, messaging accounts, data imports and backup arrangements belong in the written scope.' },
      { h: 'Content and later changes', p: 'We identify the content your team can edit and show you how at handover. A new feature or a change in scope gets its own quote; the included 30-day period covers fixes after launch.' },
      { h: 'Quotation and warranty options', p: 'Choose the quote fields, line items, approval stages and warranty lookup information your business needs. Quote and warranty records can be exported as CSV. Reminder channels, hosting, support and account arrangements are confirmed in the written quote.' },
    ],
    categories: ['static', 'dynamic'],
    serviceTags: ['website', 'websites', 'static website', 'dynamic website', 'website development', 'website-development', 'web design', 'web app', 'web apps', 'webapp', 'quotation', 'warranty'],
    faq: [
      { q: 'Can I start with a website and add an app later?', a: 'Yes. We can plan the website around your current needs and discuss later workflows separately. We explain which decisions affect a future addition before agreeing the first build.' },
      { q: 'Can I update the site myself?', a: 'Yes, for the content fields agreed in the scope. Editable websites have an editor; web apps have the relevant admin tools. We provide a short training video at handover.' },
      { q: 'What happens after launch?', a: 'You receive 30 days of free fixes, in writing. Hosting, paid services, maintenance and later feature work are discussed separately, so the quote makes those responsibilities clear.' },
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
    problem: [
      'Provide consistent answers to common questions.',
      'Collect enquiry or booking details before your team follows up.',
      'Connect agreed customer updates with your existing tools.',
    ],
    builds: [
      { h: 'Approved answers and menus', p: 'Opening hours, services, delivery areas and other answers you approve, with clear options for the customer. Questions outside the agreed flow lead to a human handoff.' },
      { h: 'Enquiries, orders and bookings', p: 'Collect the fields your business needs and send them to the agreed sheet, CRM or booking system. Confirmations depend on the connected system and its availability.' },
      { h: 'Team handoff and alerts', p: 'Agree who receives an enquiry, where it is recorded and how your team takes over. Alert channels and working hours are part of the setup.' },
      { h: 'Customer updates', p: 'Appointment reminders or order updates using the agreed platform features and approved message content. Consent and opt-out handling are included in the flow design.' },
    ],
    included: [
      'An account and number eligibility check for the official WhatsApp Business Platform',
      'A written flow with answers and messages approved by you',
      'The agreed data destination and human handoff route',
      'Testing of the scoped flows and connected accounts before launch',
      'Handover notes and 30 days of free fixes after launch',
    ],
    price: 'The build and any ongoing support are quoted in writing. Platform messaging charges and other paid integrations are separate and explained before approval.',
    timeline: 'Typical build: 1–2 weeks after scope and access are ready. Account eligibility, verification and message approvals can affect the launch date.',
    preparation: [
      'Your business details and access to the account and number you want to use',
      'Approved answers, prices or policies, plus the enquiries the flow should handle',
      'A person or team for handoff, and access to the agreed sheet, CRM or booking system',
    ],
    details: [
      { h: 'Human handoff', p: 'We agree what the flow can answer and when it should ask a person to take over. Your team needs a clear place to receive and manage those conversations; automation does not replace that responsibility.' },
      { h: 'Account setup and launch', p: 'We check the current platform requirements for your account and number before committing to an integration. Verification, number setup, message approval and testing may all be needed; the website demonstration is only an illustration.' },
      { h: 'Costs and ongoing support', p: 'The quote separates the build, paid platform or provider charges, and any support you choose. We agree who updates answers and monitors connected systems after handover.' },
      { h: 'Connected tools and customer data', p: 'Specify which details should be collected and where they belong. We agree access, consent, retention and failure handling for each connected tool as part of the project.' },
    ],
    categories: ['whatsapp'],
    serviceTags: ['whatsapp', 'whatsapp automation', 'whatsapp-automation', 'whatsapp chatbot', 'whatsapp bot'],
    faq: [
      { q: 'Can I keep my current number?', a: 'We check the options for your current setup and account eligibility before agreeing the work. Depending on those requirements, the integration may use your current number or a separate business number.' },
      { q: 'Can the bot answer everything?', a: 'It handles the approved topics and flows in your scope. Questions outside those flows need a human handoff. AI answers, if included, require their own agreed limits and testing.' },
      { q: 'Is ongoing support compulsory?', a: 'The build and any ongoing support are quoted separately. We agree who looks after answers, platform accounts and connected tools after the included fixes period.' },
      { q: 'Does this website demo send WhatsApp messages?', a: 'No. It shows a sample conversation. A real system needs the agreed account setup, integrations and launch checks.' },
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
    problem: [
      'Save form details into the right sheet or CRM.',
      'Start agreed follow-ups when a business event happens.',
      'Prepare recurring reports from connected records.',
    ],
    builds: [
      { h: 'Enquiry → customer record', p: 'A form submission starts the workflow, checks the agreed fields and creates or updates a record in your sheet or CRM. Duplicate handling is defined for the records you use.' },
      { h: 'Completed job → invoice or follow-up', p: 'An agreed status change starts the next action, such as preparing an invoice or sending a reminder through a connected account.' },
      { h: 'Schedule → team report', p: 'A scheduled run gathers the agreed figures and sends a summary to your chosen channel. The result depends on access to the source records.' },
      { h: 'Message → assisted draft', p: 'An optional AI step can classify an enquiry, extract fields or prepare a draft. We agree where a person must review the result before it is used.' },
    ],
    included: [
      'A workflow map showing the trigger, actions and expected result',
      'Connections to the accounts agreed in your scope',
      'Testing of normal runs, duplicate inputs and scoped failure cases',
      'A configured failure alert route and recovery instructions',
      'Handover notes, agreed hosting setup and 30 days of free fixes after launch',
    ],
    price: 'A fixed written quote per agreed workflow. Hosting, paid app or AI usage and any ongoing support are agreed separately.',
    timeline: 'Typical simple workflow: 2–5 days after access and example records are ready. More connections or approvals need a separate schedule.',
    preparation: [
      'The repeated task, its trigger and the result you want',
      'Access to the connected tools, plus example inputs and records',
      'A workflow owner, failure alert destination and any approval rules',
    ],
    details: [
      { h: 'Connections and permissions', p: 'Each app needs suitable account access and a supported way to connect. We confirm those requirements before quoting; paid app plans, usage limits or missing features can change what is possible.' },
      { h: 'Failures and recovery', p: 'We configure the agreed alert channel and document how to inspect and retry failed work. Retry and duplicate rules depend on the task, and your team needs an owner for issues with source accounts or data.' },
      { h: 'Hosting and maintenance', p: 'Choose an appropriate n8n Cloud account or server setup during scoping. We agree who pays for hosting, keeps credentials valid, handles updates and reviews failures after handover.' },
      { h: 'AI and approval steps', p: 'AI is an optional step rather than a requirement. We discuss the records it may read, its usage costs and when a human must approve a result before an external action.' },
    ],
    categories: ['n8n'],
    serviceTags: ['n8n', 'n8n automation', 'n8n-automation', 'workflow automation'],
    faq: [
      { q: 'Do I need a new app?', a: 'Usually the goal is to connect your existing tools. We check their connection options and access requirements first; a custom app is only a separate option when the workflow needs one.' },
      { q: 'What happens if a connected service is unavailable?', a: 'The workflow uses the failure handling and alert route agreed for that task. We document how to inspect the failure and retry safely; an unavailable account or service may need your team to intervene.' },
      { q: 'Who maintains it after launch?', a: 'The quote names the hosting and maintenance responsibilities. Thirty days of free fixes are included; further support, workflow changes and third-party account issues are agreed separately.' },
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
    problem: [
      'Correct outdated business hours, services and contact details.',
      'Help visitors understand your service and the areas you cover.',
      'Find technical or content issues that make the website harder to discover.',
    ],
    builds: [
      { h: 'Listing and website audit', p: 'Review your current business listing, website pages and available search data. Agree the priority fixes and the services or areas to focus on.' },
      { h: 'Google Business Profile improvements', p: 'Update appropriate categories, services, hours, contact details and supplied photos. Prepare a straightforward way to request honest customer reviews.' },
      { h: 'Useful service and area pages', p: 'Explain what you offer, where you work and how to contact you. Improve existing pages or write the additional pages agreed in your scope.' },
      { h: 'Search basics and reporting', p: 'Address agreed title, description, sitemap, indexing and page performance issues. Report available impressions, clicks or contact activity, with the source and next actions explained.' },
    ],
    included: [
      'An initial audit and an agreed list of priorities',
      'The listing changes and website improvements specified in the quote',
      'Focus services and search areas agreed with you',
      'Guidance for requesting honest customer reviews',
      'A reporting schedule and available metrics agreed for ongoing work',
    ],
    price: 'Initial improvements and any ongoing monthly work are quoted in writing. The quote sets the pages, listing work and reporting included.',
    timeline: 'Typical initial setup: 1–2 weeks after access and content are ready. Search changes take time, and no result date or ranking is guaranteed.',
    preparation: [
      'Access to your Google Business Profile and the website or content editor',
      'Accurate hours, services, contact details, service areas and suitable photos',
      'Search or analytics account access where available, and the enquiries you want to track',
    ],
    details: [
      { h: 'Choosing search areas', p: 'We agree the services and locations you actually cover, then review relevant searches and existing pages. The work focuses on useful, accurate information rather than creating pages for places you do not serve.' },
      { h: 'Understanding reports', p: 'Reports use the data the connected accounts make available. Impressions and clicks are different from enquiries; calls or messages can only be reported where suitable tracking exists. We name the source and its limits.' },
      { h: 'Reviews and listing access', p: 'Customers should be invited to leave an honest review without selecting a rating for them. Listing ownership, account access and platform verification may need to be resolved before changes can be published.' },
      { h: 'Ongoing improvements', p: 'A monthly scope can cover content updates, listing checks and agreed reporting. New pages, larger website changes or additional locations are discussed before adding work.' },
    ],
    categories: ['static', 'dynamic'],
    serviceTags: ['seo', 'local seo', 'google business profile', 'search optimisation', 'search optimization'],
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
    problem: [
      'Share contact details without asking someone to type them.',
      'Open a menu or review link from a counter or table.',
      'Connect a product to its warranty or service information.',
    ],
    builds: [
      { h: 'Business cards', p: 'Open a contact page, WhatsApp link or work gallery. We agree the information displayed and how you will update it later.' },
      { h: 'Review and counter tags', p: 'Take a customer to your Google review page or another agreed destination. The customer chooses their own rating and words.' },
      { h: 'Warranty and service stickers', p: 'Link a product to the agreed warranty lookup or service page. Individual product records and integrations are scoped with the system they connect to.' },
      { h: 'Menus and product links', p: 'Open a menu, catalogue or product page from a table or shelf. A managed destination can be updated later without replacing the physical tag.' },
    ],
    included: [
      'The agreed card or tag quantities and design for your approval',
      'NFC programming and testing on compatible phones',
      'The destination page or link setup agreed in your scope',
      'A QR code fallback for phones that cannot read the tag',
      'Instructions for use and the agreed process for later link updates',
    ],
    price: 'Physical items and any page or system work are quoted in writing. Quantity, material, artwork and destination updates are agreed before production.',
    timeline: 'Typically about a week after artwork and links are approved; printing, quantities and delivery can affect the date.',
    preparation: [
      'Your logo, artwork and the quantity and type of cards or tags you need',
      'The contact details or destination links each item should open',
      'Approval of the design and a delivery location before production',
    ],
    details: [
      { h: 'Phone compatibility', p: 'NFC tapping needs a compatible phone with the relevant setting enabled. Phone models, cases and tag placement can affect reading; the printed QR code offers another way to open the same destination.' },
      { h: 'Updating a destination', p: 'A tag linked through a managed destination can point to updated content without reprinting. We agree who can make those updates and any hosting or support arrangement; a tag with a fixed direct link has different limits.' },
      { h: 'Materials and quantities', p: 'Tell us whether the item belongs in a wallet, on a counter or on a product. We agree material, dimensions, finish, placement and quantities before approving the artwork and quote.' },
      { h: 'Warranty records and measurement', p: 'A warranty tag needs the appropriate product record and lookup page. Optional visit counts require agreed tracking on the destination; they count recorded visits rather than every physical tap.' },
    ],
    categories: ['dynamic'],
    serviceTags: ['nfc', 'nfc cards', 'nfc tags', 'nfc business card', 'review tag', 'review tags'],
    faq: [
      { q: 'Does tapping work on every phone?', a: 'No. The phone needs compatible NFC support, and its settings or case may affect reading. We provide a QR fallback and test the agreed tag setup before handover.' },
      { q: 'Do customers need a special app?', a: 'The tag or QR code opens a normal link in the phone browser. The destination may have its own requirements, such as a login to post a review.' },
      { q: 'Can the link change later?', a: 'Yes, when the tag uses a managed destination agreed in the scope. We explain how updates work and any ongoing arrangement before production.' },
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
    problem: [
      'Update menus or offers across several screens.',
      'Schedule different content for the day or location.',
      'Manage screen access and check playback activity from one dashboard.',
    ],
    builds: [
      { h: 'Playlists and screen groups', p: 'Upload images or videos and choose the playlist for a screen, group or branch. Your content team can manage media from the dashboard.' },
      { h: 'Scheduled content', p: 'Set dates, weekdays and time windows for menus, offers or campaigns. Agree the screen locations and schedules during setup.' },
      { h: 'Downloaded offline playback', p: 'The player can continue scheduled playback of content already downloaded to the device. An internet connection is needed to receive new content and dashboard updates.' },
      { h: 'Advertising and screen status', p: 'Available plan features include advertising slots, playback reports and screen status. We confirm the features and reporting you need in your subscription quote.' },
    ],
    included: [
      'The MR Signage player for compatible Android TVs and tablets',
      'The web dashboard and user roles included in your chosen plan',
      'Pairing and setup of the first screens agreed in your quote',
      'Player and dashboard updates within the subscription',
      'Support from the people who build MR Signage',
    ],
    price: 'Monthly subscription quoted per screen. The plan confirms screen count, storage, features and support; any hardware and installation work are agreed separately.',
    timeline: 'First screens can typically be set up in a day once compatible hardware, internet access and media are ready. Larger rollouts get an agreed schedule.',
    preparation: [
      'Screen count, locations and the Android TV, TV box or tablet models you will use',
      'Internet access for pairing and updates, plus your images or videos',
      'Playlist schedules, screen groups and the people who need dashboard access',
    ],
    details: [
      { h: 'Hardware and installation', p: 'The player supports Android TVs and tablets on Android 8.0 or newer, subject to compatibility checks. We review your device models, storage and screen placement before rollout. Hardware supply or installation is separately agreed.' },
      { h: 'Offline playback and updates', p: 'Offline playback uses media already downloaded to the player. New uploads, playlist changes and remote status need connectivity; device power, storage and local settings also affect playback.' },
      { h: 'Plans and additional screens', p: 'Subscriptions are per screen, per month. The quote identifies the package, storage and features, plus the process for adding screens. We discuss advertising reports and team permissions if they are needed.' },
      { h: 'Publishing responsibilities', p: 'Your team supplies and approves the content and schedules. We help with the agreed initial setup and explain publishing, updates and support at handover.' },
    ],
    categories: ['dynamic'],
    serviceTags: ['mr signage', 'digital signage', 'digital-signage', 'signage'],
    faq: [
      { q: 'Can I use the screens I already have?', a: 'We check your TV, Android TV box or tablet models before agreeing setup. Compatible Android hardware and suitable internet access are required; we can discuss hardware options if needed.' },
      { q: 'What happens without internet?', a: 'The player can keep playing content it has already downloaded. New content, schedule changes and remote status need the connection to return.' },
      { q: 'How does the subscription work?', a: 'You pay per screen, per month. The chosen package sets the storage and features included. Hardware, installation and any additional work are explained in the quote.' },
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
