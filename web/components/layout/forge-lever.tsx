'use client';

/** Theme lever (PLAN §5.6.1, animation #4). Flipping it reveals the other world in a
 *  circle from the lever itself — View Transitions, no library. Instant when motion is off.
 *  For the 0.7 s of the reveal the page holds still underneath it (GSAP paused, the embers skip
 *  frames: window.__lfSwitching, a JS flag, as any change on <html> restyles the page), and the
 *  swap is ONE restyle of the page: no "disable transitions" rule (next-themes' own forced two
 *  more full-page restyles), the few colour transitions just play inside the circle. The choice is remembered only while
 *  browsing (lib/boot.ts THEME_BOOT). */

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { gsapIfLoaded } from '@/lib/gsap';

export function ForgeLever() {
  const { resolvedTheme, setTheme } = useTheme();
  const motionOn = useMotionEnabled();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark';
    try { localStorage.setItem('lf-theme-at', String(Date.now())); } catch {}
    const root = document.documentElement;
    const w = window as Window & { __lfSwitching?: boolean };
    w.__lfSwitching = true;                                       // the embers and GSAP hold still
    if (!('startViewTransition' in document) || !motionOn) {
      setTheme(next);
      requestAnimationFrame(() => requestAnimationFrame(() => { w.__lfSwitching = false; }));
      return;
    }
    const tl = gsapIfLoaded()?.gsap.globalTimeline;
    const wasPaused = tl?.paused();
    tl?.pause();
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(() => {
      // class and color-scheme in one go: next-themes then writes the same values (no change),
      // so the page is restyled once, not twice
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    });
    transition.finished.finally(() => {
      w.__lfSwitching = false;
      if (!wasPaused) tl?.resume();
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mounted ? isDark : undefined}
      aria-label="Dark mode"
      onClick={toggle}
      className="forge-lever"
      data-state={mounted && isDark ? 'night' : 'day'}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path className="lever-arc" d="M7 24a9 9 0 0 1 18 0" />
        <g className="lever-handle">
          <path d="M16 24V9" />
          <circle cx="16" cy="8" r="3.2" />
        </g>
        <circle className="lever-pivot" cx="16" cy="24" r="2.4" />
      </svg>
    </button>
  );
}
