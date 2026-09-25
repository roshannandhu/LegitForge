'use client';

/** One global --heat (0..1) set from the section in view (PLAN §4.2, §5.6.3).
 *  Sections opt in with data-heat="0.55". The ember canvas reads `heat.value` every frame. */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useMotionEnabled } from './motion-provider';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const heat = { value: 0.35 };

export const writeHeatVar = () =>
  document.documentElement.style.setProperty('--heat', heat.value.toFixed(3));

export function HeatDirector() {
  const motionOn = useMotionEnabled();

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>('[data-heat]').forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (!self.isActive) return;
            const target = Number(section.dataset.heat);
            if (!motionOn) {
              heat.value = target;
              writeHeatVar();
              return;
            }
            gsap.to(heat, { value: target, duration: 1.2, ease: 'power2.out', overwrite: true, onUpdate: writeHeatVar });
          },
        });
      });
    },
    { dependencies: [motionOn], revertOnUpdate: true },
  );

  return null;
}
