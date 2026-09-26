'use client';

/** One global --heat (0..1) set from the section in view (PLAN §4.2, §5.6.3).
 *  Sections opt in with data-heat="0.55". The ember canvas reads `heat.value` every frame (eased);
 *  the CSS variable changes in one step.
 *
 *  One IntersectionObserver on a line 55 % down the screen, not a ScrollTrigger per section:
 *  the same moments (a section's top or bottom crossing that line), but the browser tracks
 *  them itself, with nothing for GSAP to measure or refresh, and it works before GSAP loads. */

import { useEffect } from 'react';
import { useMotionEnabled } from './motion-provider';
import { HYDRATED_EVENT } from './hydrate-when-near';

export const heat = { value: 0.35 };

let written = '0.350';   // the CSS default (globals.css --heat)
/** Writes --heat only when it changes: each write restyles the whole page. */
export const writeHeatVar = (v = heat.value) => {
  const t = v.toFixed(3);
  if (t === written) return;
  written = t;
  document.documentElement.style.setProperty('--heat', t);
};

export function HeatDirector() {
  const motionOn = useMotionEnabled();

  useEffect(() => {
    let target = heat.value;
    let raf = 0;
    // ease heat.value toward the target, for the embers only (~1.2 s, like power2.out)
    const ease = () => {
      heat.value += (target - heat.value) * 0.06;
      if (Math.abs(target - heat.value) < 0.002) { heat.value = target; raf = 0; return; }
      raf = requestAnimationFrame(ease);
    };
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).pop();
      if (!hit) return;
      target = Number((hit.target as HTMLElement).dataset.heat);
      // --heat on <html> restyles the whole page, so CSS takes the new value in one step
      // (one restyle, not 70: on a phone each was a 200 ms frame)
      writeHeatVar(target);
      if (!motionOn) { heat.value = target; return; }
      if (!raf) raf = requestAnimationFrame(ease);
    }, { rootMargin: '-55% 0px -45% 0px' });   // a one-line band at 55 % of the viewport
    const observeAll = () => { io.disconnect(); document.querySelectorAll('[data-heat]').forEach((s) => io.observe(s)); };
    observeAll();
    // a section hydrated late (HydrateWhenNear) is a new element: observe again
    window.addEventListener(HYDRATED_EVENT, observeAll);
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener(HYDRATED_EVENT, observeAll); };
  }, [motionOn]);

  return null;
}
