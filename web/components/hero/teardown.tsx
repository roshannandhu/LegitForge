'use client';

/** The Teardown — PLAN §6.2c. The phone in the hand comes apart into five live glass layers
 *  (website, WhatsApp, n8n, quote, warranty) standing in an isometric exploded stack with
 *  technical-drawing callouts. Scrolling runs each layer's flow in turn while a pulse carries
 *  the customer down the stack, then everything snaps back into the phone.
 *
 *  Real 3D with no WebGL: each layer's position, tilt and scale are CSS variables
 *  (--x --y --tilt --s) that GSAP animates, so the no-JS frame is plain CSS and exact.
 *  One pinned, scrubbed timeline on every screen: tablets and laptops pin the hero, phones pin
 *  the stage (scaled to the phone's width, the callout column cropped; the layer being run is
 *  named in a caption). Motion off: the finished stack. Stop scrolling and it carries on by
 *  itself (idleJourney), and the phone in the hand mirrors the layer being run. */

import { useEffect, useRef } from 'react';
import { useLenis } from '@/lib/lenis-store';
import {
  DEFAULT_LEAD, DESIGN, FOCUS, PHONE_CROP, ISO_SCALE, LAYERS, LEAD_EVENT, PIN_END, RUN,
  SCREEN_C, SLOTS, actIndex, isLayerId, type LayerId,
} from '@/lib/teardown';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { markNearJs } from '@/lib/lite';
import { useGsap, type Gs } from '@/lib/gsap';
import { buildFlow } from './teardown-flows';

let introPlayed = false;

