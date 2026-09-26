#!/usr/bin/env node
/** Site check in real Chrome (headless): the three-viewport gate (PLAN §4.8), the team
 *  section's layers (§6.8) and, against a production build, the first-load JS budget (§11.1).
 *  Rerun after any UI change.
 *
 *    npm run check                                  site at http://localhost:3000
 *    BASE=http://localhost:3200 npm run check       e.g. a production `next start`
 *    CHROME="/path/to/chrome" npm run check         if Chrome lives elsewhere
 *    ONLY=laptop-dark npm run check                  one scenario (substring match)
 *    SETTLE=5000 npm run check                       longer wait after a 3D flip, in ms
 *    SKIP_PAGES=1 npm run check                      home only, skip the inner-page audit
 *
 *  Screenshots go to .check/. Exits 1 on any failure. */

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = '.check';
// Lite mode (lib/boot.ts) switches on for ≤4-core machines, like most CI runners: force it off
// (or on, with LITE=1) so the check audits the intended experience on any machine
const LITE = process.env.LITE === '1' ? '1' : '0';
const LITE_INIT = (v) => { try { localStorage.setItem('lf-lite', v); } catch {} };

// What the team section must render per device class (§6.8 tiers)
const RUNS = [
  { name: 'laptop-dark',        viewport: [1440, 900],  touch: false, scheme: 'dark',  motion: 'no-preference', team: '3d',   audit: true },
  { name: 'laptop-light',       viewport: [1440, 900],  touch: false, scheme: 'light', motion: 'no-preference', team: '3d',   audit: false },
  { name: 'laptop-motion-off',  viewport: [1440, 900],  touch: false, scheme: 'dark',  motion: 'reduce',        team: 'flip', audit: false },
  { name: 'tablet-dark',        viewport: [768, 1024],  touch: true,  scheme: 'dark',  motion: 'no-preference', team: 'flip', audit: true },
  { name: 'phone-dark',         viewport: [375, 812],   touch: true,  scheme: 'dark',  motion: 'no-preference', team: 'flip', audit: true },
  { name: 'phone-light',        viewport: [375, 812],   touch: true,  scheme: 'light', motion: 'no-preference', team: 'flip', audit: false },
];

