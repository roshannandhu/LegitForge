'use client';

/** Lenis synced to the GSAP ticker (PLAN §5.6.2). Off entirely when motion is off, so
 *  find-in-page, screen readers and native scrolling are untouched.
 *
 *  A leaf rendered beside the page, never a wrapper around it. Lenis mounts only after GSAP has
 *  loaded (lib/gsap.ts): it takes over the wheel, and with no GSAP ticker driving it the page
 *  would not scroll at all. Until then, scrolling is native.
 *
 *  Never on touch screens or weak devices (lib/lite.ts): there Lenis leaves the scroll native
 *  anyway and would only add work to every frame. Lenis is imported on demand, so it is not in
 *  the first-load JS; lib/lenis-store.ts shares the instance (header, hero). */

import { useEffect } from 'react';
import 'lenis/dist/lenis.css';
import { loadGsap } from '@/lib/gsap';
import { lenisStore } from '@/lib/lenis-store';
import { useMotionEnabled } from './motion-provider';
import { energy, writeEnergyVar } from './energy';
import { isLite, isTouch } from '@/lib/lite';

export function SmoothScroll() {
  const motionOn = useMotionEnabled();

  useEffect(() => {
    if (!motionOn || isTouch() || isLite()) return;
    let alive = true;
    let stop: (() => void) | undefined;
    Promise.all([loadGsap(), import('lenis')]).then(([{ gsap, ScrollTrigger }, { default: Lenis }]) => {
      if (!alive) return;
      const lenis = new Lenis({ autoRaf: false, lerp: 0.1, anchors: true });
      // the same scroll event feeds ScrollTrigger and scroll energy (§23.3)
      lenis.on('scroll', (l: { velocity: number }) => {
        ScrollTrigger.update();
        energy.target = Math.max(energy.target, Math.min(1, Math.abs(l.velocity) / 40));
      });
      const tick = (time: number) => {
        lenis.raf(time * 1000);
        energy.value += (energy.target - energy.value) * 0.08;   // ease toward the target...
        energy.target *= 0.92;                                     // ...which decays to calm
        writeEnergyVar();
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenisStore.set(lenis);
      stop = () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);             // GSAP's default, restored with motion off
        lenisStore.set(null);
        lenis.destroy();
        energy.value = energy.target = 0;
        writeEnergyVar();
      };
    });
    return () => { alive = false; stop?.(); };
  }, [motionOn]);

  return null;
}
