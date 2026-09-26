import { ogImage } from '@/lib/og';
import { findPost, posts } from '@/lib/blog';

export { size, contentType } from '@/lib/og';
export const alt = 'Legit Forge blog post';
export const dynamicParams = false;
export const generateStaticParams = () => posts().map((p) => ({ slug: p.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = findPost(slug);
  return ogImage({ label: 'Blog', title: p?.title ?? 'Blog' });
}
