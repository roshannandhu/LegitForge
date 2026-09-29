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
 *    SHOW_PLACEHOLDERS=1 npm run check               a build made with SHOW_PLACEHOLDERS=1: the demo
 *                                                   projects and team are there (work, team, 3D tests).
 *                                                   Without it: the production state, where no
 *                                                   [placeholder] text may show anywhere.
 *
 *  Screenshots go to .check/. Exits 1 on any failure. */

import { chromium } from 'playwright-core';
import { mkdir, readdir, readFile } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = '.check';
// Lite mode (lib/boot.ts) switches on for ≤4-core machines, like most CI runners: force it off
// (or on, with LITE=1) so the check audits the intended experience on any machine
const LITE = process.env.LITE === '1' ? '1' : '0';
const PH = process.env.SHOW_PLACEHOLDERS === '1';
// Deprecation notices printed by the 3D team's libraries, already at their latest versions
// (@react-three/fiber 9.8.1 creates a THREE.Clock; @react-three/rapier pins rapier3d-compat
// 0.19.2, whose own init() uses the old call). Not muted at runtime: listed here by exact text,
// printed on every run, and any other warning still fails the check.
const VENDOR_WARNINGS = [
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
  'using deprecated parameters for the initialization function; pass a single object instead',
];
const vendorSeen = new Set();
const isVendor = (text) => { const v = VENDOR_WARNINGS.find((w) => text.includes(w)); if (v) vendorSeen.add(v); return !!v; };
const LITE_INIT = (v) => { try { localStorage.setItem('lf-lite', v); } catch {} };

// What the team section must render per device class (§6.8 tiers)
const RUNS = [
  { name: 'laptop-dark',        viewport: [1440, 900],  touch: false, scheme: 'dark',  motion: 'no-preference', team: '3d',   audit: true },
  { name: 'laptop-light',       viewport: [1440, 900],  touch: false, scheme: 'light', motion: 'no-preference', team: '3d',   audit: false },
  { name: 'laptop-motion-off',  viewport: [1440, 900],  touch: false, scheme: 'dark',  motion: 'reduce',        team: 'flip', audit: false },
  { name: 'tablet-dark',        viewport: [768, 1024],  touch: true,  scheme: 'dark',  motion: 'no-preference', team: '3d',   audit: true },
  { name: 'phone-dark',         viewport: [375, 812],   touch: true,  scheme: 'dark',  motion: 'no-preference', team: '3d',   audit: true },
  { name: 'phone-light',        viewport: [375, 812],   touch: true,  scheme: 'light', motion: 'no-preference', team: '3d',   audit: false },
];

/** Runs in the page. The §4.8 gate, measured rather than eyeballed. */
function audit(PH) {
  const vw = innerWidth;
  // a clipped marquee; accordion panels clip their details; the compare frame clips its static half (slid by transform)
  const skip = '.projects, .lanyards, .stage-fit, .hp, .skip-link, .phone-menu, .sr-only, .team-canvas, .intro, .logoloop, .ag, .compare-static';
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
  const ids = ['top', 'services', 'quotation', 'compare', 'live-test', 'process', ...(PH ? ['work', 'team'] : []), 'proof', 'pricing', 'contact'];
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

// Every public page (the demo project and member only exist with SHOW_PLACEHOLDERS=1)
const PUBLIC = ['/', '/services', '/services/website-development', '/services/seo', '/work', ...(PH ? ['/work/project-one'] : []),
  '/team', ...(PH ? ['/team/member-one'] : []), '/contact', '/blog', '/blog/static-or-dynamic-website', '/privacy', '/terms'];

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

// Every page reads tagged data (the root layout reads 'company'). Next 16 answers 404
// (NoFallbackError) for a dynamicParams = false page once its tag expires, which each deploy
// and each admin save does: /services/* and the blog post were 404 live until 2026-09-29.
if (!only || only === 'seo') {
  console.log('\nsource');
  const pages = (await readdir('app', { recursive: true })).filter((p) => /(^|[\\/])page\.tsx$/.test(p));
  const bad = [];
  for (const p of pages) if (/export const dynamicParams\s*=\s*false/.test(await readFile(`app/${p}`, 'utf8'))) bad.push(p);
  bad.length ? fail('source', `dynamicParams = false in ${bad.join(', ')} (404 after a data change)`) : pass('no page sets dynamicParams = false');
}
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
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !isVendor(m.text()))) errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
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
    const a = await page.evaluate(audit, PH);
    a.overflow ? fail(run.name, `horizontal overflow ${a.overflow}px`) : pass('no horizontal overflow');
    // A phone widens its layout viewport to fit anything that escapes, and innerWidth follows,
    // so the overflow above reads 0. Compare with the device width instead.
    a.vw > run.viewport[0] ? fail(run.name, `layout viewport widened to ${a.vw}px`) : pass('layout viewport = device width');
    a.missing.length ? fail(run.name, `missing sections: ${a.missing}`) : pass(`all ${PH ? 11 : 9} sections present`);
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

  // Team (only when there are people to show): scroll near, wait for the expected layer
  if (PH) {
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
  }

  errors.length ? fail(run.name, `console errors or warnings:\n     ${errors.join('\n     ')}`) : pass('no console errors or warnings');
  await ctx.close();
}

