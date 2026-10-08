import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { SERVICE_PAGES } from '@/lib/pages';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Websites and web apps, WhatsApp automation, n8n workflows, SEO, NFC cards and MR Signage: what each one is for, how it is quoted, and how long it takes.',
  alternates: { canonical: '/services' },
};

/** A compact service directory; examples and fuller scope live on each service page. */
export default function ServicesIndex() {
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Services', href: '/services' }]}
        title="What we offer, and who it’s for"
        lead="Choose by the job you need done. Each service page covers scope, cost, timing and an example."
      />

      <section className="page-block wrap" aria-label="Services">
        <ol className="service-directory">
          {SERVICE_PAGES.map((s, i) => (
            <li key={s.slug}>
              <span className="fire-num num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <div className="service-directory-copy">
                <h2 className="type-h3">{s.name}</h2>
                <p className="fire-line">{s.lead}</p>
                <p className="service-directory-audience"><span className="type-label">For</span> {s.audience}</p>
              </div>
              <div className="service-directory-facts">
                <p>{s.price}</p>
                <p className="service-caption">{s.timeline}</p>
                <a className="text-link" href={`/services/${s.slug}`}>
                  Read about {s.topic}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand title="Not sure which one you need?" text="Tell us what you want to improve. We’ll suggest the scope for your business." />
    </>
  );
}
