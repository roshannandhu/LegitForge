'use client';

/** The Teardown — PLAN §6.2c. The phone in the hand comes apart into seven live glass layers
 *  standing in an isometric exploded stack with technical-drawing callouts. The teardown plays
 *  by itself, on a loop (the owner's call, 27 Sep: no scroll animation, nothing pins): it comes
 *  apart, each layer comes forward and runs its flow while a pulse carries the customer down
 *  the stack, everything snaps back into the phone, a short hold, then again.
 *
 *  Real 3D with no WebGL: each layer's position, tilt and scale are CSS variables
 *  (--x --y --tilt --s) that GSAP animates, so the no-JS frame is plain CSS and exact.
 *  One timeline (tl, in fractions of the story) played by a clock (driver). Phones show the
 *  stage scaled to their width, the callout column cropped, the running layer named in a
 *  caption. It runs only while the hero is on screen and the tab is visible. Motion off: the
 *  finished stack. A chip jumps the loop to its layer; the phone in the hand mirrors the layer
 *  being run. */

import { useEffect, useRef } from 'react';
import {
  CROP_MQ, DEFAULT_LEAD, DESIGN, FOCUS, PHONE_CROP, ISO_SCALE, LAYERS, LEAD_EVENT, RUN,
  SCREEN_C, SLOTS, actIndex, isLayerId, type LayerId,
} from '@/lib/teardown';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { markNearJs } from '@/lib/lite';
import { schedule, useGsap, type Gs } from '@/lib/gsap';
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

  useEffect(() => {
    const stageEl = stage.current!;
    const box = stageEl.parentElement!;
    const phoneMq = matchMedia(CROP_MQ);
    const ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      const fit = phoneMq.matches ? Math.min(r.width / PHONE_CROP, r.height / DESIGN.h) : Math.min((r.width - 28) / DESIGN.w, r.height / DESIGN.h, 1.25);
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

    /* ---------------------------------------------------- every screen: one timeline, on a clock
       (matchMedia: rebuilt when the phone crop starts or stops applying) */
    mm.add({ wide: '(min-width: 768px)', phone: '(max-width: 767px)' }, () => {
      let dead = false;
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
        // each layer's flow is built in its own task (seven at once was one long task on a
        // 2 GB tablet), and joins the timeline long before the reader scrolls to its window
        schedule(() => {
          if (dead) return;
          const flow = buildFlow(LAYERS[i].id, el, gsap);
          flow.timeScale(flow.duration() / (E * 0.565));
          tl.add(flow, w0 + E * 0.22);
          tl.totalTime(tl.totalTime(), true);                              // render it at the current scroll
        });
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

      /* the clock: tear down, 4.2 s per layer, snap back, hold, again. It drives tl's progress,
         so every tween and flow plays exactly as the scrubbed timeline did. */
      const PER_LAYER = 4.2;
      const o = { p: 0 };
      const driver = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4, onUpdate: () => { tl.progress(o.p); } });
      driver.to(o, { p: RUN.start, duration: 2.8, ease: 'none' });
      LAYERS.forEach((_, i) => driver.addLabel(`l${i}`).to(o, { p: win(i + 1), duration: PER_LAYER, ease: 'none' }));
      driver.to(o, { p: 1, duration: 2.6, ease: 'none' });

      let onScreen = true, started = false;
      const sync = () => { if (started && onScreen && !document.hidden) driver.play(); else driver.pause(); };
      const vis = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
      const qa = Number(params.get('qa') ?? NaN);
      if (Number.isFinite(qa)) tl.progress(Math.min(1, Math.max(0, qa)));
      else {
        render();
        vis.observe(host);
        document.addEventListener('visibilitychange', sync);
        // after the wordmark (and the Hallmark Strike, if it plays): the stack comes apart
        gsap.delayedCall(introWait + 1.6, () => { started = true; sync(); });
      }

      // warm the seven glass layers while the page is idle: each is shown at a near-zero opacity
      // for a frame, so the browser builds and paints its layer now, not on the first scroll
      // into the teardown (that first frame was a 168 ms hitch on a real 2 GB tablet)
      const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
      const warm = (k: number) => {
        if (dead || k >= layers.length || tl.progress() > 0.02) return;
        const el = layers[k];
        el.style.opacity = '0.002';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (el.style.opacity === '0.002') el.style.opacity = '0';
          idle(() => warm(k + 1));
        }));
      };
      idle(() => warm(0));

      // a chip was picked: that layer leads (the phone ends on it) and the loop jumps to it
      const onLead = (e: Event) => {
        const { id, replay } = (e as CustomEvent<{ id: LayerId; replay: boolean }>).detail;
        if (!isLayerId(id)) return;
        lead.current = id; setLead();
        if (!replay || !started) return;
        driver.seek(`l${LAYERS.findIndex((l) => l.id === id)}`);
        sync();
      };
      window.addEventListener(LEAD_EVENT, onLead);
      return () => { dead = true; window.removeEventListener(LEAD_EVENT, onLead); vis.disconnect(); document.removeEventListener('visibilitychange', sync); driver.kill(); };
    });


  }, { scope: root, dependencies: [motionOn] });

  // the markup is a Server Component (teardown-view.tsx): this is only the motion, attached to
  // it through the marker, so the hero's ~350 nodes never have to hydrate
  return <span ref={marker} hidden />;
}
