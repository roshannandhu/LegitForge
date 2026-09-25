'use client';

/** Lenis synced to the GSAP ticker (PLAN §5.6.2). Off entirely when motion is off, so
 *  find-in-page, screen readers and native scrolling are untouched.
 *
 *  This is a LEAF, rendered beside the page — never a wrapper around it. Swapping a wrapper
 *  between <ReactLenis> and a fragment changes the component type, which makes React
 *  unmount and rebuild the whole page (losing form input, flipped cards, demo state) every
 *  time the visitor toggles motion. In `root` mode Lenis publishes itself through a shared
 *  store, so useLenis() works anywhere without being wrapped. */

import { useEffect } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMotionEnabled } from './motion-provider';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  const motionOn = useMotionEnabled();
  if (!motionOn) return null;
  return (
    <>
      <ReactLenis root options={{ autoRaf: false, lerp: 0.1, anchors: true }} />
      <GsapSync />
    </>
  );
}

/** Drives Lenis from GSAP's ticker so Lenis and ScrollTrigger never disagree by a frame. */
function GsapSync() {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    if (!lenis) return;
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);             // GSAP's default, restored with motion off
    };
  }, [lenis]);

  return null;
}
