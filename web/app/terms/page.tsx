import type { Metadata } from 'next';
import { legalLine, shownEmail, waLink } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { Breadcrumbs } from '@/components/pages/page-head';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'How using this website works, and how Legit Forge quotes, payments and ownership work.',
  alternates: { canonical: '/terms' },
};

/** PLAN §7.6: website use, and how quotes and payments work.
 *  DRAFT: replace with, or link to, your reviewed service agreement before launch. */
export default async function Terms() {
  const company = await getCompany();
  const email = shownEmail(company);
  const legal = legalLine(company, false);
  return (
    <article className="legal wrap">
      <Breadcrumbs crumbs={[{ name: 'Terms', href: '/terms' }]} />
      <p className="legal-draft">Draft — to be reviewed by a lawyer before launch.</p>
      <h1 className="type-h2">Terms</h1>
      <p className="type-lead">The plain rules for this website, and how working with us works.</p>

      <h2>Using this website</h2>
      <p>You may read, share and link to this website. Please don’t copy it, scrape it or try to break it. Interactive demonstrations are illustrative examples; they do not send messages, book appointments or create a contract.</p>

      <h2>Quotes</h2>
      <p>Every project starts with a written, fixed quote after a short call. The quote lists exactly what is included. If the scope grows, we tell you and agree a new price <em>before</em> doing the extra work.</p>

      <h2>Payments</h2>
      <p>Payments follow the schedule written in your quote. No payment is due until you approve a written quote.</p>

      <h2>Ownership</h2>
      <p>Your written quote or service agreement describes the deliverables, ownership, account access and any ongoing services. Third-party software and services retain their own licence terms. MR Signage follows the commercial terms in its written offer.</p>

      <h2>Fixes after launch</h2>
      <p>We fix anything that doesn’t work as agreed, free of charge, for 30 days after launch.</p>

      <h2>Contact</h2>
      <p>{legal && <>{legal}. </>}{email ? <a href={`mailto:${email}`}>{email}</a> : <a href={waLink(company)}>Message us on WhatsApp</a>}</p>
    </article>
  );
}
