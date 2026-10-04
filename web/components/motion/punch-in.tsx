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
    // Inside a Cleave that is still closed (armed, not open), a strike can't be seen and its
    // animations stay paused, but flipping data-punched still restyled every part of the plate
    // (a 135 ms frame on a 2 GB tablet, mid-swipe). So there it waits for the Cleave to open:
    // one restyle, at the moment it plays.
    const cleave = el.closest<HTMLElement>('.cleave');
    const shut = () => !!cleave && !('open' in cleave.dataset) && ('armed' in cleave.dataset
      || ('readFirst' in cleave.dataset && document.documentElement.dataset.motion === 'on'));
    let seen = false;
    const punch = () => { if (seen && !shut() && !('punched' in el.dataset)) { el.dataset.punched = ''; stop(); } };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      seen = true; io.disconnect(); punch();
    }, { threshold });
    const mo = cleave ? new MutationObserver(punch) : null;
    const stop = () => { io.disconnect(); mo?.disconnect(); };
    io.observe(el);
    mo?.observe(cleave!, { attributes: true, attributeFilter: ['data-open', 'data-armed'] });
    return stop;
  }, [motionOn, threshold]);

  return <Tag ref={ref as never} className={className} style={style} aria-hidden={hidden}>{children}</Tag>;
}
