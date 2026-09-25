'use client';

/** Plays a working-flow demo (components/sections/demos.ts) once, when half of it is on
 *  screen, and offers "Replay demo" afterwards (PLAN §7.1, §18.3). The demo markup is the
 *  final frame, so no JS and motion off show the finished demo and no button. The button sits
 *  outside the aria-hidden demo box, in a row under it that is always reserved. */

import { useRef, useState } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { DEMOS, type DemoId } from './demos';

export function DemoPlayer({ kind, children }: { kind: DemoId; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const tl = useRef<ReturnType<(typeof DEMOS)[DemoId]> | undefined>(undefined);
  const motionOn = useMotionEnabled();
  const [played, setPlayed] = useState(false);

  useGsap(({ gsap }) => {
    const el = ref.current!;
    if (!motionOn) { setPlayed(false); return; }
    const t = DEMOS[kind](el, gsap).pause(0);        // start state now, while (usually) off screen
    t.eventCallback('onComplete', () => setPlayed(true));   // Replay appears once it has finished
    tl.current = t;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      t.play(0);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      t.progress(1);                                  // text swaps land on their final values
      tl.current = undefined;
    };
  }, { dependencies: [motionOn, kind], scope: ref });

  return (
    <div className="demo-player" ref={ref}>
      {children}
      {/* always rendered, so its row is reserved (no layout shift); shown once a play finishes */}
      <button
        type="button" className="demo-replay" hidden={!(motionOn && played)}
        onClick={() => { setPlayed(false); tl.current?.restart(); }}
      >
        Replay demo
      </button>
    </div>
  );
}
