#!/usr/bin/env node
/** Local browser release checks. Intercepts measurement; never submits enquiries. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = (process.env.BASE || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const routes = ['website-development', 'whatsapp-automation', 'n8n-automation', 'seo', 'nfc', 'digital-signage'];
// Useful when a link-check failure is fixed after the unchanged layouts already passed.
// The release preflight runs every phase by default.
const linksOnly = process.env.SERVICE_CHECK === 'links';
const profiles = [[375, 812, 'dark'], [375, 812, 'light'], [768, 1024, 'dark'], [768, 1024, 'light'],
  [1440, 900, 'dark'], [1440, 900, 'light'], [720, 450, 'light']];
await mkdir('.check', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
async function setup(context) {
  await context.route('**/api/events', (route) => route.fulfill({ status: 204 }));
  await context.addInitScript(() => { localStorage.setItem('lf-intro-seen', '1'); });
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ w: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(size.content <= size.w + 1, label + ': horizontal overflow');
}
async function keyboardDisclosure(page) {
  const details = page.locator('.faq-item').first();
  const summary = details.locator('summary');
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await details.evaluate((el) => el.open), true, 'Enter did not open native details');
  assert.equal(await details.locator('p').isVisible(), true, 'expanded answer is hidden');
  await page.keyboard.press('Space');
  assert.equal(await details.evaluate((el) => el.open), false, 'Space did not close native details');
}
let passed = 0;
try {
  for (const [width, height, theme] of linksOnly ? [] : profiles) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: width === 720 ? 2 : 1 });
    await setup(context);
    await context.addInitScript((theme) => {
      sessionStorage.setItem('lf-visit', '1');
      localStorage.setItem('theme', theme);
      localStorage.setItem('lf-theme-at', String(Date.now()));
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(BASE + '/services', { waitUntil: 'networkidle' });
      const order = await page.locator('.service-directory h2').allTextContents();
      assert.equal(order.length, 6, 'directory must retain six existing service pages');
      assert.equal(order[0], 'Websites and web apps', 'combined website/app page lost');
      assert.equal(order.at(-1), 'MR Signage', 'MR Signage is not last');
      assert.equal(await page.locator('.demo-player').count(), 0, 'directory still stacks demos');
      await noOverflow(page, 'directory');
      for (const slug of routes) {
        await page.goto(BASE + '/services/' + slug, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('html').evaluate((el, theme) => el.classList.contains(theme), theme), true, 'requested theme was not applied');
        const root = page.locator('[data-service-page]');
        assert.equal(await root.getAttribute('data-service-page'), slug);
        const order = await root.locator('[data-service-section]').evaluateAll((nodes) => nodes.map((node) => node.dataset.serviceSection));
        assert.deepEqual(order, ['builds', 'pricing', 'faq'], slug + ': service journey order');
        assert.equal(await root.locator('.demo-player').count(), 1, 'a service page shows exactly one demo');
        assert.equal(await root.locator('.page-head [data-service-demo="primary"] .demo-player').count(), 1, 'demo is not in the page head');
        if (width >= 1024) {
          const [copy, demo] = await root.locator('.page-head.has-aside > div').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
          assert.ok(demo.left >= copy.right - 1, 'demo is not beside the heading on a laptop');
        }
        assert.equal(await root.locator('#price h2').innerText(), 'Quotes and timelines');
        assert.equal(await root.locator('.work-grid, .project-card').count(), 0, 'projects shown on a service page');
        const text = await root.innerText();
        assert.doesNotMatch(text, /What people tell us before they call|Prices, up front|pass on at cost|#1 on Google Maps|few dollars a month|five-star review/i);
        const contact = await root.locator('.page-actions a.btn-primary').first().getAttribute('href');
        assert.ok(/^https:\/\/wa\.me\/\d+/.test(contact) || (process.env.ALLOW_EMPTY_COMPANY === '1' && contact === '/#contact'), 'contact action has invalid destination');
        if (slug === 'website-development') {
          const headings = await root.locator('[data-service-section="builds"] h3').allTextContents();
          assert.ok(headings.includes('Business websites') && headings.includes('Web apps'), 'combined service needs distinct website/app sections');
        }
        await keyboardDisclosure(page);
        await noOverflow(page, slug);
        if (width === 375 || width === 1440) await page.screenshot({ path: `.check/service-${slug}-${width}-${theme}.png`, fullPage: true });
        assert.deepEqual(errors, [], 'service runtime error');
        passed++;
        console.log(`✓ ${width}x${height}-${theme} ${slug}: demo at the top, scope, quotes and keyboard FAQ`);
      }
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  await setup(context);
  const page = await context.newPage();
  await page.goto(BASE + '/services/website-development#price', { waitUntil: 'networkidle' });
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await settle(page);
  const away = await page.evaluate(() => scrollY);
  await page.waitForTimeout(700);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - away) < 24, 'late hydration jumped the reader back to pricing');
  await context.close();
  // Native disclosures remain usable without client code on all existing service URLs.
  const native = await browser.newContext({ viewport: { width: 375, height: 812 }, javaScriptEnabled: false });
  const nativePage = await native.newPage();
  for (const slug of routes) {
    await nativePage.goto(BASE + '/services/' + slug, { waitUntil: 'networkidle' });
    const disclosure = nativePage.locator('.faq-item').first();
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.evaluate((el) => el.open), true, 'no-JS disclosure failed');
    await noOverflow(nativePage, slug + ' no-JS');
  }
  await native.close();
  console.log(linksOnly ? 'The pricing anchor and six no-JavaScript pages passed.'
    : `All ${passed} service layouts, the pricing anchor and six no-JavaScript pages passed.`);
} finally { await browser.close(); }
