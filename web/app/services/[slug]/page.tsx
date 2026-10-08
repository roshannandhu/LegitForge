import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { ServiceDisclosures } from '@/components/pages/service-disclosures';
import { ServiceDemo } from '@/components/sections/service-demos';
import { Compare } from '@/components/sections/compare';
import { Quotation } from '@/components/sections/quotation';
import { LiveTest } from '@/components/sections/live-test';
import { HydrateWhenNear } from '@/components/motion/hydrate-when-near';
import { WEBSITE_FACTS } from '@/lib/content';
import { ProjectCard } from '@/components/work/project-card';
import { CheckIcon } from '@/components/ui/icons';
import { getProjects } from '@/lib/work';
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

/** Shared service order: outcome → practical scope → real work → included → cost/time → preparation →
 *  one example → optional detail → FAQ → contact. Supplemental demos remain addressable. */
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = serviceBySlug((await params).slug);
  if (!s) notFound();
  const serviceTags = new Set(s.serviceTags.map((tag) => tag.trim().toLowerCase()));
  const related = (await getProjects()).filter((p) => p.tags.some((tag) => serviceTags.has(tag.trim().toLowerCase()))).slice(0, 3);
  const company = await getCompany();
  const wa = waLink(company, `Hi Legit Forge, I'd like to talk about ${s.topic}.`);

  return (
    <div data-service-page={s.slug}>
      <ServiceDisclosures />
      <PageHead crumbs={[{ name: 'Services', href: '/services' }, { name: s.name, href: `/services/${s.slug}` }]} title={s.h1} lead={s.lead}>
        <p className="service-audience"><span className="type-label">For</span> {s.audience}</p>
        <a className="btn btn-primary" data-event-location="service" href={wa}>Chat on WhatsApp</a>
        <a className="btn btn-ghost" href="#price">Quotes and timelines</a>
      </PageHead>

      <section className="page-block wrap" data-service-section="builds" aria-labelledby="build-h">
        <h2 id="build-h" className="type-h3 block-h">What we can build for you</h2>
        <ul className="service-use-cases">{s.problem.map((useCase) => <li key={useCase}>{useCase}</li>)}</ul>
        <ol className="tiles service-builds">
          {s.builds.map((b, i) => <li key={b.h} className="tile">
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="type-h3">{b.h}</h3><p>{b.p}</p>
          </li>)}
        </ol>
      </section>

      {related.length > 0 && (
        <section className="page-block wrap" data-service-section="work" aria-labelledby="work-h">
          <h2 id="work-h" className="type-h3 block-h">Related work</h2>
          <ul className="work-grid">{related.map((p) => <ProjectCard key={p.slug} p={p} />)}</ul>
        </section>
      )}

      <section className="page-block wrap" data-service-section="included" aria-labelledby="inc-h">
        <h2 id="inc-h" className="type-h3 block-h">What’s included</h2>
        <ul className="ticks service-included">
          {s.included.map((l) => <li key={l}><CheckIcon /><span>{l}</span></li>)}
        </ul>
      </section>

      <section id="price" className="page-block wrap" data-service-section="pricing" aria-labelledby="price-h">
        <h2 id="price-h" className="type-h3 block-h">Quotes and timelines</h2>
        <dl className="facts">
          <div><dt>Quote basis</dt><dd className="num">{s.price}</dd></div>
          <div><dt>Typical time</dt><dd className="num">{s.timeline}</dd></div>
        </dl>
        <p className="price-note">
          We discuss your scope and give you a fixed quote in writing before work starts. Any extra work is agreed separately.
        </p>
      </section>

      <section className="page-block wrap" data-service-section="preparation" aria-labelledby="prepare-h">
        <h2 id="prepare-h" className="type-h3 block-h">What to bring to the first conversation</h2>
        <ul className="ticks service-preparation">{s.preparation.map((item) => <li key={item}><CheckIcon /><span>{item}</span></li>)}</ul>
      </section>

      <section className="page-block wrap" data-service={s.slug} data-service-section="example" aria-labelledby="example-h">
        <h2 id="example-h" className="type-h3 block-h">An example of {s.topic}</h2>
        <div className="page-demo service-primary-demo" data-service-demo="primary"><ServiceDemo kind={s.demo} /></div>
      </section>

      <section className="page-block wrap" data-service-section="details" aria-labelledby="details-h">
        <h2 id="details-h" className="type-h3 block-h">More detail when you need it</h2>
        <div className="service-disclosures">
          {s.details.map((detail, i) => <details key={detail.h} id={`service-detail-${i + 1}`} className="service-disclosure">
            <summary>{detail.h}</summary><div className="service-disclosure-body prose"><p>{detail.p}</p></div>
          </details>)}
          {s.slug === 'website-development' && <>
            <details id="website-comparison" className="service-disclosure">
              <summary>Compare a static website and a web app</summary>
              <div className="service-disclosure-body" data-service-demo="details"><HydrateWhenNear><Compare facts={WEBSITE_FACTS} /></HydrateWhenNear></div>
            </details>
            <details id="website-app-example" className="service-disclosure">
              <summary>See a booking dashboard example</summary>
              <section id="app-example" className="service-disclosure-body" data-service-demo="details" aria-labelledby="app-example-h">
                <h3 id="app-example-h" className="type-h3">A web app in action</h3>
                <p className="service-caption">A sample booking enters, the records update, and the team sees what needs attention.</p>
                <div className="page-demo"><ServiceDemo kind="app" /></div>
              </section>
            </details>
            <details id="website-quotation" className="service-disclosure">
              <summary>See a quotation and warranty example</summary>
              <div className="service-disclosure-body" data-service-demo="details"><HydrateWhenNear><Quotation /></HydrateWhenNear></div>
            </details>
          </>}
          {s.slug === 'whatsapp-automation' && <details id="whatsapp-workflow-example" className="service-disclosure">
            <summary>Run an example WhatsApp workflow</summary>
            <div className="service-disclosure-body" data-service-demo="details"><HydrateWhenNear><LiveTest /></HydrateWhenNear></div>
          </details>}
        </div>
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

      <CtaBand waText={`Hi Legit Forge, I'd like to talk about ${s.topic}.`} />

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
