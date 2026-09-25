import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { ServiceDemo } from '@/components/sections/service-demos';
import { ProjectCard } from '@/components/work/project-card';
import { CheckIcon } from '@/components/ui/icons';
import { PROJECTS } from '@/lib/content';
import { CASE_STUDIES, SERVICE_PAGES, serviceBySlug } from '@/lib/pages';
import { SITE, waLink } from '@/lib/site';
import '@/components/sections/sections.css';
import '../../pages.css';

export const dynamicParams = false;
export const generateStaticParams = () => SERVICE_PAGES.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = serviceBySlug((await params).slug);
  if (!s) return {};
  return { title: s.title, description: s.description, alternates: { canonical: `/services/${s.slug}` } };
}

/** Service page template (PLAN §7.1): problem → what we build → demo → included →
 *  price and time → related work → FAQ → call to action. Nothing animates but the demo. */
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = serviceBySlug((await params).slug);
  if (!s) notFound();
  const related = PROJECTS.filter((p) => s.categories.includes(CASE_STUDIES[p.slug]?.category)).slice(0, 3);
  const wa = waLink(`Hi Legit Forge, I'd like to talk about ${s.topic}.`);

  return (
    <>
      <PageHead crumbs={[{ name: 'Services', href: '/services' }, { name: s.name, href: `/services/${s.slug}` }]} title={s.h1} lead={s.lead}>
        <a className="btn btn-primary" href={wa}>Chat on WhatsApp</a>
        <a className="btn btn-ghost" href="#price">See price and time</a>
      </PageHead>

      <section className="page-block wrap" aria-labelledby="problem-h">
        <h2 id="problem-h" className="type-h3 block-h">What people tell us before they call</h2>
        <ul className="voices">{s.problem.map((q) => <li key={q}>{q}</li>)}</ul>
      </section>

      <section className="page-block wrap" aria-labelledby="build-h">
        <h2 id="build-h" className="type-h3 block-h">What we build</h2>
        <ol className="tiles">
          {s.builds.map((b, i) => (
            <li key={b.h} className="tile">
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="type-h3">{b.h}</h3>
              <p>{b.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-block wrap split" aria-labelledby="inc-h">
        <div>
          <h2 id="inc-h" className="type-h3 block-h">What’s included</h2>
          <ul className="ticks">
            {s.included.map((l) => <li key={l}><CheckIcon /><span>{l}</span></li>)}
          </ul>
        </div>
        <div className="page-demo">
          <ServiceDemo kind={s.demo} />
        </div>
      </section>

      <section id="price" className="page-block wrap" aria-labelledby="price-h">
        <h2 id="price-h" className="type-h3 block-h">Price and time</h2>
        <dl className="facts">
          <div><dt>Starting price</dt><dd className="num">{s.price}</dd></div>
          <div><dt>Typical time</dt><dd className="num">{s.timeline}</dd></div>
        </dl>
        <p className="price-note">
          Every project gets a fixed quote in writing after a 20-minute call. If the scope grows, we agree a new price before doing the extra work.
        </p>
      </section>

      {related.length > 0 && (
        <section className="page-block wrap" aria-labelledby="work-h">
          <h2 id="work-h" className="type-h3 block-h">Related work</h2>
          <ul className="work-grid">{related.map((p) => <ProjectCard key={p.slug} p={p} />)}</ul>
        </section>
      )}

      <section className="page-block wrap" aria-labelledby="faq-h">
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
        areaServed: SITE.city,
        provider: { '@type': 'ProfessionalService', name: SITE.name, url: SITE.url },
      }} />
      <JsonLd data={{
        '@type': 'FAQPage',
        mainEntity: s.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }} />
    </>
  );
}
