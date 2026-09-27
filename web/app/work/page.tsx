import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { WorkGrid } from '@/components/work/work-grid';
import { WORK_FILTERS } from '@/lib/pages';
import { getProjects } from '@/lib/work';
import { waLink } from '@/lib/site';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Work',
  description: 'Websites, web apps, WhatsApp bots and n8n workflows we have built — each with the result that mattered to the client, and a link to the live site.',
  alternates: { canonical: '/work' },
};

/** /work (PLAN §7.2). */
export default async function WorkIndex() {
  // only the card fields cross to the client filter
  const items = (await getProjects()).map(({ study: _study, published: _published, ...card }) => card);
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Work', href: '/work' }]}
        title="Work that’s live right now"
        lead={items.length
          ? 'Every project here is running for a real business. Each card shows the one number the client cared about, and where that number came from.'
          : 'Websites, apps and automations running for real businesses. Each case study will show the one number the client cared about.'}
      />
      <section className="page-block wrap" aria-label="Projects">
        {items.length ? (
          <WorkGrid items={items} filters={WORK_FILTERS} waHref={waLink('Hi Legit Forge, I have a project like the ones on your site.')} />
        ) : (
          <div className="work-empty">
            <p className="type-lead">Our case studies are being written up. Ask us on WhatsApp and we’ll show you what we’ve built.</p>
            <a className="btn btn-primary" href={waLink('Hi Legit Forge, can you show me examples of your work?')}>Ask for examples</a>
          </div>
        )}
      </section>
      <CtaBand />
    </>
  );
}
