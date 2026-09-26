'use client';

/** The Cleave (PLAN §23.1): a plate splits at 38 % along a white-hot seam and the halves
 *  shear apart, revealing what is behind. Two copies of the same cover, each clipped to one
 *  side, pushed apart by one scrubbed timeline: transform-only.
 *
 *  `children` is the real content, rendered normally. The cover exists only once JS with
 *  motion on has armed it (data-armed), so with no JS or motion off the content simply sits
 *  in the page. Tablet and desktop pin for 80 % of a screen; phones never pin (§4.8): there
 *  the plate splits as it scrolls in. */

import { useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';
import { isLite } from '@/lib/lite';

export function Cleave({ cover, children, label }: { cover: React.ReactNode; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();

  useGsap(({ gsap }) => {
    const el = ref.current!;
    if (!motionOn || isLite()) { delete el.dataset.armed; return; }   // lite: the content simply sits in the page
    el.dataset.armed = '';
    const mm = gsap.matchMedia();
    mm.add({ pin: '(min-width: 768px)', phone: '(max-width: 767px)' }, (ctx) => {
      const pin = !!ctx.conditions!.pin;
      const q = gsap.utils.selector(el);
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: pin
          ? { trigger: el, start: 'top top', end: '+=80%', pin: true, scrub: 0.8, invalidateOnRefresh: true }
          : { trigger: el, start: 'top 75%', end: 'top 5%', scrub: 0.6 },
      })
        .fromTo(q('[data-seam]'), { opacity: 0, scaleY: 0.2 }, { opacity: 1, scaleY: 1, duration: 0.18 }, 0)   // the chisel bites
        .to(q('[data-cleave="l"]'), { xPercent: -100, rotate: -1.5, duration: 0.82, ease: 'power2.in' }, 0.18)
        .to(q('[data-cleave="r"]'), { xPercent: 100, rotate: 1.5, duration: 0.82, ease: 'power2.in' }, 0.18)
        .to(q('[data-seam]'), { opacity: 0, scaleX: 6, duration: 0.3 }, 0.3);
    });
    return () => { mm.revert(); delete el.dataset.armed; };
  }, { dependencies: [motionOn] });

  return (
    <div className="cleave" ref={ref}>
      <div className="cleave-inner">{children}</div>
      <div className="cleave-cover" aria-hidden="true" title={label}>
        <div className="cleave-half" data-cleave="l">{cover}</div>
        <div className="cleave-half" data-cleave="r">{cover}</div>
        <i className="cleave-seam" data-seam />
      </div>
    </div>
  );
}
