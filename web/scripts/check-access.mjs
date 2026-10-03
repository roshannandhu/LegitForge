#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#main');
  for (const id of ['services', 'contact', 'process', 'pricing']) {
    await page.goto(`${BASE}/#${id}`, { waitUntil: 'networkidle' });
    const target = page.locator(`#${id}`);
    assert.equal(await target.count(), 1);
    await page.waitForTimeout(100);
    assert.ok((await target.boundingBox()).y < 200, `#${id} anchor landing`);
  }
  const summary = page.locator('.faq summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate((el) => el.parentElement.open), true);
  console.log('✓ skip link, primary anchors and keyboard FAQ');
  // 1440 physical pixels at 200% zoom have a 720-CSS-pixel layout viewport.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false });
  for (const path of ['/', '/contact', '/services/website-development', '/privacy', '/terms']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(sizes.scroll <= sizes.width + 1, `${path} overflows at equivalent 200% zoom`);
  }
  console.log('✓ equivalent 200% zoom reflow at 720 CSS pixels');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#phone-menu').getAttribute('hidden'), null);
  assert.equal(await page.locator(':focus').evaluate((el) => !!el.closest('#phone-menu')), true);
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate((el) => document.activeElement === el), true);
  console.log('✓ mobile menu keyboard opening, focus trap entry, Escape and focus return');
  await ctx.close();
} finally { await browser.close(); }