// Share images (PLAN §22.4 step 1): every page type has a static PNG, and its tags point at it
if (!only || only === 'og') {
  console.log('\nshare images');
  for (const u of ['/opengraph-image', '/apple-icon', '/services/website-development/opengraph-image', ...(PH ? ['/og/work/project-one'] : []),
    '/blog/static-or-dynamic-website/opengraph-image', '/blog/static-or-dynamic-website/twitter-image']) {
    const r = await fetch(BASE + u);
    r.status === 200 && r.headers.get('content-type') === 'image/png' ? pass(u) : fail('og', `${u}: ${r.status} ${r.headers.get('content-type')}`);
  }
  for (const path of ['/', '/services/website-development', ...(PH ? ['/work/project-one'] : []), '/blog/static-or-dynamic-website']) {
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
    ProfessionalService: ['name', 'url'], WebSite: ['name', 'url'], ItemList: ['itemListElement'],
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
  const titles = new Map();
  for (const path of PUBLIC) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));      // lazy parts load too
    await page.waitForTimeout(800);
    const { blocks, csp, meta } = await page.evaluate(() => ({
      blocks: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      csp: window.__csp,
      meta: {
        title: document.title,
        h1: document.querySelectorAll('h1').length,
        desc: !!document.querySelector('meta[name="description"]')?.content,
        canonical: !!document.querySelector('link[rel="canonical"]'),
        og: !!document.querySelector('meta[property="og:image"]'),
        tw: !!document.querySelector('meta[name="twitter:image"]'),
        crumbs: !!document.querySelector('nav[aria-label="Breadcrumb"]'),
        noAlt: [...document.images].filter((i) => !i.alt.trim() && !i.closest('[aria-hidden="true"]')).map((i) => i.src.slice(-60)),
        brackets: [...new Set(document.body.innerText.match(/\[[A-Za-z][^\]\n]{0,60}\]/g) ?? [])],
      },
    }));
    const m = [
      meta.h1 !== 1 && `${meta.h1} h1 elements`, !meta.desc && 'no description', !meta.canonical && 'no canonical',
      !meta.og && 'no og:image', !meta.tw && 'no twitter:image', path !== '/' && !meta.crumbs && 'no breadcrumbs',
      meta.noAlt.length && `images without alt: ${meta.noAlt.join(', ')}`,
      !PH && meta.brackets.length && `placeholder text: ${meta.brackets.join(', ')}`,
      titles.has(meta.title) && `title "${meta.title}" also on ${titles.get(meta.title)}`,
    ].filter(Boolean);
    titles.set(meta.title, path);
    m.length ? fail('seo', `${path}: ${m.join('; ')}`) : pass(`${path} head, h1, breadcrumbs, alt text${PH ? '' : ', no placeholders'}`);
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
  // crawl files, and a 404 that asks not to be indexed and names no canonical
  for (const [u, type] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml'], ['/llms.txt', 'text/markdown']]) {
    const r = await fetch(BASE + u);
    r.status === 200 && (r.headers.get('content-type') ?? '').startsWith(type) ? pass(`${u} served`) : fail('seo', `${u}: ${r.status} ${r.headers.get('content-type')}`);
  }
  const nf = await fetch(BASE + '/no-such-page');
  const nfHtml = await nf.text();
  nf.status === 404 && /<meta name="robots" content="noindex/.test(nfHtml) && !/rel="canonical"/.test(nfHtml)
    ? pass('404: status 404, noindex, no canonical') : fail('seo', `404 page: status ${nf.status}, noindex or canonical wrong`);
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
  for (const path of PUBLIC) {
    const html = await (await fetch(BASE + path)).text();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ');
    for (const ch of text) { const c = ch.codePointAt(0); if (latin(c) && !covered.has(c) && c !== 0x20 && c !== 0xa0) missing.set(ch, path); }
  }
  missing.size === 0 ? pass('every Latin character on the pages is in the Archivo subset')
    : fail('glyphs', `not in app/fonts/archivo-latin.woff2: ${[...missing].map(([ch, p]) => `"${ch}" U+${ch.codePointAt(0).toString(16).toUpperCase()} (${p})`).join(', ')} — regenerate it (README "Fonts")`);
}

