import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** PLAN §10.1: block /admin and /api from crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
