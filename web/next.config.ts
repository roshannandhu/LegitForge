import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/** PLAN §8.6, §13. The CSP starts report-only; switch to enforcing after every page has
 *  been tested with it (and after Turnstile and Web Analytics are live). */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      'frame-src https://challenges.cloudflare.com',
      "img-src 'self' data: blob:",
      "connect-src 'self' https://cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

// `next dev` gets the wrangler.jsonc bindings (local D1, R2) through this
initOpenNextCloudflareForDev();
