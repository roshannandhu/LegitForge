'use client';

/** The home #work rail (plan N): any number of portrait, phone-shaped project cards, chosen in
 *  Admin → Projects (★ "Show on the home page", in admin order).
 *
 *  Tablets and laptops (motion on): the section pins and scrolling slides the row sideways; the
 *  card passing the centre grows to full size and faces you, the others ease back and turn a
 *  little (a coverflow), and a counter follows. Transform only, one write per card per frame.
 *  Phones, motion off and no JS: a native swipe row with snap points; on phones the centred card
 *  is marked active (full colour, details shown). Cards are server markup passed as children. */

import { useEffect, useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export function ProjectRail({ children, count, head }: { children: React.ReactNode; count: number; head: React.ReactNode }) {
  const motionOn = useMotionEnabled();
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  // phones / unpinned: the card nearest the middle of the row is the active one
  useEffect(() => {
    const row = track.current!;
    const cards = [...row.querySelectorAll<HTMLElement>('.rail-card')];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if ('pinned' in root.current!.dataset) return;                  // the pinned rail picks its own
      (e.target as HTMLElement).toggleAttribute('data-active', e.intersectionRatio > 0.75);
      if (e.intersectionRatio > 0.75 && counter.current) counter.current.textContent = String(Math.min(cards.indexOf(e.target as HTMLElement) + 1, count)).padStart(2, '0');
    }), { root: row, threshold: [0, 0.75, 1] });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [count]);

  useGsap(({ gsap, ScrollTrigger }) => {
    const el = root.current!, row = track.current!;
    const cards = [...row.querySelectorAll<HTMLElement>('.rail-card')];
    if (!motionOn) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 768px)', () => {
      el.dataset.pinned = '';
      const shift = () => Math.max(0, row.scrollWidth - row.clientWidth);
      const sets = cards.map((c) => gsap.quickSetter(c, 'css'));
      const place = () => {
        const mid = row.getBoundingClientRect().left + row.clientWidth / 2;
        let best = 0, bestD = Infinity;
        cards.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = Math.max(-1, Math.min(1, (r.left + r.width / 2 - mid) / (row.clientWidth * 0.55)));
          const a = Math.abs(d);
          if (a < bestD) { bestD = a; best = i; }
          sets[i]({ scale: 1 - 0.14 * a, rotateY: -d * 14, z: -a * 60, opacity: 1 - 0.25 * a });
          c.toggleAttribute('data-active', a < 0.18);
        });
        if (counter.current) counter.current.textContent = String(Math.min(best + 1, count)).padStart(2, '0');
      };
      const tween = gsap.to(row.querySelector('.rail-list'), {
        x: () => -shift(), ease: 'none',
        onUpdate: place,                                                // after each scrubbed step, so the cards follow the row
        scrollTrigger: {
          trigger: el, start: 'top top', end: () => '+=' + shift(), pin: true, scrub: 0.6, invalidateOnRefresh: true,
          onUpdate: (st) => { if (bar.current) bar.current.style.transform = `scaleX(${st.progress})`; },
          onRefresh: place,
        },
      });
      cards.forEach((c) => c.removeAttribute('data-active'));
      place();
      return () => { tween.scrollTrigger?.kill(); tween.kill(); delete el.dataset.pinned; cards.forEach((c) => { c.style.transform = ''; c.style.opacity = ''; c.removeAttribute('data-active'); }); };
    });
    return () => mm.revert();
    void ScrollTrigger;
  }, { dependencies: [motionOn, count] });

  return (
    <div className="rail" ref={root}>
      {head}
      <div className="rail-viewport" ref={track as never}>
        <ul className="rail-list">{children}</ul>
      </div>
      <div className="rail-foot" aria-hidden="true">
        <span className="rail-count num"><span ref={counter}>01</span> / {String(count).padStart(2, '0')}</span>
        <span className="rail-bar"><span ref={bar} /></span>
      </div>
    </div>
  );
}
