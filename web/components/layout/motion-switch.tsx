'use client';

import { useEffect, useState } from 'react';
import { useMotionSwitch } from '@/components/motion/motion-provider';

/** "Animations: On / Off" (PLAN §5.5, §18.5). A real switch, remembered per browser. */
export function MotionSwitch() {
  const { enabled, setEnabled } = useMotionSwitch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mounted ? enabled : undefined}
      className="motion-switch"
      onClick={() => setEnabled(!enabled)}
    >
      <span className="motion-switch-label">Animations</span>
      <span className="motion-switch-track" aria-hidden="true"><span className="motion-switch-knob" /></span>
      <span className="motion-switch-state">{mounted ? (enabled ? 'On' : 'Off') : 'On'}</span>
    </button>
  );
}
