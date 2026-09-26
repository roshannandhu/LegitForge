'use client';

/** Plays a working-flow demo (components/sections/demos.ts) non-stop while it is on screen:
 *  the flow runs, holds on the finished frame, fades, and starts again. Off screen it pauses,
 *  so nothing runs where nobody is looking. The demo markup is the final frame, so no JS and
 *  motion off show the finished demo, still.
 *
 *  Each loop rebuilds the timeline from the finished frame (not `repeat`): the builders set
 *  their start text and counters when they are built, so a rebuilt loop starts exactly like
 *  the first one. */

import { useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { DEMOS, type DemoId } from './demos';

const HOLD = 1.6;     // seconds on the finished frame before the next loop
const FADE = 0.25;    // the reset hides behind this fade

export function DemoPlayer({ kind, children }: { kind: DemoId; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();

  useGsap(({ gsap }) => {
    const el = ref.current!;
    if (!motionOn) return;
    const box = el.firstElementChild as HTMLElement;
    // whatever is running now (the flow, the hold, or the fade): the one thing to pause and resume
    let cur: { pause(): unknown; resume(): unknown; kill(): unknown } | null = null;
    let tl: ReturnType<(typeof DEMOS)[DemoId]> | null = null;
    let visible = false;
    const hold = (a: NonNullable<typeof cur>) => { cur = a; if (!visible) a.pause(); };

    const build = () => {
      tl?.progress(1, true).kill();                            // back to the finished frame (no onComplete)
      tl = DEMOS[kind](el, gsap).pause(0);
      tl.eventCallback('onComplete', () => hold(gsap.delayedCall(HOLD, loop)));
      cur = tl;
    };
    const loop = () => hold(gsap.to(box, {
      opacity: 0, duration: FADE, ease: 'power1.in',
      onComplete: () => {
        build();
        gsap.to(box, { opacity: 1, duration: FADE, ease: 'power1.out' });
        if (visible) tl!.play(0);
      },
    }));

    build();                                                   // start state now, while (usually) off screen
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) cur?.resume(); else cur?.pause();
    }, { threshold: 0.3 });
    io.observe(el);

    return () => {
      io.disconnect();
      cur?.kill();
      tl?.progress(1, true).kill();                            // text swaps land on their final values
      gsap.set(box, { clearProps: 'opacity' });
    };
  }, { dependencies: [motionOn, kind], scope: ref });

  return <div className="demo-player" ref={ref}>{children}</div>;
}
