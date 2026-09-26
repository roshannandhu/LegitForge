import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CaseStudy } from '@/components/work/case-study';
import { getProject, getProjects } from '@/lib/work';
import { PROJECTS } from '@/lib/content';
import '@/components/sections/sections.css';
import '../../pages.css';

// placeholders at build; projects published later in the admin render on first visit
export const dynamicParams = true;
export const generateStaticParams = async () => (await getProjects()).map((p) => ({ slug: p.slug }));

/** The uploaded cover when there is one (projects from the admin), else the drawn card for the
 *  placeholders (/og/work/<slug>), else the site card. */
function shareImage(p: NonNullable<Awaited<ReturnType<typeof getProject>>>): Metadata {
  const img = p.cover
    ? { url: p.cover.src, width: p.cover.width, height: p.cover.height, alt: p.cover.alt }
    : PROJECTS.some((x) => x.slug === p.slug)
      ? { url: `/og/work/${p.slug}`, width: 1200, height: 630, alt: `${p.title} case study` }
      : { url: '/opengraph-image', width: 1200, height: 630, alt: 'Legit Forge' };
  return { openGraph: { images: [img] }, twitter: { card: 'summary_large_image', images: [img] } };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProject((await params).slug);
  if (!p) return {};
  return {
    title: `${p.title} — case study`,
    description: `${p.title} for ${p.client}: ${p.resultValue} ${p.resultLabel}.`,
    alternates: { canonical: `/work/${p.slug}` },
    ...shareImage(p),
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
