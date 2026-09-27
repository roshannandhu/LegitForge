import type { MetadataRoute } from 'next';
import { NOINDEX, SITE } from '@/lib/site';

/** PLAN §10.1: block /admin and /api from crawlers; everything on a temporary address. */
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
