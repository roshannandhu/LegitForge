'use client';

/** The Phone Becomes the Machine — PLAN §6.2a, upgraded per §6.2b:
 *  #1 one message travels the wires, #2 the screen ends on the payoff,
 *  #3 camera turn + depth of field, #5 hallmark stamp, #7 build log (HeroLog).
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
import { useLenis } from 'lenis/react';
import {
  PLATES, LAYOUTS, STORIES, STORY_EVENT, DEFAULT_STORY, actIndex, actLabel, isStoryId,
  type Layout, type StoryId,
} from '@/lib/hero-layout';
import { AnvilMark } from '@/components/ui/icons';
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

/** Where the message chip parks with no JS and with motion off: just above the last plate. */
const lastOf = (L: Layout) => L.positions[L.positions.length - 1];
const CHIP_VARS = {
  '--cx': lastOf(LAYOUTS.desktop).x, '--cy': lastOf(LAYOUTS.desktop).y - 58,
  '--cmx': lastOf(LAYOUTS.phone).x, '--cmy': lastOf(LAYOUTS.phone).y - 44,
} as unknown as React.CSSProperties;

/** Spark directions for the hallmark stamp (#5): six, fanned, never symmetric. */
const SPARKS = [[-34, -18], [-22, -30], [4, -34], [26, -24], [34, -6], [-30, 4]];

export interface Showcase { image: string; alt: string }

let introPlayed = false;   // the brand intro plays once per page load, not per breakpoint change

