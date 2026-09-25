'use client';

/** Motion is off when the device asks for reduced motion OR the visitor turns
 *  "Animations" off in the footer (PLAN §5.5). An inline script in <head> sets
 *  html[data-motion] before first paint, so there is never a flash. */

import { createContext, useContext, useEffect, useState } from 'react';

type MotionCtx = { enabled: boolean; setEnabled: (on: boolean) => void };
const Ctx = createContext<MotionCtx>({ enabled: true, setEnabled: () => {} });

const REDUCED = '(prefers-reduced-motion: reduce)';

export const MOTION_BOOT_SCRIPT =
  `try{var m=localStorage.getItem('lf-motion');var r=matchMedia('${REDUCED}').matches;` +
  `document.documentElement.dataset.motion=(m==='on')?'on':(m==='off'||r)?'off':'on'}catch(e){}`;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setState] = useState(() => {
    if (typeof document === 'undefined') return true;
    try {
      const m = localStorage.getItem('lf-motion');
      if (m === 'on') return true;
      if (m === 'off') return false;
      return !matchMedia(REDUCED).matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const mq = matchMedia(REDUCED);
    const onChange = () => {
      try {
        const m = localStorage.getItem('lf-motion');
        if (m === 'on') setState(true);
        else if (m === 'off') setState(false);
        else setState(!mq.matches);
      } catch {
        setState(!mq.matches);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  }, [enabled]);

  const setEnabled = (on: boolean) => {
    try { localStorage.setItem('lf-motion', on ? 'on' : 'off'); } catch {}
    setState(on);
  };

  return <Ctx.Provider value={{ enabled, setEnabled }}>{children}</Ctx.Provider>;
}

export const useMotionEnabled = () => useContext(Ctx).enabled;
export const useMotionSwitch = () => useContext(Ctx);
