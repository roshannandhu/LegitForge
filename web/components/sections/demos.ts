/** Working-flow demo timelines (plan "every service tells its own story", PLAN §6.3, §6.3b).
 *  Rule: the markup is the FINAL frame. Each builder animates FROM a start state, so a
 *  reverted timeline (motion switched off) lands back on the finished demo. Text that changes
 *  during a demo is restored by the timeline's last call. Each runs in about 4 s or less. */

import type { gsap as Gsap } from 'gsap';

type G = typeof Gsap;
type TL = ReturnType<G['timeline']>;
export type DemoId = 'website' | 'app' | 'whatsapp' | 'n8n' | 'quote';

const $ = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel);
const $$ = (root: Element, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];

/** Count a number up into an element's text; formats like the final text (suffix, decimals). */
function countUp(tl: TL, el: HTMLElement | null, at: number, dur = 0.9, fmt?: (v: number) => string) {
  if (!el) return;
  const end = Number(el.dataset.count ?? el.textContent?.replace(/[^\d.]/g, ''));
  const dp = Number(el.dataset.dp ?? 0);
  const suffix = el.dataset.suffix ?? '';
  const final = el.textContent;
  const show = fmt ?? ((v: number) => v.toFixed(dp) + suffix);
  const o = { v: 0 };
  el.textContent = show(0);
  tl.to(o, { v: end, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = show(o.v); } }, at)
    .call(() => { el.textContent = final; }, [], at + dur);
}

/* 1 — website: wireframe -> styled, a click, speed 99, then it turns dynamic */
function website(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const tag = $(root, '.demo-tag'), badge = $(root, '.bp-badge');
  const ring = root.querySelector<SVGCircleElement>('.ring-fill');
  if (tag) tag.textContent = 'Static';
  if (badge) badge.textContent = '3 tables free';

  tl.from($(root, '.browser-page'), { filter: 'grayscale(1) brightness(.75)', duration: 0.6 }, 0.5)
    .from($$(root, '.bp-nav span, .bp-h, .bp-t, .bp-btn'), { opacity: 0, scaleX: 0.4, transformOrigin: 'left center', duration: 0.35, stagger: 0.04 }, 0)
    .from($(root, '.bp-img'), { opacity: 0, y: 14, duration: 0.45 }, 0.25)
    .from($$(root, '.bp-cards span'), { opacity: 0, y: 10, duration: 0.3, stagger: 0.06 }, 0.4)
    // a visitor arrives and clicks the button
    .from($(root, '.demo-cursor'), { x: 90, y: 70, opacity: 0, duration: 0.6, ease: 'power3.inOut' }, 0.9)
    .fromTo($(root, '.demo-ripple'), { scale: 0, opacity: 0.8 }, { scale: 2.4, opacity: 0, duration: 0.45, immediateRender: false }, 1.5)
    .to($(root, '.bp-btn'), { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1 }, 1.5)
    // speed: the ring fills and the score counts to 99
    .from($(root, '.speed-ring'), { scale: 0.6, opacity: 0, duration: 0.35, ease: 'back.out(2)' }, 1.7);
  if (ring) tl.from(ring, { strokeDashoffset: Number(ring.getAttribute('strokeDasharray') ?? ring.getAttribute('stroke-dasharray')), duration: 0.9 }, 1.8);
  countUp(tl, $(root, '.ring-num'), 1.8, 0.9);
  // dynamic: the tag flips and the live badge changes on its own
  tl.call(() => { if (tag) tag.textContent = 'Dynamic'; }, [], 2.8)
    .fromTo(tag, { scale: 1.2 }, { scale: 1, duration: 0.3, immediateRender: false }, 2.8)
    .from(badge, { opacity: 0, y: 6, duration: 0.3 }, 2.7)
    .call(() => { if (badge) badge.textContent = '2 tables free'; }, [], 3.3)
    .fromTo(badge, { scale: 1.15 }, { scale: 1, duration: 0.3, immediateRender: false }, 3.3);
  return tl;
}

/* 2 — dashboard: chart draws, totals count, a booking arrives from WhatsApp */
function app(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const line = root.querySelector<SVGPathElement>('.chart-line');
  if (line) {
    const len = line.getTotalLength();
    tl.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut' }, 0.1)
      .call(() => { line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''; }, [], 1.25);
  }
  tl.from($(root, '.chart-area'), { opacity: 0, duration: 0.6 }, 0.7);
  $$(root, '.dash-stats .v').forEach((v, i) => countUp(tl, v, 0.2 + i * 0.12, 1));
  tl.from($$(root, '.dash-table .row:not(.new)'), { opacity: 0, y: 6, duration: 0.3, stagger: 0.08 }, 0.3)
    .from($(root, '.dash-table .row.new'), { opacity: 0, y: -14, duration: 0.45, ease: 'back.out(2)' }, 1.9)
    .fromTo($(root, '.dash-table .row.new'), { scale: 1.04 }, { scale: 1, duration: 0.5, immediateRender: false }, 2.3)
    .from($(root, '.dash-toast'), { opacity: 0, y: 16, duration: 0.4 }, 2.0);
  return tl;
}

