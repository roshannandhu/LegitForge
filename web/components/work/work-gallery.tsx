'use client';

/** The home #work gallery: React Bits AccordionGallery (JS-CSS, vendored in components/react-bits)
 *  with the owner's settings: expandRatio 0.52, trigger "hover", and every panel the same size
 *  until pointed at (defaultIndex -1, the owner's change to the sample's 2). Laptop: pointing at a
 *  panel extends it, leaving the row makes them equal again, one click opens the project. Touch:
 *  one tap extends a panel, a second tap opens the project. The open panel shows only a brief
 *  description. Items come from the server (Projects), with that description already rendered.
 *
 *  Many projects (more than MANY): the same panels in one row that scrolls sideways on every
 *  screen. It drifts left to right by itself while on screen (pausing while pointed at, touched
 *  or focused, and after an arrow), waits at the end, glides back and goes again; ← → buttons
 *  and a progress bar sit under it. Motion off: no drift, the buttons still page. */

import { useEffect, useRef, useState } from 'react';
import AccordionGalleryJs from '@/components/react-bits/accordion-gallery';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export interface GalleryItem {
  image?: string;
  alt?: string;
  initials?: string;
  label: string;
  sublabel?: string;
  link: string;
  linkLabel?: string;
  content?: React.ReactNode;
  cardProps?: Record<string, string>;
}

/** Typed boundary for the vendored JS component: exactly the props this page passes. */
const AccordionGallery = AccordionGalleryJs as unknown as React.ComponentType<{
  items: GalleryItem[]; defaultIndex?: number; expandRatio?: number; trigger?: 'hover' | 'click'; reduceMotion?: boolean; className?: string;
}>;

const MANY = 5;            // up to this many, the panels share one row that fits the page
const SPEED = 36;          // px per second of drift
const REST = 2200;         // ms at the end before gliding back

export function WorkGallery({ items }: { items: GalleryItem[] }) {
  const motionOn = useMotionEnabled();
  const many = items.length > MANY;
  const viewport = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const hold = useRef(0);                                   // drift resumes after this time (ms)

  // the arrows' state and the progress bar follow the scroll position
  useEffect(() => {
    const vp = viewport.current;
    if (!many || !vp) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = vp.scrollWidth - vp.clientWidth;
      const p = max > 0 ? vp.scrollLeft / max : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.04, p).toFixed(3)})`;
      setEdges((e) => {
        const n = { start: vp.scrollLeft <= 2, end: vp.scrollLeft >= max - 2 };
        return n.start === e.start && n.end === e.end ? e : n;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    vp.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(vp);
    return () => { vp.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [many]);

  // the drift: only with many projects, motion on, on screen and the tab visible
  useEffect(() => {
    const vp = viewport.current;
    if (!many || !motionOn || !vp) return;
    let raf = 0, last = 0, pos = vp.scrollLeft, onScreen = false, inside = false, back = 0;
    const pause = (ms: number) => { hold.current = Math.max(hold.current, performance.now() + ms); };
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (inside || t < hold.current || document.hidden) { pos = vp.scrollLeft; return; }
      const max = vp.scrollWidth - vp.clientWidth;
      if (max <= 0) return;
      if (pos >= max - 1) {                                  // the end: rest, glide back, rest, again
        pause(REST + 1600);
        back = window.setTimeout(() => { vp.scrollTo({ left: 0, behavior: 'smooth' }); pos = 0; }, REST);
        return;
      }
      pos = Math.min(max, pos + SPEED * dt);
      vp.scrollLeft = Math.round(pos);
    };
    const start = () => { if (!raf && onScreen) { last = 0; pos = vp.scrollLeft; raf = requestAnimationFrame(step); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); else stop(); }, { threshold: 0.25 });
    io.observe(vp);
    // a scroll we didn't make (a finger, a trackpad, the keyboard, an arrow) lands away from
    // where the drift put it: the reader takes over for a while
    const onScroll = () => { if (Math.abs(vp.scrollLeft - Math.round(pos)) > 2) { pos = vp.scrollLeft; pause(4000); } };
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse') inside = true; else pause(5000); };
    const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse') { inside = false; pause(1200); } };
    // keyboard focus holds it (a tapped link keeps focus too, and a tap only pauses: see enter)
    const focusIn = (e: FocusEvent) => { if ((e.target as Element).matches(':focus-visible')) inside = true; };
    const focusOut = () => { inside = false; pause(1500); };
    vp.addEventListener('scroll', onScroll, { passive: true });
    vp.addEventListener('pointerenter', enter);
    vp.addEventListener('pointerdown', enter);
    vp.addEventListener('pointerleave', leave);
    vp.addEventListener('focusin', focusIn);
    vp.addEventListener('focusout', focusOut);
    return () => {
      stop(); io.disconnect(); clearTimeout(back);
      vp.removeEventListener('scroll', onScroll);
      vp.removeEventListener('pointerenter', enter);
      vp.removeEventListener('pointerdown', enter);
      vp.removeEventListener('pointerleave', leave);
      vp.removeEventListener('focusin', focusIn);
      vp.removeEventListener('focusout', focusOut);
    };
  }, [many, motionOn]);

  const page = (dir: -1 | 1) => {
    const vp = viewport.current!;
    hold.current = performance.now() + 6000;               // the reader is driving now
    vp.scrollBy({ left: dir * vp.clientWidth * 0.8, behavior: motionOn ? 'smooth' : 'auto' });
  };

  const gallery = (
    <AccordionGallery
      items={items}
      defaultIndex={-1}
      expandRatio={0.52}
      trigger="hover"
      reduceMotion={!motionOn}
      className="work-gallery"
    />
  );
  if (!many) return gallery;
  return (
    <div className="ag-scroll">
      <div className="ag-viewport" ref={viewport}>{gallery}</div>
      <div className="ag-bar">
        <span className="ag-count num">{items.length} projects</span>
        <span className="ag-progress" aria-hidden="true"><span ref={bar} /></span>
        <div className="ag-arrows">
          <button type="button" className="strip-btn" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous projects">←</button>
          <button type="button" className="strip-btn" onClick={() => page(1)} disabled={edges.end} aria-label="Next projects">→</button>
        </div>
      </div>
    </div>
  );
}
