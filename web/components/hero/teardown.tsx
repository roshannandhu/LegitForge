'use client';

/** The Teardown — PLAN §6.2c. The phone in the hand comes apart into five live glass layers
 *  (website, WhatsApp, n8n, quote, warranty) standing in an isometric exploded stack with
 *  technical-drawing callouts. Scrolling runs each layer's flow in turn while a pulse carries
 *  the customer down the stack, then everything snaps back into the phone.
 *
 *  Real 3D with no WebGL: each layer's position, tilt and scale are CSS variables
 *  (--x --y --tilt --s) that GSAP animates, so the no-JS frame is plain CSS and exact.
 *  Tablet and desktop: one pinned, scrubbed timeline. Phones: no pin; the layers are a swipe
 *  row under the phone and each plays when it is in view. Motion off: the finished stack. */

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useLenis } from 'lenis/react';
import {
  CALLOUTS, CALLOUT_W, DEFAULT_LEAD, DESIGN, FOCUS, ISO_SCALE, LAYERS, LEAD_EVENT, PHONE, PIN_END, RUN,
  SCREEN, SCREEN_C, SLOTS, actIndex, isLayerId, type LayerId,
} from '@/lib/teardown';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { useGsap, type Gs } from '@/lib/gsap';
import { LayerScreen } from './layer-screens';
import { buildFlow } from './teardown-flows';

const STAGE_VARS = {
  '--dw': `${DESIGN.w}px`, '--dh': `${DESIGN.h}px`,
  '--phone-w': `${PHONE.w}px`, '--phone-x': `${PHONE.cx}px`, '--phone-y': `${PHONE.cy}px`,
  '--scr-w': `${SCREEN.w}px`, '--scr-h': `${SCREEN.h}px`,
  '--iso-s': ISO_SCALE,
} as unknown as React.CSSProperties;

/** Sets --fit during parsing (tablet and up), so the stage never visibly rescales at hydration.
 *  Keep in step with the resize effect below. */
const FIT_NOW = `(function(s){if(matchMedia('(max-width: 767px)').matches)return;var b=s.parentElement.getBoundingClientRect();` +
  `if(b.width)s.style.setProperty('--fit',Math.min((b.width-28)/${DESIGN.w},b.height/${DESIGN.h},1.25).toFixed(3))})` +
  `(document.currentScript.previousElementSibling)`;

const WORD = 'Legit Forge';
let introPlayed = false;

