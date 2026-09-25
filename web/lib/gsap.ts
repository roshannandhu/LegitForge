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

export function loadGsap(): Promise<Gs> {
  return (loading ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  }));
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
    loadGsap().then((g) => {
      if (live) ctx = g.gsap.context(() => setup(g), scope?.current ?? undefined);
    });
    return () => { live = false; ctx?.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same contract as useGSAP's dependencies
  }, dependencies);
}
