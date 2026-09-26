'use client';

/** Punch-in (plan D): marks inside `children` ([data-punch]) are struck in like hallmarks, one
 *  after another, the first time the group comes into view. Without JS or with motion off they
 *  are simply there: the group is only "armed" (marks hidden) once this runs with motion on. */

import { useEffect, useRef } from 'react';
import { useMotionEnabled } from './motion-provider';

export function PunchIn({ children, className, as: Tag = 'div', threshold = 0.5, style, 'aria-hidden': hidden }: {
  children: React.ReactNode; className?: string; as?: 'div' | 'ul' | 'li' | 'section'; threshold?: number; style?: React.CSSProperties; 'aria-hidden'?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const motionOn = useMotionEnabled();

  useEffect(() => {
    const el = ref.current!;
    if (!motionOn) { delete el.dataset.armed; delete el.dataset.punched; return; }
    if (el.dataset.punched) return;
    el.dataset.armed = '';
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      el.dataset.punched = '';
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [motionOn, threshold]);

  return <Tag ref={ref as never} className={className} style={style} aria-hidden={hidden}>{children}</Tag>;
}
