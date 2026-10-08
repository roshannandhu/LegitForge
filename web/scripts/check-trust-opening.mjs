#!/usr/bin/env node
/** Focused browser release gate; analytics are intercepted and no enquiry is submitted. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { assertTrustClosed, assertTrustCopyReadable, checkTrustOpening, positionTrustHeading, readTrustFrame, readTrustRange, scrollTrustTo } from './trust-opening.mjs';

const BASE = (process.env.BASE || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const OUT = '.check';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const sizes = [[375, 812], [768, 1024], [1440, 900]];
const cases = [];
for (const [width, height] of sizes) {
  for (const theme of ['dark', 'light']) cases.push({ width, height, theme, mode: 'on' });
  for (const mode of ['user-off', 'reduced', 'no-js', 'delayed', 'failed']) cases.push({ width, height, theme: 'dark', mode });
  for (const test of ['anchors', 'fast-scroll', 'jump']) cases.push({ width, height, theme: 'dark', mode: 'on', test });
}
cases.push({ width: 720, height: 450, theme: 'light', mode: 'on', zoom: true });
cases.push({ width: 1440, height: 900, theme: 'dark', mode: 'on', test: 'keyboard' });
cases.push({ width: 375, height: 812, theme: 'dark', mode: 'on', test: 'resize' });
cases.push({ width: 1440, height: 900, theme: 'light', mode: 'on', test: 'resize' });
cases.push({ width: 375, height: 812, theme: 'dark', mode: 'on', test: 'menu' });
cases.push({ width: 1440, height: 900, theme: 'dark', mode: 'on', test: 'intro' });
cases.push({ width: 1440, height: 900, theme: 'dark', mode: 'on', test: 'hidden' });
const name = (run) => run.width + 'x' + run.height + '-' + run.theme + '-' + (run.test || run.mode) + (run.zoom ? '-200pct' : '');
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
const scrollIdle = (page) => page.evaluate(() => new Promise((done, fail) => {
  const deadline = performance.now() + 4000;
  let previous = scrollY, still = 0;
  const frame = () => {
    still = scrollY === previous ? still + 1 : 0;
    previous = scrollY;
    if (still >= 8) return done();
    if (performance.now() > deadline) return fail(new Error('Scroll did not settle'));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}));
const waitOpen = (page) => page.waitForFunction(() => document.querySelector('.cleave[data-read-first]').dataset.phase === 'open', null, { timeout: 4000 });
const travel = readTrustRange;
const assertIdle = async (page, before, message, duration = 400) => {
  await page.waitForTimeout(duration);
  const after = await readTrustFrame(page);
  assert.ok(Math.abs(after.leftX - before.leftX) < 0.25 && Math.abs(after.rightX - before.rightX) < 0.25, message);
  return after;
};
const startPartial = async (page) => {
  await positionTrustHeading(page);
  const range = await travel(page);
  await scrollTrustTo(page, range.start + (range.end - range.start) * 0.6);
  const partial = await readTrustFrame(page);
  assert.equal(partial.phase, 'opening', 'scrolling did not expose an intermediate split');
  assert.ok(partial.leftX < -1 && partial.rightX > 1 && partial.coverVisible, 'steel did not visibly split');
  return partial;
};
const complete = async (page) => {
  const frame = await readTrustFrame(page);
  // Responsive reflow can move the heading below entry while diagnostics still describe
  // the previous viewport. Seek the actual heading endpoint, never a stale dataset end.
  await scrollTrustTo(page, frame.scrollY + frame.top - (frame.upper + 24) + 8);
  await waitOpen(page);
  await assertTrustCopyReadable(page);
};
const reverseAndClose = async (page) => {
  const range = await travel(page);
  const split = Number.isFinite(range.split) ? range.split : range.start + (range.end - range.start) * 0.25;
  await scrollTrustTo(page, split + (range.end - split) * 0.5);
  const partial = await readTrustFrame(page);
  assert.equal(partial.phase, 'opening', 'reverse scrolling skipped a partial closing frame');
  assert.ok(partial.leftX < -1 && partial.rightX > 1 && partial.coverVisible, 'reverse scrolling did not paint closing steel');
  await assertIdle(page, partial, 'closing steel continued while scrolling stopped');
  await scrollTrustTo(page, range.start);
  await assertTrustClosed(page);
};

async function checkExtra(page, run) {
  if (run.test === 'anchors') {
    const initial = await readTrustFrame(page);
    assert.equal(initial.phase, 'closed', 'direct #promises landing skipped the readable closed title');
    assert.ok(Math.abs(initial.leftX) < 0.1 && initial.coverVisible, 'direct anchor landed on an already split cover');
    await assertIdle(page, initial, 'direct anchor started autoplay', 1750);
    const range = await travel(page);
    await scrollTrustTo(page, range.start + (range.end - range.start) * 0.6);
    const partial = await readTrustFrame(page);
    assert.ok(partial.leftX < -1 && partial.rightX > 1, 'scrolling from #promises did not show the split');
    await complete(page);
    await reverseAndClose(page);
    for (const id of ['work', 'services', 'contact', 'process', 'pricing']) {
      await page.goto(BASE + '/#' + id, { waitUntil: 'networkidle' });
      await page.locator('#' + id).waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      const target = await page.locator('#' + id).boundingBox();
      assert.ok(target.y >= 40 && target.y < 200, '#' + id + ' anchor is obscured or displaced');
    }
    return 'direct promise landing and all primary homepage anchors';
  }
  if (run.test === 'jump') {
    const end = await page.locator('.cleave[data-read-first]').evaluate((el) => el.getBoundingClientRect().bottom + scrollY + 100);
    await scrollTrustTo(page, end);
    await waitOpen(page);
    await assertTrustCopyReadable(page);
    await reverseAndClose(page);
    return 'fresh jump opens the content and reverse scrolling closes through visible frames';
  }
  if (run.test === 'fast-scroll') {
    await positionTrustHeading(page);
    const range = await travel(page);
    const distance = (range.end - range.start) * 0.6;
    if (run.width < 1024) {
      const cdp = await page.context().newCDPSession(page);
      try {
        // synthesizeScrollGesture(touch) is a no-op in Windows headless Chrome. Send actual
        // touch points, inspect a bounded swipe, then hold briefly before lifting to avoid
        // a fling racing past the frame being measured. Fresh long jumps are checked separately.
        const x = Math.round(run.width / 2), y = Math.round(run.height * 0.72);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 10; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance * step / 10 }] });
          await page.waitForTimeout(16);
        }
        await page.waitForTimeout(250);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(100);
      } finally { await cdp.detach(); }
    } else {
      await page.mouse.move(run.width / 2, run.height * 0.7);
      await page.mouse.wheel(0, distance);
      await page.waitForTimeout(150);
    }
    await settle(page);
    const partial = await readTrustFrame(page);
    assert.equal(partial.phase, 'opening', 'fast forward scrolling skipped the visible split');
    assert.ok(partial.leftX < -1 && partial.rightX > 1 && partial.coverVisible, 'fast scrolling did not paint split halves');
    // Desktop Lenis keeps actual scrolling after wheel input ends. Those frames should move
    // the steel; assert no autoplay only once actual scrolling has settled.
    await scrollIdle(page);
    await assertIdle(page, await readTrustFrame(page), 'fast scroll left the split playing while idle');
    await complete(page);
    await reverseAndClose(page);
    return run.width < 1024 ? 'fast touch swipe paints a split and stops with scrolling' : 'fast wheel scrolling paints a split and stops with scrolling';
  }
  if (run.test === 'keyboard') {
    await positionTrustHeading(page);
    await page.evaluate(() => document.activeElement?.blur());
    let frame = await readTrustFrame(page);
    // The eased split first changes phase with sub-pixel movement. Keep using genuine
    // keyboard scrolling until both halves are visibly moving, rather than stopping at state alone.
    for (let i = 0; i < 24 && frame.phase !== 'open' && !(frame.leftX < -1 && frame.rightX > 1); i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(180);
      frame = await readTrustFrame(page);
    }
    assert.equal(frame.phase, 'opening', 'keyboard scrolling never revealed a visible split');
    assert.ok(frame.leftX < -1 && frame.rightX > 1, 'keyboard scroll changed state without moving the steel');
    await scrollIdle(page);
    await assertIdle(page, await readTrustFrame(page), 'keyboard scrolling triggered autoplay');
    await complete(page);
    await page.keyboard.press('PageUp');
    await scrollIdle(page);
    await assertTrustClosed(page);
    return 'keyboard scrolling opens progressively and reverse keys close the steel';
  }
  const partial = await startPartial(page);
  if (run.test === 'hidden') {
    // Headless Chrome keeps its pages visible. Exercise the visibility lifecycle
    // deterministically, including scroll events received while the tab is hidden.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await scrollTrustTo(page, partial.scrollY + 32);
    await assertIdle(page, partial, 'hidden-tab travel changed the painted split');
    await page.evaluate(() => {
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle(page);
    const returned = await readTrustFrame(page);
    assert.ok(Math.abs(returned.leftX - partial.leftX) < 0.25, 'visible-tab return counted hidden scroll travel');
    await assertIdle(page, returned, 'visible-tab return triggered autoplay');
    await complete(page);
    await reverseAndClose(page);
    return 'simulated hidden-tab lifecycle freezes and rebases the reversible split';
  }
  if (run.test === 'resize') {
    const destination = run.width < 1024 ? { width: 1440, height: 900 } : { width: 375, height: 812 };
    await page.setViewportSize(destination);
    await page.waitForTimeout(150);
    const resized = await readTrustFrame(page);
    assert.ok(Math.abs(resized.leftX / resized.width - partial.leftX / partial.width) < 0.02, 'resize rewound or advanced the opening');
    assert.equal(resized.phase, 'opening', 'resize discarded the partial split');
    await assertIdle(page, resized, 'resized opening progressed without scrolling');
    // Chrome may move to scrollY=0 when changing mobile emulation to desktop.
    // Establish real reverse travel first when the page cannot scroll farther up.
    let reverseFrom = resized;
    if (resized.scrollY <= 8) {
      await scrollTrustTo(page, 32);
      reverseFrom = await readTrustFrame(page);
    }
    await scrollTrustTo(page, reverseFrom.scrollY - 8);
    const reversed = await readTrustFrame(page);
    assert.equal(reversed.phase, 'opening', 'small reverse scroll after resize snapped the steel closed');
    assert.ok(reversed.progress < reverseFrom.progress, 'reverse scroll after resize did not close progressively');
    await assertIdle(page, reversed, 'resized reverse opening progressed without scrolling');
    await complete(page);
    await reverseAndClose(page);
    await page.setViewportSize({ width: run.width, height: run.height });
    await page.waitForTimeout(100);
    await assertTrustClosed(page);
    return 'resize preserves the current frame and recalibrates reversible scroll travel';
  }
  if (run.test === 'menu') {
    await page.locator('.menu-btn').evaluate((el) => el.click());
    await page.waitForFunction(() => document.documentElement.classList.contains('menu-open'));
    const covered = await readTrustFrame(page);
    await assertIdle(page, covered, 'split advanced behind the full-screen menu', 600);
    const menu = page.locator('#phone-menu');
    assert.equal(await menu.getAttribute('hidden'), null, 'phone menu did not open');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.documentElement.classList.contains('menu-open'));
    const returned = await readTrustFrame(page);
    assert.ok(Math.abs(returned.leftX - partial.leftX) < 0.25, 'menu dismissal skipped the paused split');
    await assertIdle(page, returned, 'menu dismissal resumed autoplay');
    await complete(page);
    await reverseAndClose(page);
    return 'menu interruption preserves the split until scrolling resumes';
  }
  if (run.test === 'intro') {
    await page.evaluate(() => { document.documentElement.dataset.intro = '1'; });
    await settle(page);
    const covered = await readTrustFrame(page);
    await scrollTrustTo(page, covered.scrollY + 32);
    await assertIdle(page, covered, 'scrolling behind the intro changed the split frame');
    await page.evaluate(() => { delete document.documentElement.dataset.intro; });
    await settle(page);
    const returned = await readTrustFrame(page);
    assert.ok(Math.abs(returned.leftX - covered.leftX) < 0.25, 'intro dismissal counted obscured scroll travel');
    await assertIdle(page, returned, 'intro dismissal triggered autoplay');
    await complete(page);
    await reverseAndClose(page);
    return 'intro interruption ignores obscured travel and retains the revealed frame';
  }
  throw new Error('Unknown extra check');
}

let passed = 0;
try {
  for (const run of cases.filter((run) => !process.env.ONLY || name(run).includes(process.env.ONLY))) {
    const context = await browser.newContext({
      viewport: { width: run.width, height: run.height }, deviceScaleFactor: run.zoom ? 2 : 1,
      isMobile: run.width < 1024 && !run.zoom, hasTouch: run.width < 1024 && !run.zoom,
      colorScheme: run.theme, reducedMotion: run.mode === 'reduced' ? 'reduce' : 'no-preference',
      javaScriptEnabled: run.mode !== 'no-js',
    });
    await context.addInitScript((mode) => {
      try {
        localStorage.setItem('lf-intro-seen', '1'); localStorage.setItem('lf-lite', '1');
        localStorage.setItem('lf-motion', mode === 'user-off' ? 'off' : 'on');
      } catch {}
    }, run.mode);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const gated = ['delayed', 'failed'].includes(run.mode);
    await context.route('**/*', async (route) => {
      if (gated && route.request().resourceType() === 'script') await gate;
      if (new URL(route.request().url()).pathname === '/api/events') await route.fulfill({ status: 204 });
      else await route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(BASE + (run.test === 'anchors' ? '/#promises' : '/'), { waitUntil: gated ? 'commit' : 'networkidle' });
      await page.locator('#trust-h').waitFor({ state: 'visible' });
      await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every((el) => el.sheet));
      await page.evaluate(() => document.fonts.ready);
      if (run.mode !== 'no-js') assert.equal(await page.locator('html').evaluate((el, theme) => el.classList.contains(theme), run.theme), true, 'requested theme was not applied');
      const wrapper = page.locator('.cleave[data-read-first]');
      if (gated) {
        assert.equal(await wrapper.locator('.cleave-cover').isVisible(), true, 'prepaint steel cover was missing');
        if (run.mode === 'failed') {
          await page.waitForFunction(() => 'fallback' in document.querySelector('.cleave[data-read-first]').dataset, null, { timeout: 15000 });
          await assertTrustCopyReadable(page);
        } else {
          await positionTrustHeading(page);
          await page.waitForTimeout(700);
          assert.equal(await wrapper.locator('.cleave-cover').isVisible(), true, 'delayed scripts prematurely removed the cover');
          assert.ok(Math.abs((await readTrustFrame(page)).leftX) < 0.1, 'unhydrated steel was not closed');
        }
        await scrollTrustTo(page, 0);
        release();
        await page.waitForLoadState('networkidle');
        if (run.mode === 'failed') await assertTrustCopyReadable(page);
      }
      if (run.mode !== 'no-js') await page.waitForFunction(() => 'ready' in document.querySelector('.cleave[data-read-first]').dataset);
      const initial = await readTrustFrame(page);
      if (['on', 'delayed'].includes(run.mode)) {
        assert.equal(initial.motion, 'on', 'motion-enabled scenario unexpectedly disabled animations');
        if (!run.zoom) assert.equal(initial.fallback, false, 'ordinary viewport silently bypassed the requested opening');
        else if (initial.fallback) assert.equal(initial.fallbackReason, 'geometry', 'zoom used an animation failure instead of a geometry fallback');
      }
      if (['user-off', 'reduced'].includes(run.mode)) assert.equal(initial.motion, 'off', 'reduced motion or visitor Off preference was not honored');
      const result = run.test ? await checkExtra(page, run) : await checkTrustOpening(page, {
        screenshots: run.mode === 'on' && !run.zoom ? OUT + '/scroll-opening-' + name(run) : undefined,
      });
      const widths = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(widths.content <= widths.viewport + 1, 'opening introduced horizontal overflow');
      assert.deepEqual(errors, [], 'page runtime error');
      passed++;
      console.log('✓ ' + name(run) + ': ' + result);
    } catch (error) {
      await page.screenshot({ path: OUT + '/scroll-opening-FAIL-' + name(run) + '.png' }).catch(() => {});
      console.error('FAIL ' + name(run) + ': ' + error.message);
      console.error(await readTrustFrame(page).catch(() => ({})));
      throw error;
    } finally {
      release(); await context.close();
    }
  }
  assert.ok(passed > 0, 'No matching focused browser scenarios');
  console.log('All ' + passed + ' focused scroll-opening scenarios passed.');
} finally { await browser.close(); }
