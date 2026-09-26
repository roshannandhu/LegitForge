/** The blog (PLAN §7.4). Posts are MDX in content/blog; this registry holds their details.
 *  Word counts and tables of contents come from lib/blog-index.generated.ts
 *  (scripts/blog-index.mjs). A draft is readable but noindex and left out of the sitemap:
 *  set draft to false once the copy is final. */

import { BLOG_INDEX } from './blog-index.generated';

export interface Post {
  slug: string;          // = content/blog/<slug>.mdx
  title: string;
  seoTitle?: string;     // shorter title for search results (<= 55 characters + the brand)
  description: string;   // meta description and the index card, <= 160 characters
  date: string;          // ISO date it was published
  author: string;        // TEAM slug
  service: string;       // SERVICE_PAGES slug for the related-service box
  draft: boolean;
}

const POSTS: Post[] = [
  {
    slug: 'what-a-whatsapp-bot-can-do',
    title: 'What a WhatsApp bot can (and can’t) do for a small business',
    seoTitle: 'What a WhatsApp bot can do for a small business',
    description: 'The questions a bot answers well, when it should hand over to a person, and the WhatsApp rules that keep your number safe.',
    date: '2026-09-24', author: 'member-two', service: 'whatsapp-automation', draft: true,
  },
  {
    slug: 'static-or-dynamic-website',
    title: 'Static or dynamic website: which one does your business need?',
    seoTitle: 'Static or dynamic website: which do you need?',
    description: 'One question tells you whether you need a fast static site or a web app, and why most businesses start static and add one moving part.',
    date: '2026-09-20', author: 'member-one', service: 'website-development', draft: true,
  },
];

export const posts = () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
export const findPost = (slug: string) => POSTS.find((p) => p.slug === slug);
export const postStats = (slug: string) => BLOG_INDEX[slug] ?? { words: 0, minutes: 1, toc: [] };
export const published = () => posts().filter((p) => !p.draft);

/** Two more posts: same service first, then the newest. */
export function relatedPosts(slug: string) {
  const self = findPost(slug);
  return posts().filter((p) => p.slug !== slug)
    .sort((a, b) => Number(b.service === self?.service) - Number(a.service === self?.service))
    .slice(0, 2);
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