/** Runs in the page. The §4.8 gate, measured rather than eyeballed. */
function audit() {
  const vw = innerWidth;
  const skip = '.projects, .lanyards, .stage-fit, .hp, .skip-link, .phone-menu, .sr-only, .team-canvas, .intro';
  const name = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '');
  const escapees = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || el.closest(skip)) return;
    if (r.right > vw + 1 || r.left < -1) escapees.push(`${name(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  });
  const small = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('[aria-hidden="true"], .sr-only, .hp')) return;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (parseFloat(cs.fontSize) < 14) small.add(`${name(el)} ${cs.fontSize}`);
  });
  const tiny = [];
  document.querySelectorAll('a, button, input, select, textarea, summary').forEach((el) => {
    if (el.closest('[aria-hidden="true"], .hp, .sr-only, .skip-link, [hidden]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.type === 'range' || el.type === 'checkbox') return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const inline = el.tagName === 'A' && el.closest('p, li, td');     // WCAG 2.5.8 inline exception
    if (r.height < 44 && !inline) tiny.push(`${name(el)} h=${Math.round(r.height)}`);
  });
  const ids = ['top', 'services', 'quotation', 'compare', 'live-test', 'process', 'work', 'team', 'proof', 'pricing', 'contact'];
  return {
    vw,
    overflow: Math.max(0, Math.round(document.documentElement.scrollWidth - vw)),
    missing: ids.filter((i) => !document.getElementById(i)),
    escapees: escapees.slice(0, 8),
    // SEO basics (plan B): one h1, a canonical, and titles and descriptions search shows in full
    seo: {
      h1: document.querySelectorAll('h1').length,
      canonical: !!document.querySelector('link[rel="canonical"]'),
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    },
    small: [...small].slice(0, 8),
    tiny: tiny.slice(0, 8),
  };
}

const failures = [];
/** Titles up to 70 characters (the brand suffix may be cut), descriptions 50–160, one h1, a canonical. */
const seoProblems = (s) => [
  s.h1 !== 1 && `${s.h1} h1 elements`,
  !s.canonical && 'no canonical link',
  s.title.length > 70 && `title is ${s.title.length} characters: "${s.title}"`,
  (s.desc.length < 50 || s.desc.length > 160) && `description is ${s.desc.length} characters`,
].filter(Boolean);
const fail = (run, msg) => { failures.push(`${run}: ${msg}`); console.log(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
let budgetChecked = false;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  // software WebGL in headless Chrome, so the 3D layer can actually be tested
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const only = process.env.ONLY;
const settle = Number(process.env.SETTLE ?? 2200);

for (const run of RUNS.filter((r) => !only || r.name.includes(only))) {
  console.log(`\n${run.name}  (${run.viewport.join('×')}, ${run.scheme}, motion ${run.motion === 'reduce' ? 'off' : 'on'})`);
  const ctx = await browser.newContext({
    viewport: { width: run.viewport[0], height: run.viewport[1] },
    isMobile: run.touch, hasTouch: run.touch, colorScheme: run.scheme, reducedMotion: run.motion,
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(LITE_INIT, LITE);   // the full site; LITE=1 npm run check audits lite mode
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  // §6.1b: the Hallmark Strike plays on a first visit with motion on, never with motion off,
  // and always ends by itself (the overlay must be gone before anything is audited).
  const played = await page.evaluate(() => localStorage.getItem('lf-intro-seen') === '1');
  const expectIntro = run.motion !== 'reduce';
  expectIntro !== played ? fail(run.name, `intro ${played ? 'played when it should not' : 'did not play'}`) : pass(`intro ${played ? 'played' : 'skipped (motion off)'}`);
  const ended = await page.waitForFunction(() => !document.documentElement.dataset.intro, null, { timeout: 4000 }).then(() => true, () => false);
  ended ? pass('intro ended by itself') : fail(run.name, 'intro overlay still up after 4 s');
  await page.screenshot({ path: `${OUT}/${run.name}-hero.png` });

  if (run.audit) {
    const a = await page.evaluate(audit);
    a.overflow ? fail(run.name, `horizontal overflow ${a.overflow}px`) : pass('no horizontal overflow');
    // A phone widens its layout viewport to fit anything that escapes, and innerWidth follows,
    // so the overflow above reads 0. Compare with the device width instead.
    a.vw > run.viewport[0] ? fail(run.name, `layout viewport widened to ${a.vw}px`) : pass('layout viewport = device width');
    a.missing.length ? fail(run.name, `missing sections: ${a.missing}`) : pass('all 11 sections present');
    a.escapees.length ? fail(run.name, `elements outside viewport: ${a.escapees.join(', ')}`) : pass('nothing escapes the viewport');
    const seoBad = seoProblems(a.seo);
    seoBad.length ? fail(run.name, `SEO: ${seoBad.join('; ')}`) : pass(`SEO basics (h1, canonical, title ${a.seo.title.length}, description ${a.seo.desc.length})`);
    a.small.length ? fail(run.name, `text under 14px: ${a.small.join(', ')}`) : pass('no text under 14px');
    a.tiny.length ? fail(run.name, `targets under 44px: ${a.tiny.join(', ')}`) : pass('all targets ≥ 44px');

    // §11.1 budget: JS on first load of home, compressed. Same for every viewport, so once.
    // First load = the scripts the served HTML asks for (Next's definition). What arrives
    // after hydration (GSAP, lib/gsap.ts) is printed, not budgeted.
    if (!budgetChecked) {
      budgetChecked = true;
      const html = await (await page.request.get(page.url())).text();
      const initial = new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)]
        .filter((m) => !/nomodule/i.test(m[0]))                  // polyfills: legacy browsers only
        .map((m) => new URL(m[1], page.url()).pathname));
      const js = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter((e) => e.name.endsWith('.js')).map((e) => [new URL(e.name).pathname, e.encodedBodySize]));
      const kb = (list) => list.reduce((a, [, b]) => a + b, 0) / 1024;
      if (js.some(([p]) => p.includes('hmr-client'))) console.log('  · JS budget skipped: dev chunks are unminified (run against `next start`)');
      else {
        const first = kb(js.filter(([p]) => initial.has(p)));
        const msg = `first-load JS ${first.toFixed(1)} KB (budget 180 KB), then ${kb(js.filter(([p]) => !initial.has(p))).toFixed(1)} KB after hydration`;
        first > 180 ? fail(run.name, msg) : pass(msg);
      }
    }
  }

  // Team: scroll near, wait for the expected layer
  await page.evaluate(() => document.getElementById('team').scrollIntoView({ block: 'start' }));
  const stage = page.locator('.team-stage');
  try {
    await page.waitForSelector(`.team-stage[data-mode="${run.team}"]`, { timeout: 20000 });
    if (run.team === '3d') await page.waitForSelector('.team-stage[data-3d-ready="true"]', { timeout: 20000 });
    pass(`team renders the ${run.team} layer`);
  } catch {
    const got = await stage.getAttribute('data-mode');
    fail(run.name, `team expected "${run.team}", got "${got}"`);
  }
  await page.waitForTimeout(run.team === '3d' ? 2500 : 600);            // let the cards swing in / settle
  await stage.screenshot({ path: `${OUT}/${run.name}-team.png` });

  // Flip the first card through its accessible control (the name-tag button)
  const btn = page.locator('.name-tag .flip-btn').first();
  await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));   // clear of the fixed header, as a real scroll leaves it
  await btn.click({ timeout: 8000 });
  const pressed = await btn.getAttribute('aria-pressed');
  pressed === 'true' ? pass('name-tag button flips the card (aria-pressed=true)') : fail(run.name, `flip button aria-pressed=${pressed}`);
  await page.waitForTimeout(run.team === '3d' ? settle : 900);
  await stage.screenshot({ path: `${OUT}/${run.name}-team-flipped.png` });

  errors.length ? fail(run.name, `console errors:\n     ${errors.join('\n     ')}`) : pass('no console errors');
  await ctx.close();
}

// Share images (PLAN §22.4 step 1): every page type has a static PNG, and its tags point at it
if (!only || only === 'og') {
  console.log('\nshare images');
  for (const u of ['/opengraph-image', '/services/website-development/opengraph-image', '/og/work/project-one',
    '/blog/static-or-dynamic-website/opengraph-image', '/blog/static-or-dynamic-website/twitter-image']) {
    const r = await fetch(BASE + u);
    r.status === 200 && r.headers.get('content-type') === 'image/png' ? pass(u) : fail('og', `${u}: ${r.status} ${r.headers.get('content-type')}`);
  }
  for (const path of ['/', '/services/website-development', '/work/project-one', '/blog/static-or-dynamic-website']) {
    const html = await (await fetch(BASE + path)).text();
    const og = html.includes('property="og:image"'), tw = html.includes('name="twitter:image"');
    og && tw ? pass(`${path} has og:image and twitter:image`) : fail('og', `${path}: og:image ${og}, twitter:image ${tw}`);
  }
}

// Structured data and the security policy (plan J): every JSON-LD block parses and carries the
// fields search engines require for its type, and no page trips the CSP. The policy is still
// report-only, but the browser fires securitypolicyviolation for it all the same, so this is
// the test that makes switching it to enforcing a one-line change.
if (!only || only === 'seo') {
  console.log('\nstructured data and CSP');
  const REQUIRED = {
    ProfessionalService: ['name', 'url', 'address'], WebSite: ['name', 'url'], ItemList: ['itemListElement'],
    FAQPage: ['mainEntity'], Service: ['name', 'provider'], BreadcrumbList: ['itemListElement'], CreativeWork: ['name'],
    Person: ['name'], BlogPosting: ['headline', 'datePublished', 'author', 'image', 'publisher'],
  };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('lf-intro-seen', '1');
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || '(inline)'}`));
  });
  const page = await ctx.newPage();
  for (const path of ['/', '/services', '/services/website-development', '/work', '/work/project-one', '/team', '/team/member-one',
    '/contact', '/blog', '/blog/static-or-dynamic-website', '/privacy', '/terms']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));      // lazy parts load too
    await page.waitForTimeout(800);
    const { blocks, csp } = await page.evaluate(() => ({
      blocks: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      csp: window.__csp,
    }));
    const bad = [];
    const types = [];
    for (const raw of blocks) {
      let d; try { d = JSON.parse(raw); } catch { bad.push('a JSON-LD block does not parse'); continue; }
      for (const item of Array.isArray(d) ? d : [d]) {
        if (item['@context'] !== 'https://schema.org') bad.push(`${item['@type']}: no schema.org @context`);
        const need = REQUIRED[item['@type']];
        if (!need) { bad.push(`unexpected type ${item['@type']}`); continue; }
        types.push(item['@type']);
        const missing = need.filter((k) => item[k] == null || (Array.isArray(item[k]) && !item[k].length));
        if (missing.length) bad.push(`${item['@type']} misses ${missing.join(', ')}`);
        if (item['@type'] === 'FAQPage' && item.mainEntity.some((q) => !q.name || !q.acceptedAnswer?.text)) bad.push('FAQPage has a question without an answer');
      }
    }
    bad.length ? fail('seo', `${path}: ${bad.join('; ')}`) : pass(`${path} JSON-LD ok${types.length ? ` (${types.join(', ')})` : ''}`);
    csp.length ? fail('seo', `${path}: CSP would block ${[...new Set(csp)].join(', ')}`) : pass(`${path} no CSP violations`);
  }
  await ctx.close();
}

