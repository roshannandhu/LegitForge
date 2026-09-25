import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { WorkGrid } from '@/components/work/work-grid';
import { PROJECTS } from '@/lib/content';
import { CASE_STUDIES, WORK_FILTERS } from '@/lib/pages';
import { waLink } from '@/lib/site';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Work',
  description: 'Websites, web apps, WhatsApp bots and n8n workflows we have built — each with the result that mattered to the client, and a link to the live site.',
  alternates: { canonical: '/work' },
};

/** /work (PLAN §7.2). */
export default function WorkIndex() {
  const items = PROJECTS.map((p) => ({ ...p, category: CASE_STUDIES[p.slug]?.category ?? 'static' }));
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Work', href: '/work' }]}
        title="Work that’s live right now"
        lead="Every project here is running for a real business. Each card shows the one number the client cared about, and where that number came from."
      />
      <section className="page-block wrap" aria-label="Projects">
        <WorkGrid items={items} filters={WORK_FILTERS} waHref={waLink('Hi Legit Forge, I have a project like the ones on your site.')} />
      </section>
      <CtaBand />
    </>
  );
}