// Admin (PLAN §7.8): Google sign-in only (lib/admin/auth.ts). The dev bypass only works on
// localhost, so these requests go to this machine's network address instead.
if (!only || only === 'admin') {
  console.log('\nadmin access');
  const { networkInterfaces } = await import('node:os');
  const ip = Object.values(networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
  const locked = ip ? BASE.replace(/localhost|127\.0\.0\.1/, ip) : null;
  if (!locked || locked === BASE) console.log('  · skipped: no network address to test from (the bypass allows localhost)');
  else {
    const toSignIn = async (path, init = {}) => {
      const r = await fetch(locked + path, { ...init, redirect: 'manual' });
      return r.status === 307 && (r.headers.get('location') ?? '').endsWith('/admin/sign-in') ? true : `${r.status} ${r.headers.get('location') ?? ''}`;
    };
    for (const path of ['/admin', '/admin/access', '/admin/company', '/admin/projects', '/admin/preview/project-one']) {
      const r = await toSignIn(path);
      r === true ? pass(`${path} sends visitors to the Google sign-in`) : fail('admin', `${path} answered ${r} when signed out`);
    }
    // a session cookie we didn't sign (any email, far-off expiry) is worth nothing
    const forged = `__Host-lf_admin=${Buffer.from(JSON.stringify({ e: 'roshannandhu1100@gmail.com', x: 9e12 })).toString('base64url')}.AAAA`;
    const f = await toSignIn('/admin', { headers: { cookie: forged } });
    f === true ? pass('/admin rejects a forged session cookie') : fail('admin', `forged cookie got ${f}`);
    const page = await fetch(locked + '/admin/sign-in');
    const html = await page.text();
    // markup only: the admin's stylesheet rides along in the page data (inlineCss), so class
    // names in <style>/<script> are not a rendered admin
    const markup = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
    page.status === 200 && markup.includes('admin-google') && !markup.includes('admin-nav')
      ? pass('the sign-in page shows the Google button and nothing of the admin') : fail('admin', `/admin/sign-in answered ${page.status}`);
    /<meta name="robots" content="[^"]*noindex/.test(html) ? pass('/admin/sign-in is noindex') : fail('admin', '/admin/sign-in has no noindex');
    page.headers.get('x-frame-options') === 'DENY' ? pass('no other site can frame the admin') : fail('admin', '/admin/sign-in has no X-Frame-Options: DENY');
    const csp = page.headers.get('content-security-policy') ?? '';
    csp.includes("frame-ancestors 'none'") && csp.includes("form-action 'self'") && !csp.includes("'unsafe-eval'")
      ? pass('the admin enforces its content security policy') : fail('admin', `/admin/sign-in CSP: ${csp || 'none'}`);
    const up = await fetch(locked + '/api/admin/upload', { method: 'POST', body: new FormData() });
    up.status === 403 ? pass('POST /api/admin/upload is 403 signed out') : fail('admin', `upload answered ${up.status}`);
    const csv = await fetch(locked + '/admin/leads/export');
    csv.status === 403 ? pass('/admin/leads/export is 403 signed out') : fail('admin', `export answered ${csv.status}`);
    const signIn = (origin, credential) => fetch(locked + '/api/admin/session', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ credential }),
    });
    const fake = await signIn(locked, 'eyJhbGciOiJSUzI1NiIsImtpZCI6IngifQ.e30.AAAA');
    fake.status === 401 && !fake.headers.get('set-cookie')?.includes('lf_admin=e')
      ? pass('a forged Google token gets no session') : fail('admin', `forged Google token got ${fake.status}`);
    const cross = await signIn('https://evil.example', 'x');
    cross.status === 403 ? pass('sign-in refuses posts from other sites') : fail('admin', `cross-site sign-in got ${cross.status}`);
  }
}

// Inner pages (PLAN §7): the same §4.8 audit at every viewport, both themes on phone
const PAGES = ['/services', '/services/website-development', '/services/whatsapp-automation', '/services/n8n-automation', '/services/seo', '/services/nfc',
  '/work', ...(PH ? ['/work/project-one'] : []), '/team', ...(PH ? ['/team/member-one'] : []), '/contact', '/privacy', '/terms', '/blog', '/blog/static-or-dynamic-website'];
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
    const onErr = (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !isVendor(m.text()))) errors.push(`${m.type()}: ${m.text().slice(0, 160)}`); };
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
for (const w of vendorSeen) console.log(`\n· known third-party warning (not ours, see VENDOR_WARNINGS): ${w}`);
console.log(failures.length ? `\n${failures.length} failure(s).` : '\nAll checks passed.');
console.log(`Screenshots: ${OUT}/`);
process.exit(failures.length ? 1 : 0);
