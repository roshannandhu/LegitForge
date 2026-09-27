/** GET /og/work/<slug> — the drawn share card for the placeholder case studies, static at
 *  build (lib/og.tsx reads its fonts at build time only). Projects published from the admin
 *  share their uploaded cover instead (app/work/[slug]/page.tsx), so nothing renders on
 *  Workers. */

import { ogImage } from '@/lib/og';
import { PROJECTS } from '@/lib/content';
import { SHOW_PH } from '@/lib/placeholder';

export const dynamic = 'force-static';
export const dynamicParams = false;
// only built with SHOW_PLACEHOLDERS=1: otherwise the placeholder projects are not on the site
export const generateStaticParams = () => (SHOW_PH ? PROJECTS : []).map((p) => ({ slug: p.slug }));

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PROJECTS.find((x) => x.slug === slug);
  return ogImage({ label: 'Case study', title: p ? `${p.title}: ${p.resultValue} ${p.resultLabel}` : 'Our work' });
}
