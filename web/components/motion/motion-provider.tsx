'use client';

/** Motion is off when the device asks for reduced motion OR the visitor turns
 *  "Animations" off in the footer (PLAN §5.5). An inline script in <head> sets
 *  html[data-motion] before first paint, so there is never a flash. */

import { createContext, useContext, useEffect, useState } from 'react';
import { REDUCED } from '@/lib/boot';

type MotionCtx = { enabled: boolean; systemReduced: boolean; setEnabled: (on: boolean) => void };
const Ctx = createContext<MotionCtx>({ enabled: true, systemReduced: false, setEnabled: () => {} });

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setState] = useState(() => {
    if (typeof document === 'undefined') return true;
    try {
      const m = localStorage.getItem('lf-motion');
      return m !== 'off' && !matchMedia(REDUCED).matches;
    } catch {
      return !matchMedia(REDUCED).matches;
    }
  });
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    const mq = matchMedia(REDUCED);
    const onChange = () => {
      setSystemReduced(mq.matches);
      try {
        const m = localStorage.getItem('lf-motion');
        setState(m !== 'off' && !mq.matches);
      } catch {
        setState(!mq.matches);
      }
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  }, [enabled]);

  const setEnabled = (on: boolean) => {
    try { localStorage.setItem('lf-motion', on ? 'on' : 'off'); } catch {}
    setState(on && !matchMedia(REDUCED).matches);
  };

  return <Ctx.Provider value={{ enabled, systemReduced, setEnabled }}>{children}</Ctx.Provider>;
}

export const useMotionEnabled = () => useContext(Ctx).enabled;
export const useMotionSwitch = () => useContext(Ctx);
