import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** PLAN §10.1. Case studies, team pages and posts join this list as those routes ship. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
