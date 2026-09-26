'use client';

/** One global --heat (0..1) set from the section in view (PLAN §4.2, §5.6.3).
 *  Sections opt in with data-heat="0.55". The ember canvas reads `heat.value` every frame. */

import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';
import { isLite } from '@/lib/lite';

export const heat = { value: 0.35 };

export const writeHeatVar = () =>
  document.documentElement.style.setProperty('--heat', heat.value.toFixed(3));

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
            // --heat restyles the page: weak devices take the new value in one step, not 70 frames
            if (!motionOn || isLite()) {
              heat.value = target;
              writeHeatVar();
              return;
            }
            gsap.to(heat, { value: target, duration: 1.2, ease: 'power2.out', overwrite: true, onUpdate: writeHeatVar });
          },
        });
      });
    },
    { dependencies: [motionOn] },
  );

  return null;
}
