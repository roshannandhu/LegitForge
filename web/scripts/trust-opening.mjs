import assert from 'node:assert/strict';

/** Inspect painted transforms, rather than treating controller diagnostics as proof of motion. */
export const readTrustFrame = (page) => page.locator('.cleave[data-read-first]').evaluate((el) => {
  const heading = el.querySelector('.cleave-read-sentinel [data-cleave-title]').getBoundingClientRect();
  const cover = getComputedStyle(el.querySelector('.cleave-cover'));
  const x = (side) => new DOMMatrixReadOnly(getComputedStyle(el.querySelector('[data-cleave="' + side + '"]')).transform).m41;
  return {
    phase: el.dataset.phase, progress: Number(el.dataset.progress), fallback: 'fallback' in el.dataset, fallbackReason: el.dataset.fallback,
    motion: document.documentElement.dataset.motion,
    top: heading.top, bottom: heading.bottom, left: heading.left, right: heading.right,
    upper: Math.max(88, (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 72) + 16),
    viewportHeight: innerHeight, viewportWidth: innerWidth, scrollY,
    height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width,
    leftX: x('l'), rightX: x('r'),
    coverVisible: cover.display !== 'none' && cover.visibility === 'visible',
  };
});

export async function scrollTrustTo(page, top) {
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), top);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/** Endpoints come from live heading geometry; resize can invalidate diagnostic endpoints. */
export async function readTrustRange(page) {
  const frame = await readTrustFrame(page);
  const calibration = await page.locator('.cleave[data-read-first]').evaluate((el) => ({
    start: Number(el.dataset.scrollStart), split: Number(el.dataset.scrollSplit),
  }));
  const { start, split } = calibration;
  const end = frame.scrollY + frame.top - (frame.upper + 24);
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && end > start, 'no finite calibrated scroll range');
  return { start, split, end };
}

/** Enter with the whole closed title visible and enough travel remaining to watch it split. */
export async function positionTrustHeading(page) {
  const top = await page.locator('.cleave-read-sentinel [data-cleave-title]').evaluate((el) => {
    const box = el.getBoundingClientRect();
    const desired = Math.max(136, innerHeight - box.height - 40);
    return box.top + scrollY - desired;
  });
  await scrollTrustTo(page, top);
  return readTrustFrame(page);
}

export async function assertTrustClosed(page) {
  const frame = await readTrustFrame(page);
  assert.equal(frame.phase, 'closed', 'reverse scrolling did not close the steel');
  assert.equal(frame.coverVisible, true, 'closed steel is invisible');
  assert.ok(Math.abs(frame.leftX) < 0.1 && Math.abs(frame.rightX) < 0.1, 'closed halves remain displaced');
}

export async function assertTrustCopyReadable(page) {
  assert.equal(await page.locator('.cleave-cover').isVisible(), false, 'steel still covers the promises');
  const copy = await page.locator('#promises').evaluate((section) => ({
    count: section.querySelectorAll('.trust-plate strong').length,
    readable: [...section.querySelectorAll('h2, .trust-plate strong')].every((el) => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const css = getComputedStyle(node);
        if (css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) < 0.99) return false;
      }
      return true;
    }),
  }));
  assert.equal(copy.count, 4, 'the four genuine promises are missing');
  assert.equal(copy.readable, true, 'promise copy is hidden after opening');
}

async function observePunches(page) {
  await page.locator('.cleave[data-read-first]').evaluate((el) => {
    window.__trustPunchWatch?.stop();
    const plates = [...el.querySelectorAll('.trust-plate')];
    const counts = plates.map((plate) => ({ sets: plate.hasAttribute('data-punched') ? 1 : 0, removals: 0, animations: 0 }));
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const index = plates.indexOf(record.target);
        if (index < 0) continue;
        if (record.target.hasAttribute('data-punched')) counts[index].sets++;
        else counts[index].removals++;
      }
    });
    observer.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-punched'] });
    const started = (event) => {
      if (event.animationName !== 'punch-in' || !event.target.matches('[data-punch]')) return;
      const index = plates.indexOf(event.target.closest('.trust-plate'));
      if (index >= 0) counts[index].animations++;
    };
    el.addEventListener('animationstart', started);
    window.__trustPunchWatch = { counts, plates, stop() { observer.disconnect(); el.removeEventListener('animationstart', started); } };
  });
}

async function assertPunchesPersist(page) {
  const stats = await page.evaluate(() => window.__trustPunchWatch.counts.map((count, index) => ({
    ...count, punched: window.__trustPunchWatch.plates[index].hasAttribute('data-punched'),
  })));
  assert.ok(stats.some((stat) => stat.sets > 0), 'no hallmark was struck after opening');
  for (const stat of stats) {
    assert.ok(stat.sets <= 1 && stat.removals === 0, 'hallmark state reset or was punched twice while reversing');
    assert.ok(stat.animations <= 1, 'hallmark punch animation restarted while reversing');
    if (stat.sets) assert.equal(stat.punched, true, 'struck hallmark lost its state');
  }
}

