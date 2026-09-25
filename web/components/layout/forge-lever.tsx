'use client';

/** Theme lever (PLAN §5.6.1, animation #4). Flipping it reveals the other world in a
 *  circle from the lever itself — View Transitions, no library. Instant when motion is off. */

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export function ForgeLever() {
  const { resolvedTheme, setTheme } = useTheme();
  const motionOn = useMotionEnabled();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark';
    if (!('startViewTransition' in document) || !motionOn) {
      setTheme(next);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(() => {
      document.documentElement.classList.toggle('dark', next === 'dark');
      flushSync(() => setTheme(next));
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
