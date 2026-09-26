'use client';

/** One global --heat (0..1) set from the section in view (PLAN §4.2, §5.6.3).
 *  Sections opt in with data-heat="0.55". The ember canvas reads `heat.value` every frame (eased);
 *  the CSS variable changes in one step. */

import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';
import { isLite } from '@/lib/lite';

export const heat = { value: 0.35 };

export const writeHeatVar = (v = heat.value) =>
  document.documentElement.style.setProperty('--heat', v.toFixed(3));

export function HeatDirector() {
  const motionOn = useMotionEnabled();

  useGsap(
    ({ gsap, ScrollTrigger }) => {
      if (isLite()) return;   // lite: one steady heat, no trigger per section to measure and update
      gsap.utils.toArray<HTMLElement>('[data-heat]').forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (!self.isActive) return;
            const target = Number(section.dataset.heat);
            // --heat on <html> restyles the whole page, so CSS takes the new value in one step
            // (one restyle, not 70: on a phone each was a 200 ms frame). The embers read
            // heat.value from JS every frame, so only they ease.
            writeHeatVar(target);
            if (!motionOn) { heat.value = target; return; }
            gsap.to(heat, { value: target, duration: 1.2, ease: 'power2.out', overwrite: true });
          },
        });
      });
    },
    { dependencies: [motionOn] },
  );

  return null;
}
