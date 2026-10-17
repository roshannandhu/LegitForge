/** The WhatsApp bot's services (bot/text.ts menu; Admin → Team routes them). Here, not in bot/,
 *  because the admin needs them too and nothing in app/ or lib/ may import bot/.
 *  Titles ≤ 24 and descriptions ≤ 72 characters (WhatsApp list rows); MR Signage last, then the
 *  free-chat row. `lead` is what Admin → Leads shows: the form's own wording (lib/lead.ts NEEDS). */
export const SERVICES = [
  { key: 'website', title: 'Website', description: 'Business site or landing page', lead: 'Website' },
  { key: 'app', title: 'Web app', description: 'Bookings, dashboards, logins', lead: 'Web app' },
  { key: 'quote', title: 'Quotation / warranty', description: 'Quotes as links, warranty by QR', lead: 'Quotation or warranty system' },
  { key: 'whatsapp', title: 'WhatsApp automation', description: 'Replies, enquiries, bookings', lead: 'WhatsApp automation' },
  { key: 'n8n', title: 'n8n workflows', description: 'Connect forms, sheets and tools', lead: 'n8n workflow' },
  { key: 'seo', title: 'SEO', description: 'Google search and Maps', lead: 'SEO' },
  { key: 'nfc', title: 'NFC cards / tags', description: 'Tap to share a link', lead: 'NFC cards or tags' },
  { key: 'signage', title: 'MR Signage', description: 'Digital signage for TVs', lead: 'MR Signage (digital signage)' },
  { key: 'other', title: 'Something else / chat', description: 'Tell us in your own words', lead: 'Not sure yet' },
] as const;
export type ServiceKey = (typeof SERVICES)[number]['key'];
export const serviceByKey = (key: string) => SERVICES.find((s) => s.key === key);
/** A lead's service wording (the form's or the bot's) back to the bot's key. */
export const serviceOfLabel = (label: string | null | undefined): ServiceKey | null =>
  !label ? null : label.startsWith('Website') ? 'website' : SERVICES.find((s) => s.lead === label)?.key ?? null;

/** The bot's channels (phase 7): a client's id carries it ("web:", "fb:", "ig:"; WhatsApp has
 *  none). Their enquiries are leads with source 'whatsapp' and the channel's label as the page,
 *  so reports tell them apart with CHANNEL_SQL. */
export type Channel = 'whatsapp' | 'web' | 'fb' | 'ig';
export const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', web: 'Website chat', fb: 'Messenger', ig: 'Instagram' };
export const CHANNEL_SQL = "CASE WHEN page IN ('Website chat', 'Messenger', 'Instagram') THEN page ELSE source END";
