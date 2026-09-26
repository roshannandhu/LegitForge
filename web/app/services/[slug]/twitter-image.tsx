import { ogImage } from '@/lib/og';
import { SERVICE_PAGES } from '@/lib/pages';

export { size, contentType } from '@/lib/og';
export const alt = 'Legit Forge service';
export const dynamicParams = false;
export const generateStaticParams = () => SERVICE_PAGES.map((s) => ({ slug: s.slug }));

export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SERVICE_PAGES.find((x) => x.slug === slug);
  return ogImage({ label: 'Service', title: s?.name ?? 'Services' });
}
