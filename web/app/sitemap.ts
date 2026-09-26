import type { MetadataRoute } from 'next';
import { getTeam } from '@/lib/team';
import { getProjects } from '@/lib/work';
import { SERVICE_PAGES } from '@/lib/pages';
import { SITE } from '@/lib/site';
import { published } from '@/lib/blog';

/** PLAN §10.1. Every public route, with uploaded covers and team photos as sitemap images.
 *  Blog posts join when they leave draft. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, team] = await Promise.all([getProjects(), getTeam()]);
  const now = new Date();
  const u = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' | 'yearly' = 'monthly') =>
    ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency, priority });
  return [
    u('', 1, 'weekly'),
    u('/services', 0.9),
    ...SERVICE_PAGES.map((s) => u(`/services/${s.slug}`, 0.9)),
    u('/work', 0.8, 'weekly'),
    ...projects.map((p) => ({
      ...u(`/work/${p.slug}`, 0.7),
      ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
      ...(p.cover ? { images: [`${SITE.url}${p.cover.src}`] } : {}),        // image sitemap: uploaded covers
    })),
    u('/team', 0.6),
    ...team.map((m) => ({ ...u(`/team/${m.slug}`, 0.5), ...(m.photo ? { images: [`${SITE.url}${m.photo}`] } : {}) })),
    ...(published().length ? [u('/blog', 0.6, 'weekly')] : []),
    ...published().map((p) => ({ ...u(`/blog/${p.slug}`, 0.6), lastModified: new Date(p.date) })),
    u('/contact', 0.7),
    u('/privacy', 0.2, 'yearly'),
    u('/terms', 0.2, 'yearly'),
  ];
}
