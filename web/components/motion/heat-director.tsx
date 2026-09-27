'use client';

/** Heat (0..1) follows the section in view (PLAN §4.2, §5.6.3). Sections opt in with
 *  data-heat="0.55" and colour themselves from it (globals.css); the header, footer and phone
 *  menu take the current section's value here, in one step. The ember canvas reads `heat.value`
 *  every frame (eased).
 *
 *  One IntersectionObserver on a line 55 % down the screen, not a ScrollTrigger per section:
 *  the same moments (a section's top or bottom crossing that line), but the browser tracks
 *  them itself, with nothing for GSAP to measure or refresh, and it works before GSAP loads. */

import { useEffect } from 'react';
import { useMotionEnabled } from './motion-provider';
import { HYDRATED_EVENT } from './hydrate-when-near';

export const heat = { value: 0.35 };

let written = '';
/** The chrome outside the sections (header, footer, phone menu) follows the section in view:
 *  --heat is written on those three only. Sections carry their own heat (globals.css), so a
 *  boundary no longer restyles the whole page. Written only when it changes. */
export const writeHeatVar = (v = heat.value) => {
  const t = v.toFixed(3);
  if (t === written) return;
  written = t;
  document.querySelectorAll<HTMLElement>('.site-header, .site-footer, .phone-menu').forEach((el) => el.style.setProperty('--heat', t));
};
/** Engines without typed attr() get each section's heat inline, once. */
const attrOk = () => typeof CSS !== 'undefined' && CSS.supports('opacity', 'attr(data-heat type(<number>), 1)');
const inlineHeat = () => {
  if (attrOk()) return;
  document.querySelectorAll<HTMLElement>('[data-heat]').forEach((el) => {
    if (!el.style.getPropertyValue('--heat')) el.style.setProperty('--heat', el.dataset.heat!);
  });
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
      writeHeatVar(target);                           // header, footer and phone menu only
      if (!motionOn) { heat.value = target; return; }
      if (!raf) raf = requestAnimationFrame(ease);
    }, { rootMargin: '-55% 0px -45% 0px' });   // a one-line band at 55 % of the viewport
    const observeAll = () => { inlineHeat(); io.disconnect(); document.querySelectorAll('[data-heat]').forEach((s) => io.observe(s)); };
    observeAll();
    // a section hydrated late (HydrateWhenNear) is a new element: observe again
    window.addEventListener(HYDRATED_EVENT, observeAll);
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener(HYDRATED_EVENT, observeAll); };
  }, [motionOn]);

  return null;
}
