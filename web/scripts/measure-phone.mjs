#!/usr/bin/env node
/** Repeatable budget-phone emulation, not a claim of testing a physical handset. */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const BASE = process.env.BASE || 'http://127.0.0.1:8788';
await mkdir('.check', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('lf-lite', '1');
    window.__perf = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__perf.longTasks.push(entry.duration); }).observe({ type: 'longtask', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await page.goto(BASE, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForTimeout(12_000);
  const performance = await page.evaluate(() => ({ ...window.__perf, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
    resources: performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'script').map((r) => ({ file: r.name.split('/').pop(), transfer: r.transferSize })) }));
  const report = { method: '375x812, 6x CPU slowdown, 1.6 Mbps down, 150 ms latency, lite mode, first visit with intro', base: BASE,
    fcpMs: Math.round(performance.fcp), lcpMs: Math.round(performance.lcp), cls: +performance.cls.toFixed(3),
    totalBlockingMs: Math.round(performance.longTasks.reduce((n, duration) => n + Math.max(0, duration - 50), 0)),
    note: 'Lab estimate; long tasks over the observation window are not a Lighthouse TBT score or real-user INP.' };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const heights = {};
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { document.documentElement.dataset.cvOff = ''; });
    for (const selector of ['#team', '.tools']) if (await page.locator(selector).count()) await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    heights[width] = await page.evaluate(() => Object.fromEntries(['#team', '.tools'].map((s) => [s, document.querySelector(s)?.getBoundingClientRect().height ?? 0])));
  }
  await writeFile('.check/phone-performance.json', JSON.stringify({ ...report, sectionHeights: heights, resources: performance.resources }, null, 2));
  console.log(JSON.stringify({ ...report, sectionHeights: heights }, null, 2));
  await ctx.close();
} finally { await browser.close(); }
