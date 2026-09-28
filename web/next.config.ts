import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import createMDX from '@next/mdx';

/** PLAN §8.6, §13. The CSP is report-only until Turnstile and Web Analytics are live. `npm run
 *  check` (ONLY=seo) fails on any violation on every page, so switching to enforcing is then one
 *  line: rename the key to 'Content-Security-Policy'.
 *  'wasm-unsafe-eval' and connect-src blob: are for the 3D team cards (Rapier's WebAssembly
 *  physics, and three.js loading the card model and textures from blob URLs).
 *  accounts.google.com/gsi: Google's sign-in button on /admin/sign-in (lib/admin/auth.ts). */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://accounts.google.com/gsi/client",
      'frame-src https://challenges.cloudflare.com https://accounts.google.com/gsi/',
      "img-src 'self' data: blob:",
      "connect-src 'self' blob: https://cloudflareinsights.com https://accounts.google.com/gsi/",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "font-src 'self'",
    ].join('; '),
  },
];

/** The admin's own policy, ENFORCED (lib/admin/auth.ts): scripts, frames and connections only from
 *  this site and Google's sign-in, so injected code can't load or send anything elsewhere; no site
 *  may frame it; forms post only here. `next dev` also needs 'unsafe-eval' (React's dev tools). */
const adminCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://accounts.google.com/gsi/client https://static.cloudflareinsights.com`,
  'frame-src https://accounts.google.com/gsi/',
  "img-src 'self' data: blob:",
  "connect-src 'self' blob: https://accounts.google.com/gsi/ https://cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // CSS ships inside the HTML: no render-blocking stylesheet requests on first paint (PSI:
  // ~650 ms on slow 4G mobile). Most visitors are first-time, so a separate cache helps little.
  experimental: { inlineCss: true },
  images: { formats: ['image/avif', 'image/webp'] },
  productionBrowserSourceMaps: false,               // no source maps shipped to browsers
  // production bundles keep only console.error / console.warn (real failures)
  compiler: { removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // no other site may frame the admin (clickjacking), and its policy is enforced
      { source: '/admin/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }, { key: 'Content-Security-Policy', value: adminCsp }] },
    ];
  },
};

// Blog posts (content/blog/*.mdx, PLAN §7.4). Plugins are named by string so Turbopack can load them.
const withMDX = createMDX({ options: { remarkPlugins: [['remark-gfm', {}]] } });

export default withMDX(nextConfig);

// `next dev` gets the wrangler.jsonc bindings (local D1, R2) through this
initOpenNextCloudflareForDev();