// Demos flow (plan F step 4): after the intro every service demo keeps changing, forever,
// and never fades its box out to restart (no "reload")
if (!only || only === 'flow') {
  console.log('\ndemo flows');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('lf-intro-seen', '1'));
  await ctx.addInitScript(LITE_INIT, LITE);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  for (const kind of ['website', 'app', 'whatsapp', 'n8n', 'seo', 'nfc', 'quote']) {
    const demo = page.locator(`.demo-player:has(.demo-${kind})`).first();
    await demo.scrollIntoViewIfNeeded();
    await page.evaluate((k) => {
      const box = document.querySelector(`.demo-player > .demo-${k}`);
      window.__minOp = 1;
      const f = () => { window.__minOp = Math.min(window.__minOp, +getComputedStyle(box).opacity); if (window.__k === k) requestAnimationFrame(f); };
      window.__k = k; f();
    }, kind);
    await page.waitForTimeout(5000);                                  // the intro
    const shots = new Set();
    for (let i = 0; i < 8; i++) { shots.add((await demo.screenshot()).toString('base64')); await page.waitForTimeout(700); }
    const minOp = await page.evaluate(() => window.__minOp);
    shots.size >= 4 ? pass(`${kind}: keeps changing (${shots.size}/8 distinct frames)`) : fail('flow', `${kind}: only ${shots.size}/8 distinct frames after the intro`);
    minOp > 0.9 ? pass(`${kind}: never fades out to restart`) : fail('flow', `${kind}: the box faded to opacity ${minOp}`);
  }
  await ctx.close();
}

