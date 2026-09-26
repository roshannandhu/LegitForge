import { ogImage } from '@/lib/og';
import { PROJECTS } from '@/lib/content';

export { size, contentType } from '@/lib/og';
export const alt = 'Legit Forge case study';
export const dynamicParams = false;
export const generateStaticParams = () => PROJECTS.map((p) => ({ slug: p.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PROJECTS.find((x) => x.slug === slug);
  return ogImage({ label: 'Case study', title: p ? `${p.title}: ${p.resultValue} ${p.resultLabel}` : 'Our work' });
}
