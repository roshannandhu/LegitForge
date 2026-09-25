'use client';

/** C8 "Snap to grid" (PLAN §23.2): cards sit a little off-grid and askew, then snap into
 *  alignment as their section reaches the centre. Scrubbed, so it resolves exactly when the
 *  reader arrives. Marks [data-snap] children of the nearest section. Motion off and no JS:
 *  the grid is simply aligned (nothing is set until GSAP runs). */

import { useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';

// hand-set, never random: the same "tossed on the bench" layout on every visit
const OFFSETS = [[-16, 12, -2], [14, -10, 1.8], [-10, -14, 1.2], [18, 8, -1.5], [-12, 16, 2], [10, -6, -1]];

export function SnapToGrid() {
  const marker = useRef<HTMLSpanElement>(null);
  const motionOn = useMotionEnabled();

  useGsap(({ gsap }) => {
    const section = marker.current?.closest('section');
    if (!motionOn || !section) return;
    const cards = [...section.querySelectorAll<HTMLElement>('[data-snap]')];
    const k = matchMedia('(max-width: 767px)').matches ? 0.4 : 1;   // full-width cards: stay on screen
    cards.forEach((el, i) => {
      const [x, y, r] = OFFSETS[i % OFFSETS.length].map((v) => v * k);
      gsap.fromTo(el, { x, y, rotation: r }, {
        x: 0, y: 0, rotation: 0, ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'center 55%', scrub: 0.6 },
      });
    });
  }, { dependencies: [motionOn] });

  return <span ref={marker} hidden />;
}
