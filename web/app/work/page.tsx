import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { WorkGrid } from '@/components/work/work-grid';
import { WORK_FILTERS } from '@/lib/pages';
import { getProjects } from '@/lib/work';
import { waLink } from '@/lib/site';
import { getCompany } from '@/lib/company';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Work',
  description: 'Explore published websites, web apps and automation projects from Legit Forge, with delivery details, available evidence and links to the work.',
  alternates: { canonical: '/work' },
};

/** /work (PLAN §7.2). */
export default async function WorkIndex() {
  const company = await getCompany();
  // only the card fields cross to the client filter
  const items = (await getProjects()).map(({ study: _study, published: _published, ...card }) => card);
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Work', href: '/work' }]}
        title="Work that’s live right now"
        lead={items.length
          ? 'Published work for real businesses. Explore what we built; recorded results appear where supporting information is available.'
          : 'Our published case studies will appear here as they become available.'}
      />
      <section className="page-block wrap" aria-label="Projects">
        {items.length ? (
          <WorkGrid items={items} filters={WORK_FILTERS} waHref={waLink(company, 'Hi Legit Forge, I have a project like the ones on your site.')} />
        ) : (
          <div className="work-empty">
            <p className="type-lead">Our case studies are being written up. Ask us on WhatsApp and we’ll show you what we’ve built.</p>
            <a className="btn btn-primary" href={waLink(company, 'Hi Legit Forge, can you show me examples of your work?')}>Ask for examples</a>
          </div>
        )}
      </section>
      <CtaBand />
    </>
  );
}
