'use client';

/** The Cleave (PLAN §23.1): a plate splits at 38 % along a white-hot seam and the halves
 *  shear apart, revealing what is behind. Two copies of the same cover, each clipped to one
 *  side, pushed apart by one scrubbed timeline: transform-only.
 *
 *  `children` is the real content, rendered normally. The cover exists only once JS with
 *  motion on has armed it (data-armed), so with no JS or motion off the content simply sits
 *  in the page. Tablet and desktop pin for 80 % of a screen; phones never pin (§4.8): there
 *  the plate splits as it scrolls in.
 *
 *  data-open gates the content's first entrance. The readFirst trust variant is unpinned
 *  and reversible; its hallmark strikes still happen only once. */

import { useEffect, useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';

type CleaveProps = { cover: React.ReactNode; children: React.ReactNode; label?: string; pin?: boolean; readFirst?: boolean };

/** Release a prepaint cover if the client bundle never loads. No JS leaves the cover hidden. */
const READ_FALLBACK = "setTimeout(function(){document.querySelectorAll('.cleave[data-read-first]').forEach(function(e){if(!('ready' in e.dataset)){e.dataset.fallback='';e.dataset.open='';}})},10000)";

export function Cleave(props: CleaveProps) {
  return props.readFirst ? <ReadableCleave {...props} /> : <ScrollCleave {...props} />;
}

/** Seek one paused steel split in both scroll directions. The readable heading never moves. */
function ReadableCleave({ cover, children, label }: CleaveProps) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();

  useEffect(() => {
    const el = ref.current!;
    el.dataset.ready = '';
    const showContent = () => {
      el.dataset.open = '';
      el.dataset.phase = 'open';
      el.dataset.progress = '1';
      delete el.dataset.armed;
      delete el.dataset.timeline;
    };
    if (!motionOn || 'fallback' in el.dataset) {
      showContent();
      return;
    }
    const title = el.querySelector<HTMLElement>('.cleave-read-sentinel [data-cleave-title]');
    if (!title) { showContent(); return; }
    el.dataset.armed = '';
    delete el.dataset.open;
    el.dataset.phase = 'closed';
    el.dataset.progress = '0';
    let frame = 0, progress = 0, rebase = false, obscured = false;
    // A resize/overlay may introduce a pivot: it preserves the painted frame while
    // separately measuring the remaining distance to closed and fully open.
    type Travel = { start: number; split: number; end: number; pivot?: { y: number; p: number } };
    let travel: Travel | undefined;
    let geometry: { top: number; height: number; width: number; viewport: number; safe: number } | undefined;
    let animations: Animation[] = [];
    let io: IntersectionObserver | undefined, ro: ResizeObserver | undefined, mo: MutationObserver | undefined;
    const stop = () => {
      cancelAnimationFrame(frame);
      io?.disconnect(); ro?.disconnect(); mo?.disconnect();
      removeEventListener('scroll', schedule); removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', update);
    };
    const fallback = (reason: string) => {
      el.dataset.fallback = reason;
      showContent(); stop();
    };
    const seek = (next: number) => {
      progress = Math.min(1, Math.max(0, next));
      if (!animations.length) {
        el.dataset.timeline = '';
        // getAnimations flushes the CSS timeline. The original keyframes remain paused;
        // their currentTime is a scroll position, never elapsed wall-clock time.
        const cover = el.querySelector<HTMLElement>('.cleave-cover')!;
        if (!cover.getAnimations) { fallback('animation'); return; }
        animations = cover.getAnimations({ subtree: true }).filter((animation) =>
          'animationName' in animation && String(animation.animationName).startsWith('cleave-read-'));
        if (animations.length !== 3) { fallback('animation'); return; }
        animations.forEach((animation) => animation.pause());
      }
      animations.forEach((animation) => {
        animation.currentTime = progress * Number(animation.effect!.getTiming().duration);
      });
      el.dataset.phase = progress === 1 ? 'open' : progress === 0 ? 'closed' : 'opening';
      if (progress === 1) el.dataset.open = '';
      else delete el.dataset.open;
      el.dataset.progress = progress.toFixed(4);
    };
    const setTravel = (range: Travel) => {
      travel = range;
      el.dataset.scrollStart = range.start.toFixed(2);
      el.dataset.scrollSplit = range.split.toFixed(2);
      el.dataset.scrollEnd = range.end.toFixed(2);
    };
    const atScroll = (y: number) => {
      const range = travel!;
      if (y <= range.split) return 0;
      if (y >= range.end) return 1;
      if (!range.pivot) return (y - range.split) / (range.end - range.split);
      const { y: pivotY, p } = range.pivot;
      return y <= pivotY
        ? p * (y - range.split) / (pivotY - range.split)
        : p + (1 - p) * (y - pivotY) / (range.end - pivotY);
    };
    function update() {
      frame = 0;
      const root = document.documentElement;
      if (document.visibilityState !== 'visible' || root.classList.contains('menu-open') || 'intro' in root.dataset) {
        obscured = true;
        return;
      }
      try {
        const box = title!.getBoundingClientRect();
        const safe = Math.max(88, (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 72) + 16);
        const endTop = safe + 24;
        const entryTop = innerHeight - 24 - box.height;
        // No trapped cover in a cramped viewport or after a fast jump past the full range.
        if (entryTop <= endTop || box.left < 16 || box.right > innerWidth - 16) { fallback('geometry'); return; }
        const top = box.top + scrollY;
        const end = top - endTop;
        const entry = top - entryTop;
        const changed = !!geometry && (Math.abs(top - geometry.top) > 1 || Math.abs(box.height - geometry.height) > 1
          || innerWidth !== geometry.width || innerHeight !== geometry.viewport || safe !== geometry.safe);
        geometry = { top, height: box.height, width: innerWidth, viewport: innerHeight, safe };
        if (travel && (obscured || rebase || changed)) {
          obscured = false; rebase = false;
          if (scrollY >= end) {
            // Once the heading has passed the header, reveal it safely, but retain
            // a range so returning upward can still restore the steel.
            setTravel({ start: entry, split: entry + (end - entry) * 0.25, end });
            seek(1); return;
          }
          if (progress === 0) {
            const start = Math.max(entry, scrollY);
            setTravel({ start, split: start + (end - start) * 0.25, end });
          } else {
            // Reflow can move the new reading range below this scroll position.
            // Preserve a proportionate return distance instead of snapping closed
            // after a one-pixel upward movement from the preserved partial frame.
            const returnDistance = (end - entry) * 0.75 * progress;
            const split = Math.min(entry + (end - entry) * 0.25, scrollY - returnDistance);
            setTravel({ start: split - (end - split) / 3, split, end, pivot: { y: scrollY, p: progress } });
          }
          return;
        }
        if (!travel) {
          if (box.top > entryTop) return;
          obscured = false; rebase = false;
          // Deep links start closed at their readable landing. A skipped range starts
          // open and remains reversible when the visitor scrolls back into it.
          const start = scrollY < end ? scrollY : entry;
          setTravel({ start, split: start + (end - start) * 0.25, end });
          seek(scrollY >= end ? 1 : 0);
          return;
        }
        if (travel.pivot && scrollY >= travel.end) {
          // A responsive layout can move the preserved pivot to the top of the
          // document. At full reveal both mappings paint the same frame; restore
          // the heading's actual range so returning upward can reach closed.
          setTravel({ start: entry, split: entry + (end - entry) * 0.25, end });
        }
        seek(atScroll(scrollY));
      } catch { fallback('animation'); }
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    function resized() { rebase = true; schedule(); }
    try {
      io = new IntersectionObserver(schedule, { threshold: [0, 1], rootMargin: '-88px 0px -24px' });
      ro = new ResizeObserver(resized);
      mo = new MutationObserver(schedule);
      io.observe(title); ro.observe(title); ro.observe(el);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-intro'] });
      addEventListener('scroll', schedule, { passive: true });
      addEventListener('resize', resized, { passive: true });
      document.addEventListener('visibilitychange', update);
      update();
    } catch { fallback('animation'); }
    return () => { stop(); delete el.dataset.armed; delete el.dataset.timeline; };
  }, [motionOn]);

  return (
    <div className="cleave" data-read-first="" data-pin="off" data-heat="0.35" ref={ref} suppressHydrationWarning>
      <div className="cleave-inner">{children}</div>
      <div className="cleave-cover" aria-hidden="true" title={label}>
        <div className="cleave-half" data-cleave="l">{cover}</div>
        <div className="cleave-half" data-cleave="r">{cover}</div>
        <i className="cleave-seam" data-seam />
      </div>
      <div className="cleave-read-sentinel" aria-hidden="true">{cover}</div>
      <script dangerouslySetInnerHTML={{ __html: READ_FALLBACK }} />
    </div>
  );
}

function ScrollCleave({ cover, children, label, pin: allowPin = true }: CleaveProps) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();

  useGsap(({ gsap }) => {
    const el = ref.current!;
    if (!motionOn) { delete el.dataset.armed; return; }
    el.dataset.armed = '';
    const mm = gsap.matchMedia();
    mm.add({ pin: '(min-width: 768px)', phone: '(max-width: 767px)' }, (ctx) => {
      const pin = allowPin && !!ctx.conditions!.pin;
      const q = gsap.utils.selector(el);
      const onUpdate = (self: { progress: number }) => { if (self.progress > 0.55 && !('open' in el.dataset)) el.dataset.open = ''; };
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: pin
          ? { trigger: el, start: 'top top', end: '+=80%', pin: true, scrub: 0.8, onUpdate }
          : { trigger: el, start: 'top 75%', end: 'top 5%', scrub: 0.6, onUpdate },
      })
        .fromTo(q('[data-seam]'), { opacity: 0, scaleY: 0.2 }, { opacity: 1, scaleY: 1, duration: 0.18 }, 0)   // the chisel bites
        .to(q('[data-cleave="l"]'), { xPercent: -100, rotate: -1.5, duration: 0.82, ease: 'power2.in' }, 0.18)
        .to(q('[data-cleave="r"]'), { xPercent: 100, rotate: 1.5, duration: 0.82, ease: 'power2.in' }, 0.18)
        .to(q('[data-seam]'), { opacity: 0, scaleX: 6, duration: 0.3 }, 0.3);
    });
    return () => { mm.revert(); delete el.dataset.armed; delete el.dataset.open; };
  }, { dependencies: [motionOn, allowPin] });

  return (
    <div className="cleave" data-pin={allowPin ? 'allowed' : 'off'} data-heat="0.35" ref={ref}>
      <div className="cleave-inner">{children}</div>
      <div className="cleave-cover" aria-hidden="true" title={label}>
        <div className="cleave-half" data-cleave="l">{cover}</div>
        <div className="cleave-half" data-cleave="r">{cover}</div>
        <i className="cleave-seam" data-seam />
      </div>
    </div>
  );
}
