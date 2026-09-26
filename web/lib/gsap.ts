/** GSAP loads after hydration, never with the page. The motion layer sits on a page that
 *  already works without it (PLAN §22: R1 has no scroll animation, R2 adds it), and the
 *  180 KB first-load budget (§11.1) has no room for GSAP's 46 KB.
 *
 *  Never `import { gsap } from 'gsap'` in a component: that puts it back in the first load.
 *  Use useGsap (useGSAP's contract: one context, reverted when a dependency changes). */

import { useEffect, type DependencyList, type RefObject } from 'react';
import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

export interface Gs { gsap: typeof Gsap; ScrollTrigger: typeof ScrollTriggerType }

let loading: Promise<Gs> | undefined;

/** Weak devices (html[data-lite]) fetch GSAP only once the page has loaded and the main thread
 *  is idle: the first seconds belong to reading and tapping, and the motion follows. */
const whenIdleAfterLoad = () => new Promise<void>((resolve) => {
  if (typeof document === 'undefined' || !('lite' in document.documentElement.dataset)) return resolve();
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 2500 }) : setTimeout(resolve, 1200));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
});

export function loadGsap(): Promise<Gs> {
  return (loading ??= whenIdleAfterLoad().then(() => Promise.all([import('gsap'), import('gsap/ScrollTrigger')])).then(([{ gsap }, { ScrollTrigger }]) => {
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  }));
}

/** Every component's setup used to run in one microtask chain when GSAP arrived: one long
 *  task that froze a budget phone for most of a second. Setups now queue and run one per
 *  task, in the same order (so pins and triggers are created top to bottom as before), and
 *  the browser can paint and answer taps between them. */
const queue: (() => void)[] = [];
let pumping = false;
const yieldTask = () => new Promise<void>((r) => {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) s.yield().then(r); else setTimeout(r, 0);
});
async function pump() {
  pumping = true;
  while (queue.length) { await yieldTask(); queue.shift()!(); }
  pumping = false;
}
function schedule(fn: () => void) {
  queue.push(fn);
  if (!pumping) pump();
}

/** Selector strings inside `setup` resolve within `scope`. A function returned from `setup`
 *  runs on revert. */
export function useGsap(
  setup: (g: Gs) => void | (() => void),
  { scope, dependencies = [] }: { scope?: RefObject<Element | null>; dependencies?: DependencyList } = {},
) {
  useEffect(() => {
    let ctx: ReturnType<typeof Gsap.context> | undefined;
    let live = true;
    loadGsap().then((g) => schedule(() => {
      if (live) ctx = g.gsap.context(() => setup(g), scope?.current ?? undefined);
    }));
    return () => { live = false; ctx?.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same contract as useGSAP's dependencies
  }, dependencies);
}
