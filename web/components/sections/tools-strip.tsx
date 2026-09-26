'use client';

/** "The tools behind every build": the React Bits LogoLoop (components/react-bits/logo-loop.jsx)
 *  running the stack we ship with. It pauses on hover, and it doesn't run at all off screen or
 *  with motion off (the vendored `paused` prop), so a budget phone spends no frames on it.
 *  The logos themselves are drawn on the server (tools-logos.tsx) and arrive as markup, so the
 *  icon library never reaches the browser's JavaScript. */

import { useEffect, useRef, useState } from 'react';
import LogoLoopJs from '@/components/react-bits/logo-loop';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export type Logo = { node: React.ReactNode; title: string };
const LogoLoop = LogoLoopJs as unknown as React.ComponentType<{
  logos: Logo[]; speed?: number; direction?: 'left' | 'right'; logoHeight?: number; gap?: number; hoverSpeed?: number;
  fadeOut?: boolean; scaleOnHover?: boolean; ariaLabel?: string; className?: string; paused?: boolean;
}>;

export function ToolsLoop({ logos }: { logos: Logo[] }) {
  const motionOn = useMotionEnabled();
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box}>
      <LogoLoop logos={logos} speed={60} direction="left" logoHeight={26} gap={40} hoverSpeed={0}
        fadeOut scaleOnHover ariaLabel="Tools we build with" className="tools-loop" paused={!motionOn || !seen} />
    </div>
  );
}