export default function Machine({ showcase = null }: { showcase?: Showcase | null }) {
  const motionOn = useMotionEnabled();   // OS reduced-motion OR the footer switch (§5.5)
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const wires = useRef<SVGSVGElement>(null);
  const trigger = useRef<Gs['ScrollTrigger']>(undefined);   // set once GSAP has loaded
  const story = useRef<StoryId>(DEFAULT_STORY);             // which job the machine is doing
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;

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
    // useGsap's scope makes selector strings resolve INSIDE the machine, so anything outside it
    // (the hero section, the build log) is passed as an element, never as a selector string.
    const heroSection = host.closest('section') as HTMLElement;
    const hud = heroSection.querySelector<HTMLElement>('.hud');
    const logLines = hud ? [...hud.querySelectorAll<HTMLElement>('.hud-log li')] : [];
    const machineEl = host.querySelector<HTMLElement>('.machine')!;
    const screen = host.querySelector<HTMLElement>('.screen')!;
    const chip = host.querySelector<HTMLElement>('.packet')!;
    const chipText = chip.querySelector('span')!;
    const SVGNS = 'http://www.w3.org/2000/svg';
    const reduced = !motionOn;
    const params = new URLSearchParams(location.search);
    const first = heroSection.dataset.story ?? params.get('story');   // StoryChips may have set it already
    if (isStoryId(first)) story.current = first;
    const setStoryAttrs = () => {
      screen.dataset.story = story.current;
      if (hud) hud.dataset.story = story.current;
    };
    setStoryAttrs();

    const mm = gsap.matchMedia();
    mm.add(
      { isPhone: '(max-width: 767px)', isDesktop: '(min-width: 768px)', fine: '(pointer: fine) and (min-width: 1024px)' },
      (ctx) => {
        const { isPhone, fine } = ctx.conditions!;
        const L: Layout = isPhone ? LAYOUTS.phone : LAYOUTS.desktop;
        const O = L.origin;
        const use = new Set(L.positions.map((p) => p.id));
        const ids = L.positions.map((p) => p.id);

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
          for (const cls of ['wire', 'wire-hot']) {
            const path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', cls);
            chain.appendChild(path);
          }
        }

        const hots = [...wiresEl.querySelectorAll<SVGPathElement>('.wire-hot')];
        const leads = [...wiresEl.querySelectorAll<SVGPathElement>('.leader')];

        [...hots, ...leads].forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len });   // both values: a lone one leaves CSS's second
        });

        /* ------------------------------------------------ the message's route (#1)
           Legs are real SVG paths, so the chip rides exactly on the wire in both scroll
           directions. In: phone -> first plate. Chain: plate to plate, each drawing its hot
           wire behind the chip. Out (act 4): last plate -> phone. */
        const W = { in: [0.24, 0.3], chain: [0.3, 0.56], out: [0.8, 0.86] } as const;
        const segDur = (W.chain[1] - W.chain[0]) / Math.max(1, hots.length);
        const legs: { path: SVGPathElement; t0: number; t1: number; reverse?: boolean }[] = [
          { path: leads[0], t0: W.in[0], t1: W.in[1] },
          ...hots.map((path, i) => ({ path, t0: W.chain[0] + i * segDur, t1: W.chain[0] + (i + 1) * segDur })),
          { path: leads[leads.length - 1], t0: W.out[0], t1: W.out[1], reverse: true },
        ];
        const lens = legs.map((l) => l.path.getTotalLength());
        const arriveAt = ids.map((_, k) => (k === 0 ? W.in[1] : W.chain[0] + k * segDur));

        const lastRender = { chip: '', lines: -1, act: -1, screen: '' };
        screen.dataset.live = '1';
        if (hud) hud.dataset.live = '1';
        /** Everything that is a state rather than a tween: chip position and label, log lines,
         *  act rail, screen. Driven by timeline progress, so ?qa= and reverse scrub both work. */
        const renderStory = (p: number) => {
          // chip
          let leg = legs.findIndex((l) => p >= l.t0 && p <= l.t1);
          let label = '';
          if (leg === -1) {
            // parked: on the last plate between the chain and the return, hidden otherwise
            const parked = p > W.chain[1] && p < W.out[0];
            gsap.set(chip, { autoAlpha: parked ? 1 : 0 });
            if (parked) {
              const last = lastOf(L);
              gsap.set(chip, { x: last.x, y: last.y - 58 });
              label = STORIES[story.current].steps[ids[ids.length - 1]].chip;
            }
          } else {
            const l = legs[leg];
            const t = (p - l.t0) / (l.t1 - l.t0);
            const pt = l.path.getPointAtLength((l.reverse ? 1 - t : t) * lens[leg]);
            gsap.set(chip, { autoAlpha: 1, x: pt.x, y: pt.y });
            const S = STORIES[story.current];
            label = leg === 0 ? S.opening : leg === legs.length - 1 ? S.home : S.steps[ids[leg - 1]].chip;
          }
          if (label && label !== lastRender.chip) { chipText.textContent = label; lastRender.chip = label; }

          // build log: one line per plate the message has reached, then "done"
          const reached = arriveAt.filter((t) => p >= t).length;
          const n = reached + (p >= W.out[1] ? 1 : 0);
          if (n !== lastRender.lines && logLines.length) {
            lastRender.lines = n;
            const visible = new Set<string>([...ids.slice(0, reached), ...(p >= W.out[1] ? ['done'] : []), ...(reached ? [] : ['wait'])]);
            logLines.forEach((li) => {
              const own = !li.dataset.story || li.dataset.story === story.current;
              li.hidden = !own || !visible.has(li.dataset.step!);
            });
          }

          // act rail
          const act = actIndex(p) + 1;
          if (act !== lastRender.act && hud) { hud.dataset.act = String(act); lastRender.act = act; }

          // screen (#2): our brand -> the story's screen -> its request -> its result -> a real project
          const state = p < 0.08 ? 'brand' : p < W.in[0] ? 'start' : p < W.out[1] + 0.03 ? 'ask'
            : showcase && p > 0.95 ? 'show' : 'reply';
          if (state !== lastRender.screen) { screen.dataset.state = state; lastRender.screen = state; }
        };

        const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true, onUpdate: () => renderStory(tl.progress()) });
        gsap.set(plateEls, { x: 0, y: 0, z: 0, opacity: 0, scale: 0.55, filter: 'blur(0px)', '--stamp': 0 });
        gsap.set('.l-tech', { opacity: 1 });      // CSS default is act 3; act 1 starts here
        gsap.set('.l-service', { opacity: 0, scale: 1 });
        gsap.set('.spark', { opacity: 0, x: 0, y: 0 });
        gsap.set(chip, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
        gsap.set(machineEl, { rotationY: 0, rotationX: 0, scale: 1 });

        /* camera (#3): turn and dolly in as it explodes, settle for the hold, square up to land */
        const turn = isPhone ? -4 : -7;
        tl.to(machineEl, { rotationY: turn, rotationX: 4, scale: 1.04, duration: 0.3, ease: 'power1.inOut' }, 0)
          .to(machineEl, { rotationY: turn * 0.4, rotationX: 2, scale: 1.02, duration: 0.14, ease: 'power1.inOut' }, 0.56)
          .to(machineEl, { rotationY: 0, rotationX: 0, scale: 1, duration: 0.14, ease: 'power2.inOut' }, 0.84);

        /* act 1 — explode : 0 -> .27 */
        const step = 0.2 / Math.max(1, L.positions.length);
        tl.to('.wire', { opacity: 0.45, duration: 0.1 }, 0.02);
        L.positions.forEach((p, i) => {
          const at = 0.02 + i * step;
          const blur = p.z < 0 ? (-p.z / 100).toFixed(2) : '0';   // depth of field: far plates soft
          tl.to(plateEls[i], {
            x: p.x - O.x, y: p.y - O.y, z: p.z, scale: 1, opacity: 1,
            rotateY: (p.x - O.x) * 0.025, filter: `blur(${blur}px)`, duration: 0.12, ease: 'power2.out',
          }, at);
          tl.to(`[data-leader="${p.id}"]`, { strokeDashoffset: 0, duration: 0.1 }, at);
        });

        /* act 2 — wire : .27 -> .58. The hot wire draws behind the travelling message and
           each plate heats as it arrives. */
        tl.to(plateEls[0], { '--plate-heat': 1, duration: 0.02 }, W.in[1]);
        hots.forEach((p, i) => {
          const at = W.chain[0] + i * segDur;
          tl.to(p, { strokeDashoffset: 0, duration: segDur }, at);
          tl.to(plateEls[i + 1], { '--plate-heat': 1, duration: 0.02 }, at + segDur);
        });

        /* act 3 — become : .58 -> .80. Focus pulls sharp, then each service name is struck
           onto its plate (#5): the tech label lifts away, the name hammers in, sparks fly,
           a stamped border stays. */
        tl.to(plateEls, { filter: 'blur(0px)', duration: 0.03 }, 0.56);
        plateEls.forEach((el, i) => {
          const at = 0.59 + i * 0.022;
          tl.to(el.querySelector('.l-tech'), { opacity: 0, y: -6, duration: 0.012 }, at)
            .fromTo(el.querySelector('.l-service'), { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.014, ease: 'power4.in', immediateRender: false }, at)
            .to(el, { '--stamp': 1, duration: 0.004 }, at + 0.014);
          el.querySelectorAll<HTMLElement>('.spark').forEach((sp, k) => {
            const [dx, dy] = SPARKS[k];
            tl.to(sp, { opacity: 1, duration: 0.001 }, at + 0.013)
              .to(sp, { x: dx, y: dy, opacity: 0, duration: 0.022, ease: 'power2.out' }, at + 0.014);
          });
        });

        /* act 4 — ship : .80 -> 1. The reply rides home, the machine folds back into the phone,
           one heat flash, the screen shows the answer (or a real project). */
        tl.to(hots,    { strokeDashoffset: (i, t: SVGPathElement) => t.getTotalLength(), duration: 0.06 }, 0.85)
          .to(leads,   { strokeDashoffset: (i, t: SVGPathElement) => t.getTotalLength(), duration: 0.06 }, 0.85)
          .to('.wire', { opacity: 0, duration: 0.06 }, 0.87)
          .to(plateEls, {
            x: 0, y: 0, z: 0, scale: 0.55, opacity: 0, duration: 0.07,
            stagger: { each: 0.008, from: 'end' }, ease: 'power2.in',
          }, 0.87)
          .to(heroSection, { '--heat': 0.78, duration: 0.02 }, 0.94)   // the one flash
          .to(heroSection, { '--heat': 0.35, duration: 0.04 }, 0.96);

        /* pointer parallax on desktop (#3): the rig, not the machine, so it never fights the
           scroll timeline's camera. */
        let offPointer = () => {};
        if (fine && !reduced) {
          const ry = gsap.quickTo(rig.current!, 'rotationY', { duration: 0.8, ease: 'power3.out' });
          const rx = gsap.quickTo(rig.current!, 'rotationX', { duration: 0.8, ease: 'power3.out' });
          const move = (e: PointerEvent) => {
            ry((e.clientX / innerWidth - 0.5) * 5);
            rx(-(e.clientY / innerHeight - 0.5) * 3);
          };
          heroSection.addEventListener('pointermove', move);
          offPointer = () => heroSection.removeEventListener('pointermove', move);
        }

        /* Motion off: the act-3 hold, fully told — plates stamped, wires lit, the message parked
           on the last plate, the whole log, the reply on screen. Deliberate exception to
           "default = last frame": the last frame is a closed phone, which says nothing. */
        const qaParam = params.get('qa');
        const qa = qaParam === null ? NaN : Number(qaParam);
        const stillFrame = () => {
          tl.progress(0.78);
          renderStory(0.78);                  // same position as before a story swap: GSAP skips onUpdate
          gsap.set(machineEl, { rotationY: 0, rotationX: 0, scale: 1 });
          logLines.forEach((li) => { li.hidden = li.dataset.step === 'wait' || li.dataset.story !== story.current; });
          screen.dataset.state = showcase ? 'show' : 'reply';
        };
        let st: ReturnType<typeof ScrollTrigger.create> | undefined;

        /* A story chip was picked (StoryChips): re-label everything, then glide the page through
           the story so the visitor watches it run. Motion off: just swap the still frame. */
        const onStory = (e: Event) => {
          const { id, replay } = (e as CustomEvent<{ id: StoryId; replay: boolean }>).detail;
          if (!isStoryId(id)) return;
          story.current = id;
          setStoryAttrs();
          Object.assign(lastRender, { chip: '', lines: -1, act: -1, screen: '' });
          if (reduced) { stillFrame(); return; }
          renderStory(tl.progress());
          if (!replay || !st) return;
          const target = st.start + 0.62 * (st.end - st.start);
          const l = lenisRef.current;
          if (l) {
            l.scrollTo(st.start, { immediate: true, force: true });
            l.scrollTo(target, { duration: 3.2, force: true, easing: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) });
          } else {
            window.scrollTo({ top: st.start });
            window.scrollTo({ top: target, behavior: 'smooth' });
          }
        };
        window.addEventListener(STORY_EVENT, onStory);

        if (reduced) {
          stillFrame();
        } else if (Number.isFinite(qa)) {
          // ?qa=<0..1> freezes the hero at one moment for review. Read in the browser so the
          // page itself stays static and CDN-cached.
          tl.progress(Math.min(1, Math.max(0, qa)));
        } else {
          renderStory(0);
          st = ScrollTrigger.create({
            trigger: heroSection, start: 'top top', end: L.end,
            pin: L.pin, scrub: 0.8, invalidateOnRefresh: true, animation: tl,
            onUpdate: (st) => {
              const d = document.getElementById('devAct');
              if (d) d.textContent = actLabel(st.progress);
            },
          });
        }
        /* Brand intro (Part A0): once per page load, by time, while the phone still shows the brand. */
        if (!reduced && !introPlayed && !Number.isFinite(qa) && tl.progress() < 0.08) {
          introPlayed = true;
          const q = gsap.utils.selector(screen);
          gsap.timeline({ defaults: { ease: 'power2.out' } })
            // children only: the layer itself belongs to the CSS screen states (an inline opacity
            // there would pin the brand over every story)
            .from(q('.brand-glow'), { opacity: 0, scale: 0.6, duration: 0.6 }, 0.1)
            .from(q('.brand-mark'), { y: -28, opacity: 0, duration: 0.45, ease: 'back.out(3)' }, 0.15)
            .fromTo(q('.brand-sparks .spark'), { opacity: 1, x: 0, y: 0 }, {
              opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false,
              x: (i: number) => [-30, -18, 4, 22, 30, -26][i % 6], y: (i: number) => [-16, -28, -32, -22, -4, 6][i % 6],
            }, 0.5)
            .fromTo(q('.brand-word'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power3.inOut' }, 0.55)
            .from(q('.brand-line'), { opacity: 0, y: 6, duration: 0.35 }, 0.95);
        }

        return () => { offPointer(); window.removeEventListener(STORY_EVENT, onStory); };
      },
    );
  }, { scope: root, dependencies: [motionOn, showcase] });

  return (
    <div className="stage-fit" ref={root}>
      {/* suppressHydrationWarning: FIT_NOW adds --fit to this style before React hydrates */}
      <div className="stage" ref={stage} style={STAGE_VARS} suppressHydrationWarning>
        <div className="rig" ref={rig}>
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
                  <span className="sparks" aria-hidden="true">{SPARKS.map((_, k) => <i className="spark" key={k} />)}</span>
                </li>
              ))}
            </ul>

            <div className="packet" style={CHIP_VARS} aria-hidden="true">
              <span>{STORIES[DEFAULT_STORY].steps[lastOf(LAYOUTS.desktop).id].chip}</span>
            </div>

            <div className="phone">
              <Image
                src="/hero/phone@2x.avif"
                alt=""
                width={1200}
                height={1653}
                priority
                sizes="(max-width: 767px) 62vw, 34vw"
              />
              <div className="screen" data-state={showcase ? 'show' : 'reply'} data-story={DEFAULT_STORY} aria-hidden="true">
                {/* first screen: our brand (Part A0) */}
                <div className="scr scr-brand">
                  <i className="brand-glow" />
                  <span className="brand-mark"><AnvilMark /><span className="brand-sparks">{[0, 1, 2, 3, 4, 5].map((k) => <i className="spark" key={k} />)}</span></span>
                  <span className="brand-word">Legit Forge</span>
                  <span className="brand-line">We build the thing.</span>
                </div>
                {/* one screen per story: start frame, then .on-ask, then .on-reply */}
                <div className="scr scr-site" data-for="web">
                  <div className="s-hero" />
                  <div className="s-row w80" />
                  <div className="s-row w60" />
                  <div className="s-grid"><div className="s-card" /><div className="s-card" /></div>
                  <div className="s-bar" />
                  <span className="s-speed on-ask"><b>99</b>speed</span>
                  <span className="s-toast on-reply">Enquiry sent ✓</span>
                </div>
                <div className="scr scr-app" data-for="app">
                  <p className="app-head">Book a table <span>Sat</span></p>
                  <p className="app-sub">Party of 4</p>
                  <div className="app-slots">
                    <span>6:30</span><span>7:00</span><span className="slot-pick on-ask">7:30</span><span>8:00</span>
                    <span>8:30</span><span>9:00</span>
                  </div>
                  <span className="app-cta">Confirm booking</span>
                  <span className="scr-stamp on-reply">Booked ✓</span>
                </div>
                <div className="scr scr-quote" data-for="quote">
                  <p className="q-head">Quote Q-2041</p>
                  <p className="q-row"><span>Split AC × 2</span><b>₹38,500</b></p>
                  <p className="q-row"><span>Copper kit</span><b>₹4,200</b></p>
                  <p className="q-row"><span>Stabiliser</span><b>₹3,100</b></p>
                  <p className="q-total"><span>Total</span><b>₹45,800</b></p>
                  <p className="q-status on-ask">Sent · opened 2×</p>
                  <span className="scr-stamp on-reply">Accepted</span>
                </div>
                <div className="scr scr-chat" data-for="wa">
                  <p className="chat-head"><i />Sweet Crumbs <span>online</span></p>
                  <p className="bub bub-out on-ask">Is my cake ready?</p>
                  <p className="bub bub-in on-reply">Yes! Ready at 5 pm. Order #214 <b>✓✓</b></p>
                </div>
                {showcase && (
                  <div className="scr scr-show">
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative, sized by the screen */}
                    <img src={showcase.image} alt="" loading="lazy" decoding="async" />
                    <span className="stamp stamp-hallmark">Live</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIT_NOW }} />
    </div>
  );
}
