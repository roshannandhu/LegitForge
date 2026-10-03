#!/usr/bin/env node
/** Read-only release gate. Never submits a lead, signs in, or sends an external message. */
import assert from 'node:assert/strict';

const base = (process.env.BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const expected = process.env.EXPECTED_REVISION || process.env.BUILD_REVISION;
const routes = ['/', '/services', '/services/website-development', '/services/whatsapp-automation',
  '/services/n8n-automation', '/services/seo', '/services/nfc', '/services/digital-signage',
  '/work', '/team', '/contact', '/blog', '/privacy', '/terms'];
const request = (path, options = {}) => fetch(base + path, {
  redirect: 'manual', signal: AbortSignal.timeout(30_000), ...options,
});

const health = await request('/api/health');
assert.equal(health.status, 200, 'health status');
assert.match(health.headers.get('cache-control') || '', /no-store/, 'health must not be cached');
const status = await health.json();
assert.equal(status.ok, true, 'health response');
if (expected) assert.equal(status.revision, expected, 'deployed revision differs from this release');
console.log(`✓ health; revision ${status.revision}`);

let home;
for (const path of routes) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} status`);
  assert.match(response.headers.get('content-type') || '', /text\/html/, `${path} content type`);
  const html = await response.text();
  assert.match(html, /^\s*<!DOCTYPE html>/i, `${path} must use standards mode`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path} needs one h1`);
  assert.match(html, /rel="canonical"/, `${path} needs a canonical`);
  if (process.env.ALLOW_EMPTY_COMPANY !== '1') {
    assert.doesNotMatch(html, /https:\/\/legitforge\.example|hello@legitforge\.example/, `${path} has unconfigured business defaults`);
  }
  if (path === '/') home = html;
  console.log(`✓ ${path}`);
}

for (const [path, type] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'xml'], ['/llms.txt', 'text/']]) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} status`);
  assert.ok((response.headers.get('content-type') || '').includes(type), `${path} content type`);
  console.log(`✓ ${path}`);
}
const asset = home.match(/<script[^>]*src="([^"?]+\/_next\/static\/[^"?]+\.js)/)?.[1]
  || home.match(/<script[^>]*src="(\/_next\/static\/[^"?]+\.js)/)?.[1];
assert.ok(asset, 'home must refer to its build assets');
const assetResponse = await request(new URL(asset, base).pathname);
assert.equal(assetResponse.status, 200, 'current build asset must be available');
assert.match(assetResponse.headers.get('content-type') || '', /javascript/, 'asset must not be an HTML fallback');
console.log('✓ current build asset');

const missing = await request('/__release_missing_page__');
assert.equal(missing.status, 404, 'missing page status');
assert.match(await missing.text(), /name="robots"[^>]*noindex/, 'missing page is noindex');
const admin = await request('/admin');
assert.ok([303, 307].includes(admin.status), 'signed-out admin must redirect');
assert.ok((admin.headers.get('location') || '').endsWith('/admin/sign-in'), 'admin sign-in destination');
const exported = await request('/admin/leads/export');
assert.equal(exported.status, 403, 'anonymous lead export must be refused');
console.log('✓ 404 and signed-out admin protection; no lead submitted');
