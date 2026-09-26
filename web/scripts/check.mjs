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
    small: [...small].slice(0, 8),
    tiny: tiny.slice(0, 8),
  };
}

const failures = [];
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
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  // §6.1b: the Hallmark Strike plays on a first visit with motion on, never with motion off,
  // and always ends by itself (the overlay must be gone before anything is audited).
  const played = await page.evaluate(() => localStorage.getItem('lf-intro-seen') === '1');
  (run.motion === 'reduce') === played ? fail(run.name, `intro ${played ? 'played with motion off' : 'did not play'}`) : pass(`intro ${played ? 'played' : 'skipped (motion off)'}`);
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

// Inner pages (PLAN §7): the same §4.8 audit at every viewport, both themes on phone
const PAGES = ['/services', '/services/website-development', '/services/whatsapp-automation', '/services/n8n-automation',
  '/work', '/work/project-one', '/team', '/team/member-one', '/contact', '/privacy', '/terms'];
const PAGE_RUNS = RUNS.filter((r) => r.audit || r.name === 'phone-light');
if (!process.env.SKIP_PAGES) for (const run of PAGE_RUNS.filter((r) => !only || r.name.includes(only))) {
  console.log(`\npages · ${run.name}`);
  const ctx = await browser.newContext({
    viewport: { width: run.viewport[0], height: run.viewport[1] },
    isMobile: run.touch, hasTouch: run.touch, colorScheme: run.scheme, reducedMotion: run.motion, deviceScaleFactor: 1,
  });
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
