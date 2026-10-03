#!/usr/bin/env node
/** Exercise form reliability without creating a production lead or sending an alert. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const formData = (request) => {
  const body = request.postData() || '';
  const match = body.match(/name="submission_id"\r?\n\r?\n([^\r\n]+)/);
  return { body, id: match?.[1] };
};
async function open(javaScriptEnabled = true) {
  const ctx = await browser.newContext({ javaScriptEnabled, reducedMotion: 'reduce' });
  if (javaScriptEnabled) await ctx.addInitScript(() => {
    localStorage.setItem('lf-intro-seen', '1');
    localStorage.setItem('lf-motion', 'off');
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  const form = page.locator('form.lead-form');
  await form.locator('[name="name"]').fill('Browser Reliability Check');
  await form.locator('[name="phone"]').fill('+91 9000000000');
  await form.locator('[name="need"]').selectOption('Not sure yet');
  await form.locator('[name="message"]').fill('Synthetic intercepted browser check');
  await form.locator('[name="consent"]').check();
  return { ctx, page, form };
}
const submit = (form) => form.locator('button[type="submit"]');
const waitError = (page) => page.getByRole('alert').filter({ hasText: 'couldn’t confirm receipt' }).waitFor();
try {
  // A request in flight must synchronously exclude a second submit from the same JS turn.
  {
    const { ctx, page, form } = await open();
    let requests = 0, release;
    const held = new Promise((done) => { release = done; });
    await page.route('**/api/leads', async (route) => {
      requests++;
      assert.equal(route.request().method(), 'POST');
      assert.match(route.request().headers().accept, /application\/json/);
      assert.match(formData(route.request()).id || '', /^[0-9a-f-]{36}$/i);
      await held;
      await route.fulfill({ json: { ok: true, stored: true, duplicate: false } });
    });
    await form.evaluate((el) => { el.requestSubmit(); el.requestSubmit(); });
    await page.waitForFunction(() => document.querySelector('.lead-form button[type="submit"]')?.disabled);
    assert.equal(await form.getAttribute('aria-busy'), 'true');
    assert.equal(await form.locator('[name="need"]').isDisabled(), true);
    assert.equal(await form.locator('[name="name"]').getAttribute('readonly'), '');
    release();
    await page.getByRole('status').filter({ hasText: 'Received' }).waitFor();
    assert.equal(requests, 1);
    await ctx.close();
    console.log('✓ double submit sends one request; pending fields and submit are locked');
  }
  // A lost response retains the exact receipt and values, allowing a confirmed retry.
  {
    const { ctx, page, form } = await open();
    const ids = [];
    await page.route('**/api/leads', async (route) => {
      ids.push(formData(route.request()).id);
      if (ids.length === 1) await route.abort('failed');
      else await route.fulfill({ json: { ok: true, stored: true, duplicate: true } });
    });
    await submit(form).click();
    await waitError(page);
    assert.equal(await form.locator('[name="name"]').inputValue(), 'Browser Reliability Check');
    assert.equal(await submit(form).isEnabled(), true);
    assert.equal(await page.locator('.form-sent').count(), 0);
    await submit(form).click();
    await page.locator('.form-sent').waitFor();
    assert.equal(ids.length, 2);
    assert.ok(ids[0]);
    assert.equal(ids[0], ids[1]);
    await ctx.close();
    console.log('✓ uncertain response retains fields and UUID; duplicate retry confirms storage');
  }
  // An HTTP 200 without a storage receipt is not success; editing then uses a new UUID.
  {
    const { ctx, page, form } = await open();
    const ids = [];
    await page.route('**/api/leads', async (route) => {
      ids.push(formData(route.request()).id);
      if (ids.length === 1) await route.fulfill({ json: { ok: true } });
      else await route.fulfill({ json: { ok: true, stored: true, duplicate: false } });
    });
    await submit(form).click();
    await waitError(page);
    assert.equal(await page.locator('.form-sent').count(), 0);
    await form.locator('[name="message"]').fill('Updated synthetic request');
    await submit(form).click();
    await page.locator('.form-sent').waitFor();
    assert.notEqual(ids[0], ids[1]);
    await ctx.close();
    console.log('✓ unconfirmed 200 stays retryable; changed content receives a fresh UUID');
  }
  {
    const { ctx, page, form } = await open(false);
    assert.equal((await form.getAttribute('method')).toLowerCase(), 'post');
    assert.equal(await form.getAttribute('action'), '/api/leads');
    let request;
    await page.route('**/api/leads', async (route) => {
      request = route.request();
      assert.equal(request.method(), 'POST');
      assert.equal(new URL(request.url()).search, '');
      assert.match(request.postData() || '', /Browser(?:\+|%20)Reliability(?:\+|%20)Check/);
      await route.fulfill({ status: 200, contentType: 'text/html', headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
        body: '<!doctype html><html><title>Details received</title><main><h1>Details received</h1></main></html>' });
    });
    await Promise.all([page.waitForURL('**/api/leads'), submit(form).click()]);
    assert.ok(request);
    assert.equal(new URL(page.url()).search, '');
    await ctx.close();
    console.log('✓ no-JavaScript submission uses POST and keeps personal details out of the URL');
  }
  // Actual native validation response: invalid data cannot create a lead or notification.
  const response = await fetch(BASE + '/api/leads', { method: 'POST', headers: { Accept: 'text/html' }, body: new URLSearchParams() });
  assert.equal(response.status, 422);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(await response.text(), /Enter your name/);
  console.log('✓ native validation returns readable no-store/noindex HTML');
} finally { await browser.close(); }
