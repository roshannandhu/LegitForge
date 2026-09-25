import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import '../legal.css';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Legit Forge collects, who processes it, how long we keep it, and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

/** PLAN §7.6 and §13.4. This must describe what the system actually does (§13.5).
 *  DRAFT: have a lawyer review it against the law that applies to you (e.g. India's
 *  DPDP Act, or GDPR for EU visitors) before launch. */
export default function Privacy() {
  return (
    <article className="legal wrap">
      <p className="legal-draft">Draft — to be reviewed by a lawyer before launch.</p>
      <h1 className="type-h2">Privacy policy</h1>
      <p className="type-lead">Short version: we collect only what we need to reply to you, we never sell it, and you can ask us to delete it at any time.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>The contact form:</strong> your name, WhatsApp number, what you need, an optional budget and message, and your consent to be contacted on WhatsApp.</li>
        <li><strong>WhatsApp conversations:</strong> your number and the messages you send us.</li>
        <li><strong>Site analytics:</strong> anonymous page views through Cloudflare Web Analytics, which uses no cookies and stores no personal data.</li>
      </ul>

      <h2>Who processes it</h2>
      <ul>
        <li><strong>Cloudflare</strong> hosts this website and our database.</li>
        <li><strong>Meta</strong> carries WhatsApp messages.</li>
        <li><strong>Our n8n host</strong> runs the automations that route your request to us.</li>
        <li><strong>Our CRM</strong> keeps track of your enquiry.</li>
      </ul>

      <h2>Why</h2>
      <p>Only to reply to your enquiry, prepare a quote, and — if you become a client — deliver and support your project. We do not sell or share your details for marketing.</p>

      <h2>How long we keep it</h2>
      <table className="legal-table">
        <thead><tr><th scope="col">Data</th><th scope="col">Kept for</th></tr></thead>
        <tbody>
          <tr><th scope="row">Enquiries (leads)</th><td>[24 months] after our last contact, then deleted</td></tr>
          <tr><th scope="row">Live-test sessions</th><td>24 hours</td></tr>
          <tr><th scope="row">Rate-limit records</th><td>24 hours</td></tr>
          <tr><th scope="row">Analytics</th><td>13 months, with no personal data</td></tr>
          <tr><th scope="row">IP addresses and phone numbers in logs</th><td>Never stored in raw form</td></tr>
        </tbody>
      </table>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Stop WhatsApp messages:</strong> reply <strong>STOP</strong> at any time. Reply START to resume.</li>
        <li><strong>See or delete your data:</strong> email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we will do it within [30 days].</li>
      </ul>

      <h2>Who we are</h2>
      <p>{SITE.legalName}, {SITE.taxId}, {SITE.city}, {SITE.country}. Contact: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
    </article>
  );
}
