'use client';

/** Lenis synced to the GSAP ticker (PLAN §5.6.2). Off entirely when motion is off, so
 *  find-in-page, screen readers and native scrolling are untouched.
 *
 *  This is a LEAF, rendered beside the page — never a wrapper around it. Swapping a wrapper
 *  between <ReactLenis> and a fragment changes the component type, which makes React
 *  unmount and rebuild the whole page (losing form input, flipped cards, demo state) every
 *  time the visitor toggles motion. In `root` mode Lenis publishes itself through a shared
 *  store, so useLenis() works anywhere without being wrapped.
 *
 *  Lenis mounts only after GSAP has loaded (lib/gsap.ts). It takes over the wheel, and with
 *  no GSAP ticker driving it the page would not scroll at all. Until then, scrolling is native.
 *
 *  Never on touch screens or weak devices (lib/lite.ts): there Lenis leaves the scroll native
 *  anyway and would only add work to every frame. */

import { useEffect, useState } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import { loadGsap, type Gs } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';
import { energy, writeEnergyVar } from './energy';
import { isLite, isTouch } from '@/lib/lite';

export function SmoothScroll() {
  const motionOn = useMotionEnabled();
  const [gs, setGs] = useState<Gs>();
  useEffect(() => { if (motionOn && !isTouch() && !isLite()) loadGsap().then(setGs); }, [motionOn]);
  if (!motionOn || !gs) return null;
  return (
    <>
      <ReactLenis root options={{ autoRaf: false, lerp: 0.1, anchors: true }} />
      <GsapSync gs={gs} />
    </>
  );
}

/** Drives Lenis from GSAP's ticker so Lenis and ScrollTrigger never disagree by a frame.
 *  The same scroll event feeds scroll energy (§23.3). */
function GsapSync({ gs: { gsap, ScrollTrigger } }: { gs: Gs }) {
  const lenis = useLenis((l) => {
    ScrollTrigger.update();
    energy.target = Math.max(energy.target, Math.min(1, Math.abs(l.velocity) / 40));
  });

  useEffect(() => {
    if (!lenis) return;
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      energy.value += (energy.target - energy.value) * 0.08;   // ease toward the target...
      energy.target *= 0.92;                                     // ...which decays to calm
      writeEnergyVar();
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);             // GSAP's default, restored with motion off
      energy.value = energy.target = 0;
      writeEnergyVar();
    };
  }, [lenis, gsap]);

  return null;
}
