import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import '../legal.css';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'How using this website works, and how Legit Forge quotes, payments and ownership work.',
  alternates: { canonical: '/terms' },
};

/** PLAN §7.6: website use, and how quotes and payments work.
 *  DRAFT: replace with, or link to, your reviewed service agreement before launch. */
export default function Terms() {
  return (
    <article className="legal wrap">
      <p className="legal-draft">Draft — to be reviewed by a lawyer before launch.</p>
      <h1 className="type-h2">Terms</h1>
      <p className="type-lead">The plain rules for this website, and how working with us works.</p>

      <h2>Using this website</h2>
      <p>You may read, share and link to this website. Please don’t copy it, scrape it or try to break it. The live WhatsApp test is for trying our system, not for general chat.</p>

      <h2>Quotes</h2>
      <p>Every project starts with a written, fixed quote after a short call. The quote lists exactly what is included. If the scope grows, we tell you and agree a new price <em>before</em> doing the extra work.</p>

      <h2>Payments</h2>
      <p>[Payment schedule, for example: 50% to start, 50% at launch.] No payment is due until you approve a written quote.</p>

      <h2>Ownership</h2>
      <p>When the project is paid, you own it: the code, the domain, the hosting account, your WhatsApp number and every workflow. We keep no hidden licences or lock-ins.</p>

      <h2>Fixes after launch</h2>
      <p>We fix anything that doesn’t work as agreed, free of charge, for 30 days after launch.</p>

      <h2>Contact</h2>
      <p>{SITE.legalName}, {SITE.city}, {SITE.country}. <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
    </article>
  );
}
