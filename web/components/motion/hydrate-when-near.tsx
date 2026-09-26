'use client';

/** Hydrates a below-the-fold section only when it comes within `margin` of the screen.
 *
 *  The server renders the section as usual, so its HTML (text, links, the finished frame) is
 *  there from the first paint and nothing looks different. In the browser the wrapper first
 *  keeps that server HTML as it is (an empty dangerouslySetInnerHTML with
 *  suppressHydrationWarning: React leaves the existing DOM alone), and React takes the section
 *  over once it is near. By then it is still off screen, so the swap is invisible. It spreads
 *  the page's hydration over the scroll instead of paying for every section at load.
 *
 *  `display: contents`: the wrapper adds no box, so layout is unchanged. After the hand-over it
 *  fires `lf:hydrated`, so page-wide observers (HeatDirector) can pick up the new elements. */

import { useEffect, useRef, useState } from 'react';

export const HYDRATED_EVENT = 'lf:hydrated';

export function HydrateWhenNear({ children, margin = '600px' }: { children: React.ReactNode; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(typeof window === 'undefined');   // server: render it

  useEffect(() => {
    if (live) return;
    // the wrapper is display: contents (no box, never intersects): watch the section inside
    const el = ref.current!.firstElementChild ?? ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); setLive(true); }
    }, { rootMargin: `${margin} 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [live, margin]);

  useEffect(() => {
    if (live && typeof window !== 'undefined') window.dispatchEvent(new Event(HYDRATED_EVENT));
  }, [live]);

  if (!live) {
    // keep the server-rendered HTML untouched until the section is near
    return <div ref={ref} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: '' }} suppressHydrationWarning />;
  }
  return <div ref={ref} style={{ display: 'contents' }}>{children}</div>;
}
