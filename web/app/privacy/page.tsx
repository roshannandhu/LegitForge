import type { Metadata } from 'next';
import { SITE, legalLine, shownEmail, waLink } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { Breadcrumbs } from '@/components/pages/page-head';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Legit Forge collects, who processes it, how long we keep it, and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

/** PLAN §7.6 and §13.4. This must describe what the system actually does (§13.5).
 *  DRAFT: have a lawyer review it against the law that applies to you (e.g. India's
 *  DPDP Act, or GDPR for EU visitors) before launch. */
export default async function Privacy() {
  const company = await getCompany();
  const email = shownEmail(company);
  // the data-rights contact: the email when it is shown, else WhatsApp
  const reach = email ? <a href={`mailto:${email}`}>{email}</a> : <a href={waLink(company)}>message us on WhatsApp</a>;
  const legal = legalLine(company);
  return (
    <article className="legal wrap">
      <Breadcrumbs crumbs={[{ name: 'Privacy policy', href: '/privacy' }]} />
      <p className="legal-draft">Draft — to be reviewed by a lawyer before launch.</p>
      <h1 className="type-h2">Privacy policy</h1>
      <p className="type-lead">Short version: we collect only what we need to reply to you, we never sell it, and you can ask us to delete it at any time.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>The contact form:</strong> your name, WhatsApp number, what you need, an optional budget and message, and your consent to be contacted on WhatsApp.</li>
        <li><strong>WhatsApp conversations:</strong> your number and messages when you choose to contact us through WhatsApp. The illustrative website demonstrations send no messages.</li>
        <li><strong>Site measurement:</strong> counts of WhatsApp-link clicks, service and project opens, and confirmed form submissions, with public service/project labels, time and country when available. These events contain no names, phone numbers, messages or raw IP addresses; we create no visitor profiles or analytics cookies.</li>
        <li><strong>Abuse prevention:</strong> short-lived keyed identifiers and submission receipts prevent repeated or excessive enquiries. Human verification is used when configured.</li>
        <li><strong>Administration:</strong> administrator email addresses and sign-in security records protect access to the private dashboard.</li>
      </ul>

      <h2>Who processes it</h2>
      <ul>
        <li><strong>Cloudflare</strong> hosts this website and our database.</li>
        <li><strong>Meta</strong> carries messages you choose to send through WhatsApp.</li>
        <li><strong>Google</strong> verifies administrator sign-ins.</li>
        <li><strong>n8n and Telegram</strong> receive enquiry alerts only when that delivery integration is configured. Enquiries remain in our database if alerts are unavailable or fail.</li>
      </ul>

      <h2>Why</h2>
      <p>Only to reply to your enquiry, prepare a quote, and — if you become a client — deliver and support your project. We do not sell or share your details for marketing.</p>

      <h2>How long we keep it</h2>
      <table className="legal-table">
        <thead><tr><th scope="col">Data</th><th scope="col">Kept for</th></tr></thead>
        <tbody>
          <tr><th scope="row">Enquiries and alert delivery records</th><td>Reviewed and manually deleted when no longer needed to answer or follow up the enquiry</td></tr>
          <tr><th scope="row">Submission receipts and rate-limit records</th><td>24 hours, then removed by the scheduled cleanup</td></tr>
          <tr><th scope="row">Site events</th><td>13 months, then removed by the scheduled cleanup</td></tr>
          <tr><th scope="row">Administrator sign-in records</th><td>90 days</td></tr>
        </tbody>
      </table>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Stop follow-up messages:</strong> tell us in the conversation that you do not want further messages.</li>
        <li><strong>See or delete your data:</strong> {email ? 'email ' : ''}{reach} and we will do it without undue delay.</li>
      </ul>

      <h2>Who we are</h2>
      <p>{legal ? `${legal}. ` : `${SITE.name}. `}Contact: {reach}.</p>
    </article>
  );
}
