'use client';

/** Plays a working-flow demo (components/sections/demos.ts) while it is on screen: the intro
 *  builds the finished frame once, then the demo's flow keeps it working, forever, with no
 *  reset and no fade (plan F step 4). Off screen it pauses, so nothing runs where nobody is
 *  looking. The demo markup is the final frame, so no JS and motion off show it, still.
 *
 *  A kind without a flow falls back to the old loop: hold on the finished frame, fade, rebuild
 *  the intro from the finished frame, play again.
 *
 *  Flows change text and classes in place (never nodes). Before a flow starts, the player
 *  snapshots every text node and class attribute in the demo, and puts them back on cleanup,
 *  so switching motion off lands on the server-rendered frame. */

import { useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { DEMOS, FLOWS, type DemoId } from './demos';

const HOLD = 1.6;     // fallback loop: seconds on the finished frame
const FADE = 0.25;    // fallback loop: the reset hides behind this fade

type Anim = { pause(): unknown; resume(): unknown; kill(): unknown };

function snapshot(root: Element) {
  const texts: [Text, string][] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) texts.push([walk.currentNode as Text, (walk.currentNode as Text).nodeValue ?? '']);
  const classes = [...root.querySelectorAll('*')].map((el) => [el, el.getAttribute('class')] as const);
  return () => {
    texts.forEach(([n, v]) => { n.nodeValue = v; });
    classes.forEach(([el, c]) => { if (c === null) el.removeAttribute('class'); else el.setAttribute('class', c); });
  };
}

export function DemoPlayer({ kind, children }: { kind: DemoId; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();

  useGsap(({ gsap }) => {
    const el = ref.current!;
    if (!motionOn) return;
    const box = el.firstElementChild as HTMLElement;
    const flowOf = FLOWS[kind];
    let cur: Anim | null = null;                               // the one thing to pause and resume
    let tl: ReturnType<(typeof DEMOS)[DemoId]> | null = null;
    let flow: ReturnType<(typeof DEMOS)[DemoId]> | null = null;
    let restore: (() => void) | null = null;
    let visible = false;
    const hold = (a: Anim) => { cur = a; if (!visible) a.pause(); };
    const warm = () => { if (visible) el.dataset.running = ''; else delete el.dataset.running; };

    const startFlow = () => {
      restore = snapshot(box);
      flow = flowOf!(el, gsap);
      hold(flow);
      warm();
    };
    const build = () => {
      tl?.progress(1, true).kill();                            // back to the finished frame (no onComplete)
      tl = DEMOS[kind](el, gsap).pause(0);
      tl.eventCallback('onStart', () => { el.dataset.running = ''; });              // the card warms (plan D #3)
      tl.eventCallback('onComplete', () => {
        if (flowOf) { startFlow(); return; }
        delete el.dataset.running;
        hold(gsap.delayedCall(HOLD, loop));
      });
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

    // build the intro only when the demo comes within 600px of the screen: building all seven
    // at load (each measures layout) was a large share of a budget phone's load time
    let built = false;
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || built) return;
      built = true; near.disconnect();
      build();                                                 // start state now, still off screen
      if (visible) cur?.resume();
    }, { rootMargin: '600px 0px' });
    near.observe(el);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) cur?.resume(); else cur?.pause();
      if (flow) warm();
      else if (!visible) delete el.dataset.running;
      else if (cur === tl && tl && tl.progress() > 0 && tl.progress() < 1) el.dataset.running = '';
    }, { threshold: 0.3 });
    io.observe(el);

    return () => {
      near.disconnect();
      io.disconnect();
      cur?.kill();
      delete el.dataset.running;
      flow?.revert();                                          // transforms and opacity back
      restore?.();                                             // text and classes back
      tl?.progress(1, true).kill();                            // text swaps land on their final values
      gsap.set(box, { clearProps: 'opacity' });
    };
  }, { dependencies: [motionOn, kind], scope: ref });

  return <div className="demo-player" ref={ref}>{children}</div>;
}
