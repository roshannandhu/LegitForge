import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { ServiceDemo } from '@/components/sections/service-demos';
import { SERVICE_PAGES, serviceBySlug } from '@/lib/pages';
import { orgRef, SITE, waLink } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { withCity } from '@/lib/team-seo';
import '@/components/sections/sections.css';
import '../../pages.css';

// true, not false: every page reads tagged data (the root layout reads 'company'), and Next 16
// answers 404 (NoFallbackError) for a dynamicParams = false page once its tag expires.
// Unknown slugs still 404 through notFound().
export const dynamicParams = true;
export const generateStaticParams = () => SERVICE_PAGES.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = serviceBySlug((await params).slug);
  if (!s) return {};
  const { city } = await getCompany();
  return { title: s.title, description: s.description, keywords: withCity(s.keywords, city), alternates: { canonical: `/services/${s.slug}` } };
}

/** Shared service order (the owner's call, 16 Oct): heading with the service's demo beside it →
 *  what we build → quote and timeline → FAQ → contact. No projects here (home and /work show them).
 *  Each fact is said once: the cards are the scope, the price note holds the conditions. */
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = serviceBySlug((await params).slug);
  if (!s) notFound();
  const company = await getCompany();
  const wa = waLink(company, `Hi Legit Forge, I'd like to talk about ${s.topic}.`);

  return (
    <div data-service-page={s.slug}>
      <PageHead crumbs={[{ name: 'Services', href: '/services' }, { name: s.name, href: `/services/${s.slug}` }]} title={s.h1} lead={s.lead}
        aside={<div className="page-demo service-primary-demo" data-service={s.slug} data-service-demo="primary"><ServiceDemo kind={s.demo} /></div>}>
        <p className="service-audience"><span className="type-label">For</span> {s.audience}</p>
        <a className="btn btn-primary" data-event-location="service" href={wa}>Chat on WhatsApp</a>
        <a className="btn btn-ghost" href="#price">Quotes and timelines</a>
      </PageHead>

      <section className="page-block wrap" data-service-section="builds" aria-labelledby="build-h">
        <h2 id="build-h" className="type-h3 block-h">What we can build for you</h2>
        <ol className="tiles service-builds">
          {s.builds.map((b, i) => <li key={b.h} className="tile">
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="type-h3">{b.h}</h3><p>{b.p}</p>
          </li>)}
        </ol>
      </section>

      <section id="price" className="page-block wrap" data-service-section="pricing" aria-labelledby="price-h">
        <h2 id="price-h" className="type-h3 block-h">Quotes and timelines</h2>
        <dl className="facts">
          <div><dt>Quote basis</dt><dd className="num">{s.price}</dd></div>
          <div><dt>Typical time</dt><dd className="num">{s.timeline}</dd></div>
        </dl>
        <p className="price-note">{s.priceNote}</p>
      </section>

      <section className="page-block wrap" data-service-section="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="type-h3 block-h">Questions about {s.topic}</h2>
        <div className="faq-list">
          {s.faq.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* the quote and its conditions are already above: the band only says how fast we answer */}
      <CtaBand
        text={`We reply within ${SITE.replyWithin} during working hours.`}
        waText={`Hi Legit Forge, I'd like to talk about ${s.topic}.`}
      />

      <JsonLd data={{
        '@type': 'Service',
        name: s.name,
        description: s.description,
        url: `${SITE.url}/services/${s.slug}`,
        ...(company.city ? { areaServed: company.city } : {}),
        provider: orgRef,
      }} />
      <JsonLd data={{
        '@type': 'FAQPage',
        mainEntity: s.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }} />
    </div>
  );
}
