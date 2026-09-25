'use client';

/** The Phone Becomes the Machine — PLAN §6.2a
 *
 *  No WebGL. CSS 3D transforms give real depth and correct occlusion through
 *  translateZ, and run on the compositor. three.js would add 450-600KB to do
 *  the same job worse and blow the 180KB first-load budget (§11.1).
 *
 *  This is a client component, but Next still server-renders its markup, so all
 *  seven service names ship in the HTML.
 */

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { PLATES, LAYOUTS, actLabel, type Layout } from '@/lib/hero-layout';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { useGsap, type Gs } from '@/lib/gsap';

/** Act-3 offsets, server-rendered as CSS vars so the machine is correct with no
 *  JS at all (PLAN §6.2a: the HTML default is act 3, not the last frame). */
function plateVars(id: string) {
  const d = LAYOUTS.desktop;
  const m = LAYOUTS.phone;
  const dp = d.positions.find((p) => p.id === id);
  const mp = m.positions.find((p) => p.id === id);
  const v: Record<string, string> = {};
  if (dp) { v['--dx'] = String(dp.x - d.origin.x); v['--dy'] = String(dp.y - d.origin.y); v['--dz'] = String(dp.z); }
  if (mp) { v['--mx'] = String(mp.x - m.origin.x); v['--my'] = String(mp.y - m.origin.y); v['--mz'] = String(mp.z); }
  return v;
}

/** Stage and phone sizes, server-rendered like plateVars so the first paint already has the
 *  right geometry. Only the scale (--fit) waits for hydration, and nothing waits for GSAP. */
const STAGE_VARS = {
  '--dw': `${LAYOUTS.desktop.w}px`, '--dh': `${LAYOUTS.desktop.h}px`, '--dphone': `${LAYOUTS.desktop.phone}px`,
  '--mw': `${LAYOUTS.phone.w}px`, '--mh': `${LAYOUTS.phone.h}px`, '--mphone': `${LAYOUTS.phone.phone}px`,
} as React.CSSProperties;

/** Sets --fit during parsing, before first paint, so the stage never visibly rescales at
 *  hydration. The effect in Machine keeps it right on resize — same formula, keep in step. */
const FIT_NOW = `(function(s){var b=s.parentElement.getBoundingClientRect(),p=matchMedia('(max-width: 767px)').matches,` +
  `w=p?${LAYOUTS.phone.w}:${LAYOUTS.desktop.w},h=p?${LAYOUTS.phone.h}:${LAYOUTS.desktop.h};` +
  `if(b.width)s.style.setProperty('--fit',Math.min((b.width-(w<500?0:28))/w,b.height/h,1.25).toFixed(3))})` +
  `(document.currentScript.previousElementSibling)`;

