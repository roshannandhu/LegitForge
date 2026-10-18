#!/usr/bin/env node
/** The website chat bubble (components/chat) in a real browser at 375, 768 and 1440 wide, with
 *  /api/chat answered by a stand-in for the bot (the request and reply shapes of bot/worker.ts
 *  webChat: buttons only from the latest bot message, two minutes of overlap on reads). Never
 *  reaches the real bot. Skips when the build has no bubble (NEXT_PUBLIC_WEB_CHAT unset). */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MENU = [{ id: 'svc:website', title: 'Website' }, { id: 'svc:app', title: 'Web app' }, { id: 'svc:other', title: 'Something else / chat' }];

/** One visitor's chat, as the bot would keep it. */
function standIn() {
  const rows = [];
  let n = 0;
  const at = () => new Date(Date.now() + n++).toISOString();
  const reply = (m) => {
    if (m.reply_id === 'svc:website') return { body: 'Which language should we use?', options: [{ id: 'lang:en', title: 'English' }, { id: 'lang:ml', title: 'മലയാളം' }] };
    if (m.reply_id === 'lang:en') return { body: 'Great. What is your name? Our work: https://legitforge.pages.dev/work', options: null };
    if (/delete my data/i.test(m.body)) return { body: 'Do you want us to delete your chat and details?', options: [{ id: 'del:y', title: 'Yes, delete' }, { id: 'del:n', title: 'No, keep' }] };
    if (rows.filter((r) => r.dir === 'in').length === 1) return { body: 'Hi! 👋 What would you like help with?', options: MENU };
    return { body: `Noted: ${m.body}`, options: null };
  };
  return async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'GET') {
      const after = Date.parse(url.searchParams.get('after') ?? '');
      const messages = Number.isFinite(after) ? rows.filter((r) => Date.parse(r.at) > after - 120_000) : rows.slice(-50);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages }) });
    }
    const b = JSON.parse(req.postData() || '{}');
    if (b.reply) {
      const latest = rows.filter((r) => r.dir === 'out' && r.options).at(-1);
      if (!latest?.options.some((o) => o.id === b.reply.id)) return route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"old-button"}' });
    }
    const m = { wamid: `web.${n}`, at: at(), dir: 'in', body: b.reply ? b.reply.title : b.text, reply_id: b.reply?.id ?? null, options: null };
    rows.push(m);
    if (b.reply?.id === 'del:y') {
      rows.length = 0;
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, id: m.wamid, at: m.at, erased: true, notice: 'Done. Your chat and details have been deleted.' }) });
    }
    setTimeout(() => { const r = reply(m); rows.push({ wamid: `web.out.${n}`, at: at(), dir: 'out', body: r.body, options: r.options }); }, 200);
    return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, id: m.wamid, at: m.at }) });
  };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let ran = 0;
try {
  for (const [width, height] of [[375, 667], [768, 1024], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768 });
    await page.addInitScript(() => { try { localStorage.setItem('lf-intro-seen', '1'); } catch {} });
    await page.route('**/api/chat**', standIn());
    await page.route('**/api/events**', (r) => r.fulfill({ status: 204 }));            // no measurement from checks
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/services`, { waitUntil: 'load' });
    const bubble = page.locator('button.chat-bubble');
    if (!(await bubble.count())) { console.log('no chat bubble in this build (NEXT_PUBLIC_WEB_CHAT unset): skipped'); await page.close(); break; }
    const label = `${width}x${height}`;
    await bubble.click();
    const panel = page.locator('#chat-panel');
    await panel.waitFor({ state: 'visible' });
    // the panel never sits under the header, and nothing scrolls sideways
    const box = await panel.boundingBox(), header = await page.locator('.site-header').boundingBox();
    assert.ok(box && header && box.y >= header.y + header.height - 1, `${label}: the panel is below the header`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no sideways scroll`);
    // a message, the menu's buttons, a typed number would also work; a tap here
    await page.fill('#chat-input', 'Hi');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Website' }).waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: 'Website' }).click();
    await page.getByRole('button', { name: 'English' }).waitFor({ timeout: 8000 });
    assert.equal(await page.getByRole('button', { name: 'Website' }).count(), 0, `${label}: old buttons are gone`);
    await page.getByRole('button', { name: 'English' }).click();
    const link = page.locator('.chat-log a[href="https://legitforge.pages.dev/work"]');
    await link.waitFor({ timeout: 8000 });
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer', `${label}: links open safely`);
    assert.equal(await page.locator('.chat-line').filter({ hasText: 'Hi' }).count() >= 1, true, `${label}: the visitor's own lines`);
    // Esc closes and gives focus back to the bubble
    await page.focus('#chat-input');
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('chat-bubble')), true, `${label}: focus back on the bubble`);
    // DELETE MY DATA: the chat is cleared here too, and a new chat id is used
    await bubble.click();
    const before = await page.evaluate(() => localStorage.getItem('lf-chat-session'));
    await page.fill('#chat-input', 'delete my data');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Yes, delete' }).waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await page.locator('.chat-line').filter({ hasText: 'Your chat and details have been deleted' }).waitFor({ timeout: 8000 });
    assert.equal(await page.locator('.chat-line').count(), 1, `${label}: only the notice is left`);
    assert.notEqual(await page.evaluate(() => localStorage.getItem('lf-chat-session')), before, `${label}: a new chat id`);
    assert.deepEqual(errors, [], `${label}: no page errors`);
    console.log(`  ✓ chat bubble ${label}`);
    ran++;
    await page.close();
  }
} finally {
  await browser.close();
}
if (ran) console.log(`The chat bubble passed at ${ran} sizes.`);
