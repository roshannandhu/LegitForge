import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { ServiceDemo } from '@/components/sections/service-demos';
import { SERVICE_PAGES } from '@/lib/pages';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Websites and web apps, WhatsApp automation and n8n workflows — what each one is for, what it costs to start, and how long it takes.',
  alternates: { canonical: '/services' },
};

/** /services (PLAN §3): one card per service page, each with its demo. */
export default function ServicesIndex() {
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Services', href: '/services' }]}
        title="What we build, and who it’s for"
        lead="Three kinds of work, often combined: the website or app your customers see, the WhatsApp that answers them, and the workflows that move the data behind both."
      />

      <section className="page-block wrap" aria-label="Services">
        <ol className="fires">
          {SERVICE_PAGES.map((s, i) => (
            <li key={s.slug} className="fire">
              <div className="fire-copy">
                <span className="fire-num num">{String(i + 1).padStart(2, '0')}</span>
                <h2 className="type-h3">{s.name}</h2>
                <p className="fire-line">{s.lead}</p>
                <p className="fire-price num">{s.price}</p>
                <a className="text-link" href={`/services/${s.slug}`}>
                  Read about {s.topic}
                </a>
              </div>
              <div className="fire-stage"><ServiceDemo kind={s.demo} /></div>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand title="Not sure which one you need?" text="Tell us the problem, not the technology. We’ll tell you the smallest thing that solves it — even if that’s nothing we sell." />
    </>
  );
}
