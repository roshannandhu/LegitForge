import { ogImage } from '@/lib/og';

export { size, contentType } from '@/lib/og';
export const alt = 'Legit Forge: we build the thing, and everything behind it.';

export default function TwitterImage() {
  return ogImage({ title: 'We build the thing, and everything behind it.' });
}
