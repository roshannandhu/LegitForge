import type { MetadataRoute } from 'next';
import { PROJECTS, TEAM } from '@/lib/content';
import { SERVICE_PAGES } from '@/lib/pages';
import { SITE } from '@/lib/site';

/** PLAN §10.1. Every public route; blog posts join as they ship. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' | 'yearly' = 'monthly') =>
    ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency, priority });
  return [
    u('', 1, 'weekly'),
    u('/services', 0.9),
    ...SERVICE_PAGES.map((s) => u(`/services/${s.slug}`, 0.9)),
    u('/work', 0.8, 'weekly'),
    ...PROJECTS.map((p) => u(`/work/${p.slug}`, 0.7)),
    u('/team', 0.6),
    ...TEAM.map((m) => u(`/team/${m.slug}`, 0.5)),
    u('/contact', 0.7),
    u('/privacy', 0.2, 'yearly'),
    u('/terms', 0.2, 'yearly'),
  ];
}