export default function TeardownMotion() {
  const motionOn = useMotionEnabled();
  const marker = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // point the refs at the server-rendered hero before any effect below runs
  useEffect(() => {
    root.current = marker.current!.closest<HTMLDivElement>('.stage-fit.td');
    stage.current = root.current!.querySelector<HTMLDivElement>('.td-stage');
  }, []);
  const trigger = useRef<Gs['ScrollTrigger']>(undefined);
  const lead = useRef<LayerId>(DEFAULT_LEAD);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;

  useEffect(() => {
    const stageEl = stage.current!;
    const box = stageEl.parentElement!;
    const phoneMq = matchMedia('(max-width: 767px)');
    const ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      const fit = phoneMq.matches ? r.width / PHONE_CROP : Math.min((r.width - 28) / DESIGN.w, r.height / DESIGN.h, 1.25);
      stageEl.style.setProperty('--fit', fit.toFixed(3));
      trigger.current?.refresh();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // phones: data-near marks a glass card as it nears the screen. Lite phones keep cards 3–7 out
  // of the first layout until then (hero.css). Plain observer: never waits for GSAP.
  useEffect(() => {
    markNearJs();
    const cards = [...root.current!.querySelectorAll<HTMLElement>('.td-layer')];
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      (en.target as HTMLElement).dataset.near = '';
      io.unobserve(en.target);
    }), { rootMargin: '200px 300px' });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  useGsap(({ gsap, ScrollTrigger }) => {
    trigger.current = ScrollTrigger;
    const host = root.current!;
    const hero = host.closest('section') as HTMLElement;
    const hud = hero.querySelector<HTMLElement>('.hud');
    const logLines = hud ? [...hud.querySelectorAll<HTMLElement>('.hud-log li')] : [];
    const screen = host.querySelector<HTMLElement>('.td-screen')!;
    const layers = LAYERS.map((l) => host.querySelector<HTMLElement>(`[data-layer="${l.id}"]`)!);
    const callouts = [...host.querySelectorAll<HTMLElement>('.td-callouts li')];
    const pulse = host.querySelector<HTMLElement>('.td-pulse')!;
    const reduced = !motionOn;
    const params = new URLSearchParams(location.search);
    const first = hero.dataset.lead ?? params.get('lead');
    if (isLayerId(first)) lead.current = first;

    const setLead = () => { screen.dataset.lead = lead.current; };
    const setScreen = (state: string) => { if (screen.dataset.state !== state) screen.dataset.state = state; };
    const showLog = (visible: Set<string>) => logLines.forEach((li) => { li.hidden = !visible.has(li.dataset.step!); });
    const setAct = (a: number) => { if (hud) hud.dataset.act = String(a); };
    setLead();
    if (hud) hud.dataset.live = '1';
    screen.dataset.live = '1';

    // the wordmark, letter by letter (once per page load), after the Hallmark Strike if it plays
    const introWait = document.documentElement.dataset.intro ? (innerWidth < 768 ? 1.3 : 1.65) : 0;
    if (!reduced && !introPlayed && window.scrollY < 40) {
      introPlayed = true;
      gsap.from(screen.querySelectorAll('.td-word span'), { opacity: 0, y: 14, filter: 'blur(4px)', duration: 0.5, stagger: 0.06, ease: 'power3.out', delay: 0.15 + introWait });
    }

    const mm = gsap.matchMedia();

    /* ---------------------------------------------------- every screen: one scrubbed timeline
       Tablets and laptops pin the whole hero; phones pin the stage in the middle of the screen
       (the copy above it has scrolled by), so the same teardown plays there too. */
    mm.add({ wide: '(min-width: 768px)', phone: '(max-width: 767px)' }, (mctx) => {
      const onPhone = !!mctx.conditions?.phone;
      if (reduced) {                                        // the finished stack, told in one frame
        layers.forEach((l) => l.setAttribute('data-lit', ''));
        setScreen('final'); setAct(2);
        showLog(new Set([...LAYERS.map((l) => l.id), 'done']));
        return;
      }
      const win = (i: number) => RUN.start + i * RUN.each;
      const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
      gsap.set(layers, { '--x': SCREEN_C.x, '--y': SCREEN_C.y, '--tilt': 0, '--s': 1, '--dim': 1, opacity: 0 });
      gsap.set(pulse, { opacity: 0 });

      // 1 — tear down: the top layer lifts first and travels furthest
      layers.forEach((el, i) => {
        const at = 0.03 + i * 0.024;
        tl.to(el, { opacity: 1, duration: 0.015 }, at)
          .to(el, { '--x': SLOTS[i].x, '--y': SLOTS[i].y, '--tilt': 1, '--s': ISO_SCALE, duration: 0.1, ease: 'power2.out' }, at);
      });

      const drawing = [host.querySelector('.td-callouts'), host.querySelector('.td-leaders')];
      gsap.set(drawing, { opacity: 0 });
      tl.to(drawing, { opacity: 1, duration: 0.08 }, 0.12).to(drawing, { opacity: 0, duration: 0.04 }, 0.855);

      // 2 — run: each layer comes forward, plays, goes back; the pulse carries the result down
      layers.forEach((el, i) => {
        const w0 = win(i), E = RUN.each;                                 // each window, in fractions of E
        const others = layers.filter((_, k) => k !== i);
        tl.set(el, { zIndex: 30 }, w0).set(el, { zIndex: 10 - i }, w0 + E * 0.98)   // the reader's layer is in front
          .to(others, { '--dim': 0.4, duration: E * 0.13 }, w0)
          .to(el, { '--dim': 1, '--x': FOCUS.x, '--y': FOCUS.y, '--tilt': 0, '--s': FOCUS.s, duration: E * 0.22, ease: 'power2.inOut' }, w0);
        const flow = buildFlow(LAYERS[i].id, el, gsap);
        flow.timeScale(flow.duration() / (E * 0.565));
        tl.add(flow, w0 + E * 0.22);
        tl.to(el, { '--x': SLOTS[i].x, '--y': SLOTS[i].y, '--tilt': 1, '--s': ISO_SCALE, duration: E * 0.17, ease: 'power2.inOut' }, w0 + E * 0.81);
        const to = SLOTS[i + 1] ?? SCREEN_C;
        tl.fromTo(pulse, { '--px': SLOTS[i].x, '--py': SLOTS[i].y, opacity: 1 },
          { '--px': to.x, '--py': to.y, duration: E * 0.17, ease: 'power1.inOut', immediateRender: false }, w0 + E * 0.81)
          .to(pulse, { opacity: 0, duration: E * 0.035 }, w0 + E * 0.98);
      });
      tl.to(layers, { '--dim': 1, duration: 0.01 }, win(LAYERS.length));

      // 3 — snap back: nearest first, into the screen
      [...layers].reverse().forEach((el, k) => {
        const at = 0.86 + k * 0.012;
        tl.to(el, { '--x': SCREEN_C.x, '--y': SCREEN_C.y, '--tilt': 0, '--s': 1, duration: 0.05, ease: 'power2.in' }, at)
          .to(el, { opacity: 0, duration: 0.012 }, at + 0.045);
      });
      tl.to(hero, { '--heat': 0.78, duration: 0.02 }, 0.95).to(hero, { '--heat': 0.35, duration: 0.04 }, 0.97);

      // states that are not tweens: screen, focused callout, log, act rail
      const render = () => {
        const p = tl.progress();
        const focus = LAYERS.findIndex((_, i) => p >= win(i) && p < win(i) + RUN.each);
        // the phone in the hand mirrors the layer being run, so it is never an empty black slab
        const mirror = focus >= 0 && p < 0.95;
        screen.dataset.lead = mirror ? LAYERS[focus].id : lead.current;
        setScreen(p < 0.02 ? 'brand' : mirror ? 'final' : p < 0.95 ? 'dark' : 'final');
        callouts.forEach((c, i) => c.toggleAttribute('data-active', i === focus));
        layers.forEach((l, i) => l.toggleAttribute('data-lit', p >= win(i) && p < 0.86));   // the customer's request has reached it
        const ran = LAYERS.filter((_, i) => p >= win(i) + 0.03).map((l) => l.id);
        showLog(new Set([...ran, ...(p >= 0.95 ? ['done'] : []), ...(ran.length ? [] : ['wait'])]));
        setAct(actIndex(p) + 1);
      };
      tl.eventCallback('onUpdate', render);

      let st: ReturnType<typeof ScrollTrigger.create> | undefined;
      const qa = Number(params.get('qa') ?? NaN);
      if (Number.isFinite(qa)) tl.progress(Math.min(1, Math.max(0, qa)));
      else {
        render();
        st = ScrollTrigger.create(onPhone
          ? { trigger: host, start: 'center center', end: '+=240%', pin: true, scrub: 0.8, invalidateOnRefresh: true, animation: tl }
          : { trigger: hero, start: 'top top', end: PIN_END, pin: true, scrub: 0.8, invalidateOnRefresh: true, animation: tl });
      }
      const stopIdle = st ? idleJourney(st, win, tl) : () => {};

      // a chip was picked: that layer leads (the phone ends on it) and the page glides to it
      const onLead = (e: Event) => {
        const { id, replay } = (e as CustomEvent<{ id: LayerId; replay: boolean }>).detail;
        if (!isLayerId(id)) return;
        lead.current = id; setLead();
        if (!replay || !st) return;
        const i = LAYERS.findIndex((l) => l.id === id);
        const y = st.start + (win(i) + 0.07) * (st.end - st.start);
        const l = lenisRef.current;
        if (l) l.scrollTo(y, { duration: 2.4, force: true }); else window.scrollTo({ top: y, behavior: 'smooth' });
      };
      window.addEventListener(LEAD_EVENT, onLead);
      return () => { window.removeEventListener(LEAD_EVENT, onLead); stopIdle(); };
    });

    /** Scroll leads; stop and it carries on by itself (tablet and desktop). Once the reader has
     *  torn the phone down and then leaves the wheel alone for IDLE ms inside the pin, the page
     *  glides on through the run at a reading pace, so every layer plays exactly as if scrolled
     *  (it IS the scrolled timeline). After NFC it rewinds to SEO and goes again. Any wheel,
     *  touch, key or click hands control straight back. Only while the hero is pinned. */
    function idleJourney(st: ReturnType<typeof ScrollTrigger.create>, win: (i: number) => number, tl: gsap.core.Timeline) {
      const IDLE = 1600, PER_LAYER = 4.2;                              // seconds of glide per layer
      let timer = 0, raf = 0, last = 0, pauseUntil = 0;
      const y = (p: number) => st.start + p * (st.end - st.start);
      const scrollTo = (to: number, duration = 0) => {
        const l = lenisRef.current;
        if (l) l.scrollTo(to, duration ? { duration, force: true } : { immediate: true, force: true });
        else window.scrollTo({ top: to, behavior: duration ? 'smooth' : 'instant' });
      };
      const stop = () => { cancelAnimationFrame(raf); raf = 0; };
      const step = (t: number) => {
        raf = requestAnimationFrame(step);
        const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
        if (t < pauseUntil || !st.isActive) return;
        const from = y(win(0) - 0.02), to = y(win(LAYERS.length));
        const cur = window.scrollY;
        if (cur >= to) { scrollTo(from, 1.6); pauseUntil = t + 2400; return; }   // rewind, then again
        scrollTo(Math.max(cur, from - 1) + ((to - from) / (LAYERS.length * PER_LAYER)) * dt);
      };
      const arm = () => {
        clearTimeout(timer); stop();
        timer = window.setTimeout(() => {
          // only after the reader has torn it down themselves, and never past the run
          if (!st.isActive || tl.progress() < 0.12 || tl.progress() > win(LAYERS.length)) return;
          last = 0; pauseUntil = 0; raf = requestAnimationFrame(step);
        }, IDLE);
      };
      const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
      events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
      return () => { clearTimeout(timer); stop(); events.forEach((e) => window.removeEventListener(e, arm)); };
    }

  }, { scope: root, dependencies: [motionOn] });

  // the markup is a Server Component (teardown-view.tsx): this is only the motion, attached to
  // it through the marker, so the hero's ~350 nodes never have to hydrate
  return <span ref={marker} hidden />;
}