// Font coverage: Archivo is one self-hosted subset (app/fonts/archivo-latin.woff2). Every Latin
// character a page shows must be in it, or it would silently render in the fallback font.
// Symbols Google never served in Archivo (arrows, ★, ✓, box drawing) stay system glyphs, as before.
if (!only || only === 'glyphs') {
  console.log('\nfont coverage');
  const { readFile } = await import('node:fs/promises');
  const covered = new Set(JSON.parse(await readFile(new URL('../app/fonts/archivo-latin.codepoints.json', import.meta.url), 'utf8')));
  const latin = (c) => (c >= 0x20 && c <= 0x24f) || (c >= 0x2000 && c <= 0x206f) || c === 0x20b9 || c === 0x20ac || c === 0x2122;
  const missing = new Map();
  for (const path of ['/', '/services/website-development', '/services/seo', '/work/project-one', '/team', '/team/member-one', '/contact', '/blog/static-or-dynamic-website', '/privacy']) {
    const html = await (await fetch(BASE + path)).text();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ');
    for (const ch of text) { const c = ch.codePointAt(0); if (latin(c) && !covered.has(c) && c !== 0x20 && c !== 0xa0) missing.set(ch, path); }
  }
  missing.size === 0 ? pass('every Latin character on the pages is in the Archivo subset')
    : fail('glyphs', `not in app/fonts/archivo-latin.woff2: ${[...missing].map(([ch, p]) => `"${ch}" U+${ch.codePointAt(0).toString(16).toUpperCase()} (${p})`).join(', ')} — regenerate it (README "Fonts")`);
}