export default function Machine() {
  const motionOn = useMotionEnabled();   // OS reduced-motion OR the footer switch (§5.5)
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const wires = useRef<SVGSVGElement>(null);
  const trigger = useRef<Gs['ScrollTrigger']>(undefined);   // set once GSAP has loaded

  // Scale the fixed design space to its box. Plain DOM, so it runs at hydration.
  useEffect(() => {
    const stageEl = stage.current!;
    const box = stageEl.parentElement!;
    const phoneMq = matchMedia('(max-width: 767px)');
    const ro = new ResizeObserver(() => {
      const L = phoneMq.matches ? LAYOUTS.phone : LAYOUTS.desktop;
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      const margin = L.w < 500 ? 0 : 28;   // desktop fan needs air; the phone grid is flush
      stageEl.style.setProperty('--fit', Math.min((r.width - margin) / L.w, r.height / L.h, 1.25).toFixed(3));
      trigger.current?.refresh();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useGsap(({ gsap, ScrollTrigger }) => {
    trigger.current = ScrollTrigger;
    const wiresEl = wires.current!;
    const host = root.current!;
    // useGsap's scope makes selector strings resolve INSIDE the machine, so the hero
    // section (an ancestor) must be passed as an element, never as an id selector.
    const heroSection = host.closest('section') as HTMLElement;
    const SVGNS = 'http://www.w3.org/2000/svg';
    const reduced = !motionOn;

    const mm = gsap.matchMedia();
    mm.add(
      { isPhone: '(max-width: 767px)', isDesktop: '(min-width: 768px)' },
      (ctx) => {
        const L: Layout = ctx.conditions!.isPhone ? LAYOUTS.phone : LAYOUTS.desktop;
        const O = L.origin;
        const use = new Set(L.positions.map((p) => p.id));

        wiresEl.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);

        // a layout hides the plates it does not use; it never deletes them
        host.querySelectorAll<HTMLElement>('[data-plate]').forEach((el) => {
          el.style.display = use.has(el.dataset.plate as never) ? '' : 'none';
        });

        wiresEl.innerHTML = '';
        const leaders = document.createElementNS(SVGNS, 'g');
        const chain = document.createElementNS(SVGNS, 'g');
        wiresEl.append(leaders, chain);

        const plateEls = L.positions.map(
          (p) => host.querySelector<HTMLElement>(`[data-plate="${p.id}"]`)!,
        );

        L.positions.forEach((p) => {
          const ld = document.createElementNS(SVGNS, 'path');
          ld.setAttribute('d', `M${O.x},${O.y} L${p.x},${p.y}`);
          ld.setAttribute('class', 'leader');
          ld.dataset.leader = p.id;
          leaders.appendChild(ld);
        });

        for (let i = 0; i < L.positions.length - 1; i++) {
          const a = L.positions[i];
          const b = L.positions[i + 1];
          const d = `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 - 40} ${b.x},${b.y}`;
          for (const cls of ['wire', 'wire-hot', 'pulse']) {
            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', cls);
            chain.appendChild(path);
          }
        }

        const hots = [...wiresEl.querySelectorAll<SVGPathElement>('.wire-hot')];
        const pulses = [...wiresEl.querySelectorAll<SVGPathElement>('.pulse')];
        const leads = [...wiresEl.querySelectorAll<SVGPathElement>('.leader')];

        [...hots, ...leads].forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len });   // both values: a lone one leaves CSS's second
        });
        // One 46-unit dash with a gap longer than the path. Offset 46 parks it just before the
        // start, -len just past the end, so it is invisible at rest in BOTH scrub directions.
        // (Offsetting by len+46 = one full period put the dash back at the start — visible.)
        pulses.forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: `46 ${len + 100}`, strokeDashoffset: 46, opacity: 1 });
        });

        /* Motion off shows act 3 — plates spread, wired, labelled with services.
           Deliberate exception to "default = last frame": the last frame is a
           collapsed phone, which communicates nothing. */
        if (reduced) {
          L.positions.forEach((p, i) =>
            gsap.set(plateEls[i], {
              x: p.x - O.x, y: p.y - O.y, z: p.z, opacity: 1, scale: 1,
              rotateY: (p.x - O.x) * 0.025, '--plate-heat': 1,
            }),
          );
          gsap.set('.l-tech', { opacity: 0 });
          gsap.set('.l-service', { opacity: 1 });
          gsap.set('.wire', { opacity: 0.45 });
          gsap.set([...hots, ...leads], { strokeDashoffset: 0 });
          return;
        }

        const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
        gsap.set(plateEls, { x: 0, y: 0, z: 0, opacity: 0, scale: 0.55 });
        gsap.set('.l-tech', { opacity: 1 });      // CSS default is act 3; act 1 starts here
        gsap.set('.l-service', { opacity: 0 });

        /* act 1 — explode : 0 -> .35 */
        const step = 0.26 / Math.max(1, L.positions.length);
        tl.to('.wire', { opacity: 0.45, duration: 0.1 }, 0.02);
        L.positions.forEach((p, i) => {
          const at = 0.02 + i * step;
          tl.to(plateEls[i], {
            x: p.x - O.x, y: p.y - O.y, z: p.z, scale: 1, opacity: 1,
            rotateY: (p.x - O.x) * 0.025, duration: 0.13, ease: 'power2.out',
          }, at);
          tl.to(`[data-leader="${p.id}"]`, { strokeDashoffset: 0, duration: 0.11 }, at);
        });

        /* act 2 — wire : .35 -> .60 */
        const wstep = 0.21 / Math.max(1, hots.length);
        tl.to(plateEls[0], { '--plate-heat': 1, duration: 0.05 }, 0.35);
        hots.forEach((p, i) => {
          const at = 0.355 + i * wstep;
          tl.to(p, { strokeDashoffset: 0, duration: 0.075, ease: 'power1.inOut' }, at);
          tl.to(plateEls[i + 1], { '--plate-heat': 1, duration: 0.05 }, at + 0.035);
        });
        pulses.forEach((p, i) => {
          const len = p.getTotalLength();
          const at = 0.375 + i * wstep;
          tl.fromTo(p, { strokeDashoffset: 46 }, { strokeDashoffset: -len, duration: 0.1, ease: 'power1.inOut' }, at);
        });

        /* act 3 — become : .60 -> .85 (swap, then hold) */
        tl.to('.l-tech',    { opacity: 0, y: -6, duration: 0.05, stagger: 0.009 }, 0.6)
          .to('.l-service', { opacity: 1, y: 0,  duration: 0.05, stagger: 0.009 }, 0.607);

        /* act 4 — collapse : .85 -> 1 */
        tl.to(hots,    { strokeDashoffset: (i, t: SVGPathElement) => t.getTotalLength(), duration: 0.06 }, 0.85)
          .to(leads,   { strokeDashoffset: (i, t: SVGPathElement) => t.getTotalLength(), duration: 0.06 }, 0.85)
          .to('.wire', { opacity: 0, duration: 0.06 }, 0.87)
          .to(plateEls, {
            x: 0, y: 0, z: 0, scale: 0.55, opacity: 0, duration: 0.07,
            stagger: { each: 0.008, from: 'end' }, ease: 'power2.in',
          }, 0.87)
          .to(heroSection, { '--heat': 0.78, duration: 0.02 }, 0.94)   // the one flash
          .to(heroSection, { '--heat': 0.35, duration: 0.04 }, 0.96);

        // ?qa=<0..1> freezes the hero at one act for review. Read in the browser so the
        // page itself stays static and CDN-cached.
        const qaParam = new URLSearchParams(location.search).get('qa');
        const qa = qaParam === null ? NaN : Number(qaParam);
        if (Number.isFinite(qa)) {
          tl.progress(Math.min(1, Math.max(0, qa)));
        } else {
          ScrollTrigger.create({
            trigger: heroSection, start: 'top top', end: L.end,
            pin: L.pin, scrub: 0.8, invalidateOnRefresh: true, animation: tl,
            onUpdate: (st) => {
              const d = document.getElementById('devAct');
              if (d) d.textContent = actLabel(st.progress);
            },
          });
        }
      },
    );
  }, { scope: root, dependencies: [motionOn] });

  return (
    <div className="stage-fit" ref={root}>
      {/* suppressHydrationWarning: FIT_NOW adds --fit to this style before React hydrates */}
      <div className="stage" ref={stage} style={STAGE_VARS} suppressHydrationWarning>
        <div className="machine">
          <svg className="wires" ref={wires} viewBox="0 0 780 760" aria-hidden="true" />

          <ul className="plates">
            {PLATES.map((p) => (
              <li
                className="plate"
                key={p.id}
                data-plate={p.id}
                data-on-phone={LAYOUTS.phone.positions.some((q) => q.id === p.id) ? '1' : '0'}
                style={plateVars(p.id) as React.CSSProperties}
              >
                <span className="num" aria-hidden="true">{p.num}</span>
                <span className="labels">
                  <span className="l l-tech">{p.tech}</span>
                  <span className="l l-service">{p.service}</span>
                </span>
                <span className="bar"><i /></span>
              </li>
            ))}
          </ul>

          <div className="phone">
            <Image
              src="/hero/phone@2x.avif"
              alt=""
              width={1200}
              height={1653}
              priority
              sizes="(max-width: 767px) 62vw, 34vw"
            />
            <div className="screen" aria-hidden="true">
              <div className="s-hero" />
              <div className="s-row w80" />
              <div className="s-row w60" />
              <div className="s-grid"><div className="s-card" /><div className="s-card" /></div>
              <div className="s-row w40" />
              <div className="s-bar" />
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIT_NOW }} />
    </div>
  );
}
