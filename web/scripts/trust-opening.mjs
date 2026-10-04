import assert from 'node:assert/strict';

/** Verify an opening visitors actually see, rather than merely checking its presence in markup. */
export async function checkTrustOpening(page, { screenshots } = {}) {
  const wrapper = page.locator('.cleave[data-read-first]');
  assert.equal(await wrapper.count(), 1, 'trust steel opening missing');
  assert.equal(await wrapper.getAttribute('data-pin'), 'off', 'trust must not pin any viewport');
  await page.evaluate(() => document.fonts.ready);
  const height = await wrapper.evaluate((el) => el.getBoundingClientRect().height);
  const animated = await wrapper.evaluate((el) => document.documentElement.dataset.motion === 'on' && !('fallback' in el.dataset));
  const positionCover = () => wrapper.locator('.cleave-read-sentinel [data-cleave-title]').evaluate((el) => {
    const box = el.getBoundingClientRect();
    scrollTo({ top: box.top + scrollY - Math.max(120, (innerHeight - box.height) / 2), behavior: 'instant' });
  });
  const phase = (value) => page.waitForFunction((value) => document.querySelector('.cleave[data-read-first]')?.dataset.phase === value, value, { timeout: 4000 });
  const x = () => wrapper.locator('[data-cleave="l"]').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);

  if (animated) {
    await page.waitForFunction(() => 'ready' in document.querySelector('.cleave[data-read-first]').dataset);
    // A quick pass followed by leaving the heading must not spend its reading interval offscreen.
    await positionCover();
    await page.waitForTimeout(350);
    assert.equal(await wrapper.getAttribute('data-phase'), 'closed', 'cover split before heading could be read');
    assert.ok(Math.abs(await x()) < 0.1, 'closed steel has already moved');
    // An intro overlay must cancel reading time and restart it when the page becomes visible.
    await page.evaluate(() => { document.documentElement.dataset.intro = '1'; });
    await page.waitForTimeout(1700);
    assert.equal(await wrapper.getAttribute('data-phase'), 'closed', 'reading timer ran behind the intro');
    await page.evaluate(() => { delete document.documentElement.dataset.intro; });
    await page.waitForTimeout(350);
    assert.equal(await wrapper.getAttribute('data-phase'), 'closed', 'intro dismissal skipped the reading interval');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1700);
    assert.equal(await wrapper.getAttribute('data-phase'), 'closed', 'reading timer ran offscreen');
    await positionCover();
    await page.waitForTimeout(500);
    assert.equal(await wrapper.getAttribute('data-phase'), 'closed', 'heading did not receive a reading interval');
    const box = await wrapper.locator('.cleave-read-sentinel [data-cleave-title]').evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { y: box.top, height: box.height };
    });
    const viewport = page.viewportSize();
    assert.ok(box.y >= 88 && box.y + box.height <= viewport.height - 24, 'cover heading is not fully readable');
    if (screenshots) await page.screenshot({ path: `${screenshots}-closed.png` });
    await phase('opening');
    await page.waitForTimeout(380);
    assert.ok(await x() < -0.1, 'opening animation is not visibly splitting the steel');
    if (screenshots) await page.screenshot({ path: `${screenshots}-opening.png` });
    if (await page.locator('.menu-btn').isVisible()) {
      // Invoke the actual menu without Playwright scrolling the hidden header into view.
      await page.locator('.menu-btn').evaluate((el) => el.click());
      await page.waitForFunction(() => document.documentElement.classList.contains('menu-open'));
      await page.waitForTimeout(100);
      const covered = await x();
      await page.waitForTimeout(400);
      assert.ok(Math.abs((await x()) - covered) < 0.25, 'opening kept running behind the phone menu');
      assert.equal(await wrapper.getAttribute('data-phase'), 'opening', 'opening finished behind the phone menu');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.documentElement.classList.contains('menu-open'));
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    const paused = await x();
    await page.waitForTimeout(400);
    assert.ok(Math.abs((await x()) - paused) < 0.25, 'opening kept running offscreen');
    assert.equal(await wrapper.getAttribute('data-phase'), 'opening', 'opening finished before visitors could see it');
    await positionCover();
    await phase('open');
    await page.waitForSelector('.trust-plate[data-punched]');
  } else {
    assert.equal(await wrapper.locator('.cleave-cover').isVisible(), false, 'static fallback still hides promises');
  }

  // Reading the promises and returning upward must not close the cover or add scroll space.
  for (const position of [0.65, 0.18, 0.5]) {
    await page.locator('#trust-h').evaluate((el, position) => {
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - Math.max(120, innerHeight * position), behavior: 'instant' });
    }, position);
    await page.waitForTimeout(120);
    assert.equal(await wrapper.locator('.cleave-cover').isVisible(), false, 'steel reclosed during reverse scroll');
    const readable = await page.locator('#promises').evaluate((section) => {
      return [...section.querySelectorAll('h2, .trust-plate strong')].every((el) => {
        for (let node = el; node && node !== document.body; node = node.parentElement) {
          const css = getComputedStyle(node);
          if (css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) < 0.99) return false;
        }
        return true;
      });
    });
    assert.equal(readable, true, 'promise copy is hidden after opening');
  }
  assert.ok(Math.abs(height - await wrapper.evaluate((el) => el.getBoundingClientRect().height)) < 1, 'opening changed layout height');
  return animated ? 'readable closed heading, visible split, offscreen pause and stable open state' : 'static readable fallback';
}