/** Same helper contract used by the full website checker and focused release runner. */
export async function checkTrustOpening(page, { screenshots } = {}) {
  const wrapper = page.locator('.cleave[data-read-first]');
  assert.equal(await wrapper.count(), 1, 'trust steel opening missing');
  assert.equal(await wrapper.getAttribute('data-pin'), 'off', 'trust must not pin any viewport');
  await page.evaluate(() => document.fonts.ready);
  const before = await readTrustFrame(page);
  const animated = before.motion === 'on' && !before.fallback;
  if (!animated) {
    await assertTrustCopyReadable(page);
    return 'static readable fallback';
  }
  await page.waitForFunction(() => 'ready' in document.querySelector('.cleave[data-read-first]').dataset);
  const initial = await positionTrustHeading(page);
  if (initial.fallback) {
    await assertTrustCopyReadable(page);
    return 'static readable fallback for a cramped viewport';
  }
  const range = await readTrustRange(page);
  const at = (fraction) => range.start + (range.end - range.start) * fraction;
  await scrollTrustTo(page, range.start);
  await assertTrustClosed(page);
  const closed = await readTrustFrame(page);
  assert.ok(closed.top >= closed.upper && closed.bottom <= closed.viewportHeight - 24, 'closed heading is not fully readable');
  assert.ok(closed.left >= 16 && closed.right <= closed.viewportWidth - 16, 'closed heading escapes the viewport');
  // The previous timed reveal began after 1.5 seconds even with scrolling stopped.
  await page.waitForTimeout(1750);
  await assertTrustClosed(page);
  if (screenshots) await page.screenshot({ path: screenshots + '-closed.png' });
  await observePunches(page);
  try {
    await scrollTrustTo(page, at(0.24));
    await assertTrustClosed(page);
    await scrollTrustTo(page, at(0.3));
    const beginning = await readTrustFrame(page);
    assert.equal(beginning.phase, 'opening', 'split did not begin after the 25% reading range');
    assert.ok(beginning.leftX < -0.1 && beginning.rightX > 0.1, 'extra animation hold delayed steel after reading travel');

    await scrollTrustTo(page, at(0.6));
    const split = await readTrustFrame(page);
    assert.equal(split.phase, 'opening', 'forward scrolling did not start the split');
    assert.ok(split.leftX < -1 && split.leftX > -split.width * 0.99, 'left half is not visibly partway open');
    assert.ok(split.rightX > 1 && split.rightX < split.width * 0.99, 'right half is not visibly partway open');
    assert.equal(split.coverVisible, true, 'cover disappeared instead of splitting');
    if (screenshots) await page.screenshot({ path: screenshots + '-opening.png' });
    await page.waitForTimeout(500);
    const stopped = await readTrustFrame(page);
    assert.ok(Math.abs(stopped.leftX - split.leftX) < 0.25 && Math.abs(stopped.rightX - split.rightX) < 0.25, 'split kept playing while idle');

    for (let cycle = 0; cycle < 2; cycle++) {
      await scrollTrustTo(page, range.end + 8);
      await page.waitForFunction(() => document.querySelector('.cleave[data-read-first]').dataset.phase === 'open');
      await assertTrustCopyReadable(page);
      await wrapper.locator('.trust-plate[data-punched]').first().waitFor({ timeout: 4000 });
      if (cycle === 0 && screenshots) await page.screenshot({ path: screenshots + '-open.png' });
      await scrollTrustTo(page, at(0.6));
      const reverse = await readTrustFrame(page);
      assert.equal(reverse.phase, 'opening', 'reverse scrolling skipped the partial closing frame');
      assert.equal(reverse.coverVisible, true, 'closing steel did not reappear');
      assert.ok(Math.abs(reverse.leftX - split.leftX) < 0.75 && Math.abs(reverse.rightX - split.rightX) < 0.75, 'same scroll position produced different split transforms');
      await scrollTrustTo(page, range.start);
      await assertTrustClosed(page);
      await assertPunchesPersist(page);
      await scrollTrustTo(page, at(0.6));
      const replay = await readTrustFrame(page);
      assert.ok(Math.abs(replay.leftX - split.leftX) < 0.75 && Math.abs(replay.rightX - split.rightX) < 0.75, 'reopening changed the calibrated split frame');
    }
    // Leave the full checker with visible promises after proving both directions twice.
    await scrollTrustTo(page, range.end + 8);
    await assertTrustCopyReadable(page);
    await assertPunchesPersist(page);
  } finally {
    await page.evaluate(() => window.__trustPunchWatch?.stop());
  }
  assert.ok(Math.abs(before.height - (await readTrustFrame(page)).height) < 1, 'opening changed layout height');
  return 'repeatable closed/partial/open cycles, no autoplay, and hallmarks struck once';
}