// Admin (PLAN §7.8): locked to anyone without a valid Cloudflare Access JWT. The dev bypass
// only works on localhost, so these requests go to this machine's network address instead.
if (!only || only === 'admin') {
  console.log('\nadmin access');
  const { networkInterfaces } = await import('node:os');
  const ip = Object.values(networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
  const locked = ip ? BASE.replace(/localhost|127\.0\.0\.1/, ip) : null;
  if (!locked || locked === BASE) console.log('  · skipped: no network address to test from (the bypass allows localhost)');
  else {
    const page = await fetch(locked + '/admin');
    const html = await page.text();
    page.status === 404 && !html.includes('admin-nav') ? pass('/admin is a 404 without Access') : fail('admin', `/admin answered ${page.status} without Access`);
    /<meta name="robots" content="[^"]*noindex/.test(html) ? pass('/admin is noindex') : fail('admin', '/admin has no noindex');
    const forged = await fetch(locked + '/admin', { headers: { 'cf-access-jwt-assertion': 'e30.e30.AAAA' } });
    forged.status === 404 ? pass('/admin rejects a forged Access token') : fail('admin', `forged token got ${forged.status}`);
    const up = await fetch(locked + '/api/admin/upload', { method: 'POST', body: new FormData() });
    up.status === 403 ? pass('POST /api/admin/upload is 403 without Access') : fail('admin', `upload answered ${up.status}`);
    const csv = await fetch(locked + '/admin/leads/export');
    csv.status === 403 ? pass('/admin/leads/export is 403 without Access') : fail('admin', `export answered ${csv.status}`);
    const prev = await fetch(locked + '/admin/preview/project-one');
    prev.status === 404 ? pass('draft preview is a 404 without Access') : fail('admin', `preview answered ${prev.status}`);
  }
}

// Inner pages (PLAN §7): the same §4.8 audit at every viewport, both themes on phone
const PAGES = ['/services', '/services/website-development', '/services/whatsapp-automation', '/services/n8n-automation', '/services/seo', '/services/nfc',
  '/work', '/work/project-one', '/team', '/team/member-one', '/contact', '/privacy', '/terms', '/blog', '/blog/static-or-dynamic-website'];
const PAGE_RUNS = RUNS.filter((r) => r.audit || r.name === 'phone-light');
if (!process.env.SKIP_PAGES) for (const run of PAGE_RUNS.filter((r) => !only || r.name.includes(only))) {
  console.log(`\npages · ${run.name}`);
  const ctx = await browser.newContext({
    viewport: { width: run.viewport[0], height: run.viewport[1] },
    isMobile: run.touch, hasTouch: run.touch, colorScheme: run.scheme, reducedMotion: run.motion, deviceScaleFactor: 1,
  });
  await ctx.addInitScript(LITE_INIT, LITE);
  const page = await ctx.newPage();
  for (const path of PAGES) {
    const errors = [];
    const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); };
    page.on('console', onErr);
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const a = await page.evaluate(audit);
    const bad = [
      res.status() !== 200 && `status ${res.status()}`,
      a.overflow && `overflow ${a.overflow}px`,
      a.vw > run.viewport[0] && `layout viewport widened to ${a.vw}px`,
      a.escapees.length && `escapes: ${a.escapees.join(', ')}`,
      ...seoProblems(a.seo),
      a.small.length && `text under 14px: ${a.small.join(', ')}`,
      a.tiny.length && `targets under 44px: ${a.tiny.join(', ')}`,
      errors.length && `console: ${errors.join(' | ')}`,
    ].filter(Boolean);
    bad.length ? fail(`${run.name} ${path}`, `${path}: ${bad.join('; ')}`) : pass(path);
    await page.screenshot({ path: `${OUT}/page-${run.name}${path.replaceAll('/', '_')}.png`, fullPage: true });
    page.off('console', onErr);
  }
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s).` : '\nAll checks passed.');
console.log(`Screenshots: ${OUT}/`);
process.exit(failures.length ? 1 : 0);
