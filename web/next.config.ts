import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import createMDX from '@next/mdx';

/** PLAN §8.6, §13. The CSP is report-only until Turnstile and Web Analytics are live. `npm run
 *  check` (ONLY=seo) fails on any violation on every page, so switching to enforcing is then one
 *  line: rename the key to 'Content-Security-Policy'.
 *  'wasm-unsafe-eval' and connect-src blob: are for the 3D team cards (Rapier's WebAssembly
 *  physics, and three.js loading the card model and textures from blob URLs). */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      'frame-src https://challenges.cloudflare.com',
      "img-src 'self' data: blob:",
      "connect-src 'self' blob: https://cloudflareinsights.com",
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

// Blog posts (content/blog/*.mdx, PLAN §7.4). Plugins are named by string so Turbopack can load them.
const withMDX = createMDX({ options: { remarkPlugins: [['remark-gfm', {}]] } });

export default withMDX(nextConfig);

// `next dev` gets the wrangler.jsonc bindings (local D1, R2) through this
initOpenNextCloudflareForDev();