/* 3 — WhatsApp: question, typing, answer, a tap, confirmation, read */
function whatsapp(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const [q, a, tapBack, done] = $$(root, '.msg');
  const typing = $$(root, '.wa-typing');
  const quick = $(root, '.wa-quick'), tapped = $(root, '.wa-quick .tapped'), ticks = $(root, '.wa-ticks');
  tapped?.classList.remove('tapped');
  ticks?.classList.remove('read');
  const type = (el: HTMLElement | undefined, at: number, dur: number) => {
    if (!el) return;
    tl.set(el, { display: 'flex' }, at)
      .fromTo(el.children, { opacity: 0.25 }, { opacity: 1, duration: 0.2, stagger: 0.1, repeat: 2, yoyo: true, immediateRender: false }, at)
      .set(el, { display: 'none' }, at + dur);
  };
  tl.set([q, a, quick, tapBack, done], { opacity: 0, y: 10 }, 0);   // hidden until their turn (a set, not a from: from() would snap back)
  tl.to(q, { opacity: 1, y: 0, duration: 0.3 }, 0.2);
  type(typing[0], 0.55, 0.7);
  tl.to(a, { opacity: 1, y: 0, duration: 0.3 }, 1.25)
    .to(quick, { opacity: 1, y: 0, duration: 0.3 }, 1.5)
    .call(() => tapped?.classList.add('tapped'), [], 2.0)
    .fromTo(tapped, { scale: 0.9 }, { scale: 1, duration: 0.2, immediateRender: false }, 2.0)
    .to(tapBack, { opacity: 1, y: 0, duration: 0.3 }, 2.15);
  type(typing[1], 2.45, 0.6);
  tl.to(done, { opacity: 1, y: 0, duration: 0.3 }, 3.05)
    .call(() => ticks?.classList.add('read'), [], 3.5);
  return tl;
}

/* 4 — n8n: one entry travels the workflow and every node reports what it did */
function n8n(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const flow = $(root, '.flow')!;
  const checks = $$(root, '.flow-check'), outs = $$(root, '.flow-out');
  const span = () => flow.offsetWidth * 0.8;                       // wire: 10 % -> 90 %
  const hop = 0.55;
  tl.from($(root, '.flow-wire'), { scaleX: 0, transformOrigin: 'left center', duration: hop * 4, ease: 'none' }, 0.35)
    .set(checks, { scale: 0.7, opacity: 0.35 }, 0)                   // unlit until the packet arrives
    .set(outs, { opacity: 0, y: -4 }, 0)
    .fromTo($(root, '.flow-packet'), { x: 0, opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: true }, 0.15)
    .to($(root, '.flow-packet'), { x: () => span(), duration: hop * 4, ease: 'none' }, 0.35)
    .to($(root, '.flow-packet'), { opacity: 0, duration: 0.2 }, 0.35 + hop * 4);
  checks.forEach((c, i) => {
    const at = 0.3 + i * hop;
    tl.to(c, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' }, at)
      .to(outs[i], { opacity: 1, y: 0, duration: 0.25 }, at + 0.1);
  });
  return tl;
}

/* 5 — quotation and warranty: a quote builds, is opened and accepted; the warranty is scanned
       and valid; the reminder goes out on WhatsApp */
function quote(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const meta = $(root, '.qm-meta');
  const finalMeta = meta?.textContent ?? '';
  const [accepted, valid] = $$(root, '.qm-head .stamp');
  if (meta) meta.textContent = 'Draft';
  tl.from($$(root, '.qm-lines li'), { opacity: 0, x: -12, duration: 0.3, stagger: 0.18 }, 0.2);
  countUp(tl, $(root, '.qm-total span:last-child'), 0.4, 0.9, (v) => `₹${Math.round(v).toLocaleString('en-IN')}`);
  tl.call(() => { if (meta) meta.textContent = 'Sent as a link'; }, [], 1.35)
    .call(() => { if (meta) meta.textContent = 'Opened twice'; }, [], 1.75)
    .call(() => { if (meta) meta.textContent = finalMeta; }, [], 2.1)
    .fromTo(accepted, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.in', immediateRender: true }, 2.1)
    .from($(root, '.qm-link'), { scaleY: 0, transformOrigin: 'top center', duration: 0.4 }, 2.35)
    .from($(root, '.qm-warranty'), { opacity: 0, y: 14, duration: 0.4 }, 2.55)
    .fromTo($(root, '.qm-scan'), { yPercent: 0, opacity: 0 }, { opacity: 1, duration: 0.1, immediateRender: true }, 2.85)
    .to($(root, '.qm-scan'), { top: 'auto', y: () => ($(root, '.qm-warranty')?.offsetHeight ?? 160) - 4, duration: 0.5, ease: 'power1.inOut' }, 2.85)
    .to($(root, '.qm-scan'), { opacity: 0, duration: 0.15 }, 3.35)
    .fromTo(valid, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.in', immediateRender: true }, 3.35)
    .from($(root, '.qm-remind'), { opacity: 0, y: 10, duration: 0.35, ease: 'back.out(2)' }, 3.6);
  return tl;
}

export const DEMOS: Record<DemoId, (root: Element, gsap: G) => TL> = { website, app, whatsapp, n8n, quote };
