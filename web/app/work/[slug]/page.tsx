import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CaseStudy } from '@/components/work/case-study';
import { getProject, getProjects } from '@/lib/work';
import '@/components/sections/sections.css';
import '../../pages.css';

// placeholders at build; projects published later in the admin render on first visit
export const dynamicParams = true;
export const generateStaticParams = async () => (await getProjects()).map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProject((await params).slug);
  if (!p) return {};
  return {
    title: `${p.title} — case study`,
    description: `${p.title} for ${p.client}: ${p.resultValue} ${p.resultLabel}.`,
    alternates: { canonical: `/work/${p.slug}` },
  };
}

/** Case study (PLAN §7.2): header → cover → challenge → what we built → results with sources →
 *  stack → who built it → next project. */
export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getProjects();
  const i = all.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = all[i], next = all[(i + 1) % all.length];
  return <CaseStudy p={p} next={next} />;
}
