/** Lead validation, shared by the form (instant feedback) and the API route (the real
 *  check — never trust the client). Messages are PLAN §6.11 verbatim. */

/** Form options (placeholders in [brackets]). Kept here, not in content.ts: whatever the
 *  form imports ships to the browser, and content.ts holds every page's copy. */
export const NEEDS = [
  'Website (static)', 'Website (dynamic)', 'Web app', 'Quotation or warranty system',
  'WhatsApp automation', 'n8n workflow', 'Not sure yet',
] as const;

export const BUDGETS = ['[range 1]', '[range 2]', '[range 3]', 'Not sure yet'] as const;

export type LeadField = 'name' | 'phone' | 'need' | 'message' | 'consent';
export type LeadErrors = Partial<Record<LeadField, string>>;

export interface Lead {
  name: string;
  phone: string;
  need: string;
  budget: string;
  message: string;
}

const PHONE_RE = /^\+[1-9][0-9 ()-]{7,18}$/;

export function validateLead(f: FormData): { errors: LeadErrors; lead: Lead } {
  const s = (k: string) => String(f.get(k) ?? '').trim();
  const lead: Lead = {
    name: s('name'),
    phone: s('phone'),
    need: s('need'),
    budget: s('budget').slice(0, 60),
    message: String(f.get('message') ?? '').slice(0, 1600),
  };

  const errors: LeadErrors = {};
  if (lead.name.length < 2 || lead.name.length > 80) errors.name = 'Enter your name.';
  if (!PHONE_RE.test(lead.phone)) errors.phone = 'Enter your WhatsApp number with the country code, for example +91 98765 43210.';
  if (!(NEEDS as readonly string[]).includes(lead.need)) errors.need = 'Choose what you need, or pick Not sure yet.';
  if (lead.message.length > 1500) errors.message = 'Keep your message under 1,500 characters.';
  if (f.get('consent') !== 'yes') errors.consent = 'Tick the box so we can reply on WhatsApp.';
  return { errors, lead };
}

/** Bots fill every field; people never see this one. */
export const HONEYPOT = 'company_site';
