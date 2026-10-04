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
 *  data-open marks the moment the halves are mostly apart (and stays), so the content can
 *  start its own entrance then, not while it is still hidden (the Trust plates key off it). */

import { useEffect, useRef } from 'react';
import { useGsap } from '@/lib/gsap';
import { useMotionEnabled } from './motion-provider';

type CleaveProps = { cover: React.ReactNode; children: React.ReactNode; label?: string; pin?: boolean; readFirst?: boolean };

/** Release a prepaint cover if the client bundle never loads. No JS leaves the cover hidden. */
const READ_FALLBACK = "setTimeout(function(){document.querySelectorAll('.cleave[data-read-first]').forEach(function(e){if(!('ready' in e.dataset)){e.dataset.fallback='';e.dataset.open='';}})},10000)";

export function Cleave(props: CleaveProps) {
  return props.readFirst ? <ReadableCleave {...props} /> : <ScrollCleave {...props} />;
}

/** Read the stationary heading, then watch a timed split. Scroll speed never skips its frames. */
function ReadableCleave({ cover, children, label }: CleaveProps) {
  const ref = useRef<HTMLDivElement>(null);
  const completed = useRef(false);
  const motionOn = useMotionEnabled();

  useEffect(() => {
    const el = ref.current!;
    el.dataset.ready = '';
    const showContent = () => {
      completed.current = true;
      el.dataset.open = '';
      el.dataset.phase = 'open';
      delete el.dataset.armed;
      delete el.dataset.playing;
    };
    if (!motionOn || completed.current || 'fallback' in el.dataset || 'open' in el.dataset) {
      showContent();
      return;
    }
    const title = el.querySelector<HTMLElement>('.cleave-read-sentinel [data-cleave-title]');
    if (!title) { showContent(); return; }
    el.dataset.armed = '';
    el.dataset.phase = 'closed';
    let wait = 0, frame = 0;
    let io: IntersectionObserver | undefined, ro: ResizeObserver | undefined, mo: MutationObserver | undefined;
    const cancelWait = () => { clearTimeout(wait); wait = 0; };
    const readable = () => {
      const box = title.getBoundingClientRect();
      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 72;
      const root = document.documentElement;
      return document.visibilityState === 'visible' && !root.classList.contains('menu-open') && !('intro' in root.dataset)
        && box.top >= Math.max(88, headerBottom + 16)
        && box.bottom <= innerHeight - 24 && box.left >= 16 && box.right <= innerWidth - 16;
    };
    const stop = () => {
      cancelWait(); cancelAnimationFrame(frame);
      io?.disconnect(); ro?.disconnect(); mo?.disconnect();
      removeEventListener('scroll', schedule); removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', update);
      el.removeEventListener('animationend', ended);
    };
    function update() {
      frame = 0;
      if (completed.current) return;
      // A cramped zoomed/landscape viewport must not leave an unreadable closed cover.
      if (title!.getBoundingClientRect().height > innerHeight - 112) { showContent(); stop(); return; }
      if (el.dataset.phase === 'opening') {
        if (readable()) el.dataset.playing = '';
        else delete el.dataset.playing;
        return;
      }
      if (!readable()) { cancelWait(); return; }
      if (!wait) wait = window.setTimeout(() => {
        wait = 0;
        if (!readable()) return;
        el.dataset.phase = 'opening';
        el.dataset.playing = '';
      }, 1500);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    function ended(event: AnimationEvent) {
      if (event.animationName !== 'cleave-read-left') return;
      // Hallmarks start only once the steel has actually cleared the promises.
      showContent(); stop();
    }
    io = new IntersectionObserver(schedule, { threshold: [0, 1], rootMargin: '-88px 0px -24px' });
    ro = new ResizeObserver(schedule);
    mo = new MutationObserver(schedule);
    io.observe(title); ro.observe(title);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-intro'] });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', update);
    el.addEventListener('animationend', ended);
    update();
    return () => { stop(); delete el.dataset.armed; delete el.dataset.playing; };
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
