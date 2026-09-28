import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { Quench } from '@/components/sections/quench';
import { SITE, waLink } from '@/lib/site';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Chat with us on WhatsApp or send your project details. We reply within ${SITE.replyWithin} during working hours, and every project starts with a fixed quote.`,
  alternates: { canonical: '/contact' },
};

/** /contact (PLAN §7.5): the quench form plus hours and the reply promise. */
export default function Contact() {
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Contact', href: '/contact' }]}
        title="Talk to the people who’ll build it"
        lead={`Two of us. The person who replies is the person who writes the code. We answer within ${SITE.replyWithin} during working hours.`}
      />

      <section className="page-block wrap" aria-label="How to reach us">
        <dl className="contact-facts">
          <div><dt>WhatsApp</dt><dd><a href={waLink()}>Chat on WhatsApp</a></dd></div>
          <div><dt>Email</dt><dd><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd></div>
          <div><dt>Hours</dt><dd>{SITE.hours.label}</dd></div>
        </dl>
      </section>

      <div className="page-contact"><Quench /></div>
    </>
  );
}