export default function Teardown() {
  const motionOn = useMotionEnabled();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
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
      if (phoneMq.matches) { stageEl.style.removeProperty('--fit'); return; }
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      stageEl.style.setProperty('--fit', Math.min((r.width - 28) / DESIGN.w, r.height / DESIGN.h, 1.25).toFixed(3));
      trigger.current?.refresh();
    });
    ro.observe(box);
    return () => ro.disconnect();
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

    /* ---------------------------------------------------- tablet and desktop */
    mm.add('(min-width: 768px)', () => {
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
        setScreen(p < 0.02 ? 'brand' : p < 0.95 ? 'dark' : 'final');
        const focus = LAYERS.findIndex((_, i) => p >= win(i) && p < win(i) + RUN.each);
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
        st = ScrollTrigger.create({ trigger: hero, start: 'top top', end: PIN_END, pin: true, scrub: 0.8, invalidateOnRefresh: true, animation: tl });
      }

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
      return () => window.removeEventListener(LEAD_EVENT, onLead);
    });

    /* ---------------------------------------------------- phones: a swipe row */
    mm.add('(max-width: 767px)', () => {
      const onLead = (e: Event) => {
        const { id, replay } = (e as CustomEvent<{ id: LayerId; replay: boolean }>).detail;
        if (!isLayerId(id)) return;
        lead.current = id; setLead();
        if (replay) layers[LAYERS.findIndex((l) => l.id === id)]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      };
      window.addEventListener(LEAD_EVENT, onLead);
      if (reduced) {
        setScreen('final'); setAct(2);
        showLog(new Set([...LAYERS.map((l) => l.id), 'done']));
        return () => window.removeEventListener(LEAD_EVENT, onLead);
      }
      setScreen('brand');
      const toFinal = gsap.delayedCall(2.2 + introWait, () => setScreen('final'));
      const ran = new Set<string>(['wait']);
      showLog(ran); setAct(1);
      // each card's flow is built as it nears the screen (its start state set off screen), not
      // all seven at load: that was one of a budget phone's longest load tasks
      const flows: (ReturnType<typeof buildFlow> | undefined)[] = [];
      const build = (i: number) => (flows[i] ??= buildFlow(LAYERS[i].id, layers[i], gsap).pause(0));
      const near = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        build(layers.indexOf(en.target as HTMLElement));
        near.unobserve(en.target);
      }), { rootMargin: '200px 300px' });
      layers.forEach((el) => near.observe(el));
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const i = layers.indexOf(en.target as HTMLElement);
        build(i).play(0);
        layers[i].setAttribute('data-lit', '');
        io.unobserve(en.target);
        ran.delete('wait'); ran.add(LAYERS[i].id);
        if (LAYERS.every((l) => ran.has(l.id))) ran.add('done');
        showLog(ran); setAct(ran.has('done') ? 3 : 2);
      }), { threshold: 0.6 });
      layers.forEach((el) => io.observe(el));
      return () => { near.disconnect(); io.disconnect(); toFinal.kill(); window.removeEventListener(LEAD_EVENT, onLead); flows.forEach((f) => f?.progress(1)); };
    });
  }, { scope: root, dependencies: [motionOn] });

  return (
    <div className="stage-fit td" ref={root}>
      {/* suppressHydrationWarning: FIT_NOW adds --fit to this style before React hydrates */}
      <div className="stage td-stage" ref={stage} style={STAGE_VARS} suppressHydrationWarning>
        {/* leader lines and callouts: the technical-drawing layer (tablet and up) */}
        <svg className="td-leaders" viewBox={`0 0 ${DESIGN.w} ${DESIGN.h}`} aria-hidden="true">
          {SLOTS.map((s, i) => (
            <path key={i} d={`M${CALLOUTS[i].x + CALLOUT_W + 8} ${CALLOUTS[i].y + 11} L${s.x - 96} ${s.y}`} />
          ))}
        </svg>
        <ol className="td-callouts" style={{ '--cw': `${CALLOUT_W}px` } as React.CSSProperties}>
          {LAYERS.map((l, i) => (
            <li key={l.id} style={{ '--cx': `${CALLOUTS[i].x}px`, '--cy': `${CALLOUTS[i].y}px` } as React.CSSProperties}>
              <span className="num">{l.num}</span> <strong>{l.name}</strong> <em>{l.spec}</em>
            </li>
          ))}
        </ol>

        <div className="td-phone">
          <Image src="/hero/phone@2x.avif" alt="" width={1200} height={1653} priority sizes="(max-width: 767px) 62vw, 30vw" />
          <div className="td-screen" data-state="final" data-lead={DEFAULT_LEAD} aria-hidden="true">
            <p className="td-word">{[...WORD].map((c, i) => <span key={i}>{c === ' ' ? ' ' : c}</span>)}</p>
            {LAYERS.map((l) => <div key={l.id} className="td-final" data-for={l.id}><LayerScreen id={l.id} /></div>)}
          </div>
        </div>

        <ul className="td-layers" aria-label="What happens inside the phone">
          {LAYERS.map((l, i) => (
            <li
              key={l.id}
              className="td-layer"
              data-layer={l.id}
              style={{ '--sx': SLOTS[i].x, '--sy': SLOTS[i].y, zIndex: 10 - i } as React.CSSProperties}
            >
              <div className="td-glass"><LayerScreen id={l.id} /></div>
              <p className="td-cap"><span className="num">{l.num}</span> {l.name}</p>
            </li>
          ))}
        </ul>
        <span className="td-pulse" aria-hidden="true" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIT_NOW }} />
    </div>
  );
}
