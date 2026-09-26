/** Working-flow demo timelines (plan "every service tells its own story", PLAN §6.3, §6.3b).
 *  Rule: the markup is the FINAL frame. Each builder animates FROM a start state, so a
 *  reverted timeline (motion switched off) lands back on the finished demo. Text that changes
 *  during a demo is restored by the timeline's last call. Each runs in about 4 s or less. */

import type { gsap as Gsap } from 'gsap';

type G = typeof Gsap;
type TL = ReturnType<G['timeline']>;
export type DemoId = 'website' | 'app' | 'whatsapp' | 'n8n' | 'quote' | 'seo' | 'nfc';

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
  const vertical = flow.offsetWidth < 480;                          // phones: top to bottom (sections.css)
  const span = () => (vertical ? flow.offsetHeight - 44 : flow.offsetWidth * 0.8);   // along the wire
  const hop = 0.55;
  tl.from($(root, '.flow-wire'), vertical
      ? { scaleY: 0, transformOrigin: 'center top', duration: hop * 4, ease: 'none' }
      : { scaleX: 0, transformOrigin: 'left center', duration: hop * 4, ease: 'none' }, 0.35)
    .set(checks, { scale: 0.7, opacity: 0.35 }, 0)                   // unlit until the packet arrives
    .set(outs, { opacity: 0, y: -4 }, 0)
    .fromTo($(root, '.flow-packet'), { x: 0, opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: true }, 0.15)
    .to($(root, '.flow-packet'), { [vertical ? 'y' : 'x']: () => span(), duration: hop * 4, ease: 'none' }, 0.35)
    .to($(root, '.flow-packet'), { opacity: 0, duration: 0.2 }, 0.35 + hop * 4);
  checks.forEach((c, i) => {
    const at = 0.3 + i * hop;
    tl.to(c, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3)' }, at)
      .to(outs[i], { opacity: 1, y: 0, duration: 0.25 }, at + 0.1);
  });
  return tl;
}

/* 5 — quotation lifecycle: the rail fills, the card settles, the example stats count up.
       The lifecycle itself (enquiry → reminder, then the next job) is its flow, below. */
function quote(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  tl.fromTo($(root, '.qx-fill'), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power1.inOut', immediateRender: true }, 0.1)
    .from($$(root, '.qx-rail li'), { opacity: 0, y: 6, duration: 0.3, stagger: 0.08 }, 0)
    .from($(root, '.qm-bubble'), { opacity: 0, y: 10, scale: 0.9, transformOrigin: 'right bottom', duration: 0.3, ease: 'back.out(2)' }, 0.3)
    .from($(root, '.qx-card'), { opacity: 0, y: 24, rotateX: 12, duration: 0.6, ease: 'power3.out' }, 0.5)
    .fromTo($(root, '.qx-sign'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power1.inOut', immediateRender: true }, 1.0)
    .fromTo($(root, '.qm-seal'), { opacity: 0, scale: 1.12, rotate: -30 }, { opacity: 1, scale: 1, rotate: -12, duration: 0.32, ease: 'power4.in', immediateRender: true }, 1.7)
    .from($(root, '.qm-remind'), { opacity: 0, y: 10, duration: 0.35 }, 2.0)
    .from($$(root, '.qx-stats div'), { opacity: 0, y: 8, duration: 0.3, stagger: 0.08 }, 2.1);
  countUp(tl, $(root, '.qx-count'), 2.2, 0.9);
  return tl;
}

/* 6 — SEO: the query types, the business climbs from third to the top, clicks and calls count */
function seo(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const q = $(root, '.serp-q'), items = $$(root, '.serp-item'), you = items[0];
  const text = q?.textContent ?? '';
  const step = items[1] ? items[1].offsetTop - items[0].offsetTop : 0;
  if (q) q.textContent = '';
  const o = { n: 0 };
  tl.to(o, { n: text.length, duration: 0.7, ease: 'none', onUpdate: () => { if (q) q.textContent = text.slice(0, Math.round(o.n)); } }, 0.1)
    .call(() => { if (q) q.textContent = text; }, [], 0.8)
    .from(items, { opacity: 0, y: 8, duration: 0.3, stagger: 0.08 }, 0.85)
    .fromTo(you, { y: step * 2 }, { y: 0, duration: 0.8, ease: 'power3.inOut', immediateRender: true }, 1.3)
    .fromTo(items.slice(1), { y: -step }, { y: 0, duration: 0.8, ease: 'power3.inOut', immediateRender: true }, 1.3)
    .from($(root, '.serp-top'), { opacity: 0, scale: 0.6, duration: 0.3, ease: 'back.out(2)' }, 2.1);
  countUp(tl, $(root, '.serp-clicks'), 2.2, 1.0);
  countUp(tl, $(root, '.serp-calls'), 2.3, 1.0);
  return tl;
}

/* 7 — NFC: the phone meets the card, waves ripple, the page slides up */
function nfc(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  tl.from($(root, '.nfc-phone'), { y: 40, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.1)   // from below: never past the viewport edge
    .fromTo($$(root, '.nfc-waves i'), { scale: 0.3, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.8, stagger: 0.2, immediateRender: true }, 0.7)
    .from($$(root, '.nfc-phone > *'), { opacity: 0, y: 10, duration: 0.3, stagger: 0.08 }, 1.2)
    .from($(root, '.nfc-stars'), { scaleX: 0, transformOrigin: 'left center', duration: 0.4 }, 1.6);
  return tl;
}

/* ── Flows: after the intro, each demo keeps working, forever, with no reset or fade ──────────
   A flow starts on the finished frame and every cycle ends where the next begins, so the
   timeline simply repeats. Text that changes rotates through a small script (a closure
   counter). Flows never add or remove nodes (React owns them): they recycle what is there.
   DemoPlayer snapshots the text first and puts it back, with flow.revert(), on cleanup. */

/** Change an element's own text without replacing React's text node (keeps icons and spans). */
function txt(el: Element | null | undefined, s: string) {
  if (!el) return;
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue?.trim());
  if (node) node.nodeValue = node.nodeValue!.match(/^\s/) ? ' ' + s : s;
  else el.textContent = s;
}
const numOf = (el: Element | null) => Number(el?.textContent?.replace(/[^\d]/g, '') || 0);

/* website: visitors keep arriving, the button keeps being pressed, tables keep changing */
function websiteFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.inOut' } });
  const badge = $(root, '.bp-badge'), cursor = $(root, '.demo-cursor');
  const free = ['1 table free', 'Fully booked tonight', '3 tables free', '2 tables free'];
  let i = 0;
  tl.to(cursor, { x: 70, y: 46, duration: 0.9 }, 0.4)                       // wanders off to read
    .to($$(root, '.bp-cards span'), { opacity: 0.55, duration: 0.3, stagger: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.6)
    .to(cursor, { x: 0, y: 0, duration: 0.8 }, 1.6)                          // comes back to book
    .fromTo($(root, '.demo-ripple'), { scale: 0, opacity: 0.8 }, { scale: 2.4, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, 2.45)
    .to($(root, '.bp-btn'), { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1 }, 2.45)
    .call(() => txt(badge, free[i++ % free.length]), [], 2.75)               // someone else just booked
    .fromTo(badge, { scale: 1.15 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, 2.75)
    .to($(root, '.speed-ring'), { scale: 1.06, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 3.2)
    .to({}, { duration: 0.6 }, 4.2);                                         // a breath, then the next visitor
  return tl;
}

/* app: bookings keep arriving at the top; the oldest slides away; totals keep counting */
function appFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const rows = $$(root, '.dash-table .row'), toast = $(root, '.dash-toast'), total = $(root, '.dash-stats .v');
  const h = rows[1] ? rows[1].offsetTop - rows[0].offsetTop : 24;
  const next = [['Table for 3', '8:00 pm', 'website'], ['Table for 2', '8:15 pm', 'walk-in'], ['Birthday, 10', '8:30 pm', 'WhatsApp'],
    ['Table for 4', '8:45 pm', 'Google'], ['Table for 5', '9:00 pm', 'website'], ['Table for 2', '9:15 pm', 'WhatsApp']];
  let i = 0, n = numOf(total);
  const cells = (r: HTMLElement) => [...r.children].slice(1) as HTMLElement[];
  tl.to(rows, { y: h, duration: 0.45, ease: 'power2.inOut' }, 0.3)          // everything steps down
    .to(rows[rows.length - 1], { opacity: 0, duration: 0.3 }, 0.3)          // the oldest leaves
    .to(toast, { opacity: 0, y: 6, duration: 0.2 }, 0.3)
    .call(() => {
      for (let k = rows.length - 1; k > 0; k--) cells(rows[k]).forEach((c, j) => txt(c, cells(rows[k - 1])[j].textContent ?? ''));
      const [what, when, from] = next[i++ % next.length];
      txt(cells(rows[0])[0], what); txt(cells(rows[0])[1], when); txt(toast, `Booking from ${from}`);
      txt(total, String(++n));
      gsap.set(rows, { y: 0, opacity: 1 });
      gsap.set(rows[0], { opacity: 0, y: -10 });
    }, [], 0.76)
    .to(rows[0], { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 0.8)
    .fromTo(rows[0], { scale: 1.04 }, { scale: 1, duration: 0.4, immediateRender: false }, 1.1)
    .fromTo(total, { scale: 1.2 }, { scale: 1, duration: 0.35, immediateRender: false }, 0.8)
    .to(toast, { opacity: 1, y: 0, duration: 0.3 }, 0.95)
    .to({}, { duration: 1.1 }, 1.5);
  return tl;
}

/* WhatsApp: the next customer is always typing; the bot answers every one */
function whatsappFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const [q, a, tapBack, done] = $$(root, '.msg');
  const typing = $$(root, '.wa-typing');
  const quick = $(root, '.wa-quick'), btns = $$(root, '.wa-quick span'), ticks = $(root, '.wa-ticks');
  const all = [q, a, quick, tapBack, done];
  const scripts = [
    { q: 'Is the cake shop open on Sunday?', a: 'Open 9 am to 9 pm every Sunday. Want to pre-order so it’s ready?', b: ['Pre-order', 'See cakes', 'Talk to a person'], t: 0, d: 'Pre-order saved. Pick it up any time after 10 am.' },
    { q: 'Price for AC service?', a: 'Split AC service is ₹599 and takes about 45 minutes. Pick a slot:', b: ['Tomorrow 10 am', 'Tomorrow 4 pm', 'Talk to a person'], t: 1, d: 'Booked for tomorrow, 4 pm. Our technician will call first.' },
    { q: 'Do you deliver near the station?', a: 'Yes — delivery near the station is free on orders over 500. What would you like?', b: ['Order now', 'See menu', 'Talk to a person'], t: 0, d: 'Order confirmed. It reaches you by 7:40 pm.' },
  ];
  let i = 0, pick = 0;
  const type = (el: HTMLElement | undefined, at: number, dur: number) => {
    if (!el) return;
    tl.set(el, { display: 'flex' }, at)
      .fromTo(el.children, { opacity: 0.25 }, { opacity: 1, duration: 0.2, stagger: 0.1, repeat: 2, yoyo: true, immediateRender: false }, at)
      .set(el, { display: 'none' }, at + dur);
  };
  tl.to({}, { duration: 1.6 })                                               // read the finished chat
    .to(all, { y: -18, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.in' }, 1.6)   // the chat scrolls up
    .call(() => {
      const s = scripts[i++ % scripts.length];
      txt(q, s.q); txt(a, s.a); txt(tapBack, s.b[s.t]); txt(done, s.d);
      btns.forEach((b, k) => { txt(b, s.b[k]); b.classList.toggle('tapped', false); });
      ticks?.classList.remove('read');
      gsap.set(all, { y: 10 });
      pick = s.t;
    }, [], 2.2)
    .to(q, { opacity: 1, y: 0, duration: 0.3 }, 2.3);
  type(typing[0], 2.6, 0.7);
  tl.to(a, { opacity: 1, y: 0, duration: 0.3 }, 3.3)
    .to(quick, { opacity: 1, y: 0, duration: 0.3 }, 3.55)
    .call(() => btns[pick]?.classList.add('tapped'), [], 4.05)
    .to(tapBack, { opacity: 1, y: 0, duration: 0.3 }, 4.2);
  type(typing[1], 4.5, 0.6);
  tl.to(done, { opacity: 1, y: 0, duration: 0.3 }, 5.1)
    .call(() => ticks?.classList.add('read'), [], 5.55);
  return tl;
}

/* n8n: entries keep flowing; every node pulses as one passes and reports it */
function n8nFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const flow = $(root, '.flow')!, packet = $(root, '.flow-packet');
  const checks = $$(root, '.flow-check'), outs = $$(root, '.flow-out');
  const vertical = flow.offsetWidth < 480;
  const span = () => (vertical ? flow.offsetHeight - 44 : flow.offsetWidth * 0.8);
  const axis = vertical ? 'y' : 'x';
  const hop = 0.5;
  const intents = ['intent: booking', 'intent: question', 'intent: order'];
  const sources = ['new entry', 'new message', 'new call'];
  let row = numOf(outs[1]), k = 0;
  tl.fromTo(packet, { [axis]: 0, opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, 0)
    .to(packet, { [axis]: () => span(), duration: hop * 4, ease: 'none' }, 0.1)
    .to(packet, { opacity: 0, duration: 0.15 }, 0.1 + hop * 4);
  checks.forEach((c, j) => {
    const at = 0.05 + j * hop;
    tl.fromTo(c, { scale: 1 }, { scale: 1.22, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.out', immediateRender: false }, at)
      .fromTo(outs[j], { opacity: 0.35 }, { opacity: 1, duration: 0.3, immediateRender: false }, at);
    if (j === 0) tl.call(() => txt(outs[0], sources[k % sources.length]), [], at);
    if (j === 1) tl.call(() => txt(outs[1], `row #${++row}`), [], at);
    if (j === 2) tl.call(() => txt(outs[2], intents[k % intents.length]), [], at);
    if (j === checks.length - 1) tl.call(() => { k++; }, [], at);
  });
  tl.to({}, { duration: 0.5 }, 0.1 + hop * 4 + 0.15);
  return tl;
}

/* SEO: new searches keep coming; every time, the business climbs back to the top */
function seoFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const q = $(root, '.serp-q'), items = $$(root, '.serp-item'), you = items[0];
  const clicks = $(root, '.serp-clicks'), calls = $(root, '.serp-calls');
  const step = items[1] ? items[1].offsetTop - items[0].offsetTop : 0;
  const queries = ['split ac service near me', 'ac repair kochi open now', 'best ac installation kochi', 'ac installation kochi'];
  let i = 0, c = numOf(clicks), n = numOf(calls);
  const del = { p: 1 }, add = { p: 0 };
  let from = '', to = '';
  tl.to({}, { duration: 1.2 })
    .call(() => { from = q?.textContent ?? ''; to = queries[i++ % queries.length]; }, [], 1.2)
    .fromTo(del, { p: 1 }, { p: 0, duration: 0.35, ease: 'none', immediateRender: false, onUpdate: () => txt(q, from.slice(0, Math.round(del.p * from.length))) }, 1.2)
    .fromTo(add, { p: 0 }, { p: 1, duration: 0.7, ease: 'none', immediateRender: false, onUpdate: () => txt(q, to.slice(0, Math.round(add.p * to.length))) }, 1.6)
    .call(() => txt(q, to), [], 2.3)
    .to(items, { opacity: 0.35, duration: 0.15 }, 2.3)                       // results refresh
    .set(you, { y: step * 2 }, 2.45)
    .set(items.slice(1), { y: -step }, 2.45)
    .to(items, { opacity: 1, duration: 0.2 }, 2.45)
    .set($(root, '.serp-top'), { opacity: 0 }, 2.45)
    .to(you, { y: 0, duration: 0.8, ease: 'power3.inOut' }, 2.8)
    .to(items.slice(1), { y: 0, duration: 0.8, ease: 'power3.inOut' }, 2.8)
    .fromTo($(root, '.serp-top'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }, 3.6)
    .call(() => { c += 3 + (i % 4); txt(clicks, String(c)); if (i % 2) txt(calls, String(++n)); }, [], 3.7)
    .fromTo([clicks, calls], { scale: 1.2 }, { scale: 1, duration: 0.35, immediateRender: false }, 3.7)
    .to({}, { duration: 1.2 }, 4.1);
  return tl;
}

/* NFC: tap after tap, the same card opens a review, a warranty, a contact */
function nfcFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const phone = $(root, '.nfc-phone'), parts = $$(root, '.nfc-phone > *');
  const big = parts[2];
  const acts = [
    ['Tapped · warranty', 'Warranty valid', '✓ Until Mar 2028', 'AC-88213 · next service 12 Oct', 'Book a service'],
    ['Tapped · no app needed', 'Save contact', 'Ravi Menon', 'CoolAir · +91 98470 00000', 'Save to phone'],
    ['Tapped · no app needed', 'Leave a review', '★★★★★', 'CoolAir Services · Google', 'Post review'],
  ];
  let i = 0;
  tl.to({}, { duration: 1.6 })
    .to(parts, { opacity: 0, y: -8, duration: 0.25, stagger: 0.04, ease: 'power2.in' }, 1.6)
    .to(phone, { y: 18, rotate: 3, duration: 0.4, ease: 'power2.inOut' }, 1.75)      // the phone lifts away
    .call(() => { acts[i++ % acts.length].forEach((s, k) => txt(parts[k], s)); gsap.set(parts, { y: 10 }); }, [], 2.1)
    .to(phone, { y: 0, rotate: 0, duration: 0.4, ease: 'power3.out' }, 2.2)          // and taps again
    .fromTo($$(root, '.nfc-waves i'), { scale: 0.3, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.8, stagger: 0.18, immediateRender: false }, 2.5)
    .to(parts, { opacity: 1, y: 0, duration: 0.3, stagger: 0.07 }, 2.75)
    .fromTo(big, { scale: 0.85 }, { scale: 1, duration: 0.35, ease: 'back.out(2)', immediateRender: false }, 2.9);
  return tl;
}

/* quotation: one job's whole life on the rail, then the next job, forever (plan F step 5) */
const JOBS = [
  { no: 'Q-2042', ask: 'Hello, price for a 200 L solar water heater?', who: 'Arun · Thrissur', title: 'Solar water heater, 200 L',
    lines: [['200 L solar heater', '₹42,000'], ['Installation', '₹3,500'], ['Stand and piping', '₹2,800']], total: 48300,
    signed: 'Signed by Arun · 2 Oct, 16:20', acc: '2 Oct', fitted: '4 Oct 2025', serial: 'LF-SW-10457', covers: 'Tank and panel', until: '2 Oct 2030' },
  { no: 'Q-2043', ask: 'Need 4 CCTV cameras for my shop. Quote?', who: 'Meera · Ernakulam', title: 'CCTV, 4 cameras',
    lines: [['4 HD cameras', '₹18,400'], ['Recorder with 1 TB', '₹7,900'], ['Wiring and fitting', '₹4,500']], total: 30800,
    signed: 'Signed by Meera · 20 Oct, 11:05', acc: '20 Oct', fitted: '21 Oct 2025', serial: 'LF-CC-55102', covers: 'Cameras and recorder', until: '20 Oct 2027' },
  { no: 'Q-2041', ask: 'Hi, can I get a quote for a split AC?', who: 'Priya · Kochi', title: 'Split AC installation',
    lines: [['1.5 ton split AC', '₹38,500'], ['Installation and copper kit', '₹4,200'], ['Stabiliser', '₹3,100']], total: 45800,
    signed: 'Signed by Priya · 14 Sep, 10:58', acc: '14 Sep', fitted: '16 Sep 2025', serial: 'LF-AC-88213', covers: 'Parts and labour', until: '14 Sep 2027' },
];
const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

function quoteFlow(root: Element, gsap: G): TL {
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power2.out' } });
  const stages = $$(root, '.qx-rail li'), fill = $(root, '.qx-fill');
  const bubble = $(root, '.qm-bubble'), card = $(root, '.qx-card');
  const kicker = $(root, '.qx-front .qm-kicker'), status = $(root, '.qx-status');
  const client = $(root, '.qx-client'), title = $(root, '.qx-front .qm-title');
  const lines = $$(root, '.qx-front .qm-lines li'), total = $(root, '.qx-front .qm-total span:last-child');
  const meta = $(root, '.qx-front .qm-meta'), sign = $(root, '.qx-sign'), signBy = $(root, '.qx-sign-by'), seal = $(root, '.qm-seal');
  const facts = $$(root, '.qx-back .qm-facts dd'), valid = $(root, '.qx-back .stamp');
  const scan = $(root, '.qx-back .qm-scan'), phone = $(root, '.qx-phone'), waves = $$(root, '.qx-waves i');
  const remind = $(root, '.qm-remind'), count = $(root, '.qx-count');
  const n = stages.length;
  let j = 0, job = JOBS[0], quotes = numOf(count);
  const sum = { v: 0 };

  // a stage lights: its dot, everything before it, and the rail fill up to it
  const reach = (k: number, at: number) => {
    tl.call(() => stages.forEach((s, i) => { s.classList.toggle('is-on', i <= k); s.classList.toggle('is-now', i === k); }), [], at)
      .to(fill, { scaleX: k / (n - 1), duration: 0.4, ease: 'power2.inOut' }, at);
  };
  const say = (el: HTMLElement | null, s: string, at: number) => tl.call(() => txt(el, s), [], at);
  const stateOf = (s: string, ok: boolean, at: number) => tl.call(() => { txt(status, s); status?.classList.toggle('stamp-ok', ok); }, [], at)
    .fromTo(status, { scale: 1.25 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, at);

  // 0 · hold the finished job, then clear the paper for the next enquiry
  tl.to({}, { duration: 1.4 })
    .to([...lines, total, meta, sign, seal, remind], { opacity: 0, y: -6, duration: 0.3, stagger: 0.03, ease: 'power2.in' }, 1.4)
    .to(bubble, { opacity: 0, y: -8, duration: 0.25 }, 1.4)
    .call(() => {
      job = JOBS[j++ % JOBS.length];
      txt(bubble, job.ask); txt(kicker, `Quote ${job.no}`); txt(client, `For ${job.who}`); txt(title, job.title);
      lines.forEach((li, i) => { txt(li.children[0], job.lines[i][0]); txt(li.children[1], job.lines[i][1]); });
      txt(total, rupees(0)); txt(signBy, job.signed);
      [job.serial, job.covers, job.fitted, job.until].forEach((v, i) => txt(facts[i], v));
      txt(remind, `Warranty to ${job.until} · reminder set on WhatsApp `);
      gsap.set(sign, { clipPath: 'inset(0 100% 0 0)', opacity: 1, y: 0 });
      gsap.set(seal, { opacity: 0, y: 0 });
    }, [], 1.9);
  reach(0, 1.9);
  stateOf('Draft', false, 1.9);
  // 1 · the enquiry arrives on WhatsApp
  tl.fromTo(bubble, { opacity: 0, y: 10, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }, 2.0);
  // 2 · the quote builds from saved line items; the total adds up
  reach(1, 2.6);
  tl.fromTo(lines, { opacity: 0, x: -12, y: 0 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.18, immediateRender: false }, 2.6)
    .fromTo(total, { opacity: 0, y: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, 2.7)
    .fromTo(sum, { v: 0 }, { v: 1, duration: 0.8, ease: 'power2.out', immediateRender: false, onUpdate: () => txt(total, rupees(sum.v * job.total)) }, 2.8);
  // 3 · sent as a link, delivered
  reach(2, 3.8);
  stateOf('Sent', false, 3.8);
  say(meta, 'Sent as a link · delivered ✓✓', 3.8);
  tl.fromTo(meta, { opacity: 0, y: 0 }, { opacity: 1, duration: 0.25, immediateRender: false }, 3.8);
  // 4 · opened (twice)
  reach(3, 4.6);
  stateOf('Opened', false, 4.6);
  say(meta, 'Delivered ✓✓ · opened once', 4.6);
  say(meta, 'Delivered ✓✓ · opened twice', 5.0);
  // 5 · accepted: the signature writes itself, our seal presses it
  reach(4, 5.5);
  tl.fromTo(sign, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power1.inOut', immediateRender: false }, 5.5);
  stateOf('Accepted', true, 6.3);
  tl.call(() => txt(meta, `Delivered ✓✓ · opened twice · accepted ${job.acc}`), [], 6.3)
    .fromTo(seal, { opacity: 0, scale: 1.12, rotate: -30 }, { opacity: 1, scale: 1, rotate: -12, duration: 0.32, ease: 'power4.in', immediateRender: false }, 6.3)
    .fromTo(card, { y: 0 }, { y: 3, duration: 0.06, yoyo: true, repeat: 1, immediateRender: false }, 6.62);
  // 6 · installed
  reach(5, 7.3);
  stateOf('Installed', true, 7.3);
  // 7 · the card turns over: the warranty; the code is scanned, the sticker is tapped
  reach(6, 8.1);
  tl.fromTo(card, { rotateY: 0 }, { rotateY: 180, duration: 0.8, ease: 'power3.inOut', immediateRender: false }, 8.1)
    .fromTo(valid, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power4.in', immediateRender: false }, 8.3)
    .fromTo(scan, { y: 0, opacity: 0 }, { opacity: 1, duration: 0.1, immediateRender: false }, 9.0)
    .fromTo(scan, { y: 0 }, { y: 40, duration: 0.5, ease: 'power1.inOut', immediateRender: false }, 9.0)
    .to(scan, { opacity: 0, duration: 0.15 }, 9.5)
    .fromTo(phone, { x: 22, y: 10, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, 9.6)
    .fromTo(waves, { scale: 0.4, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 0.7, stagger: 0.18, immediateRender: false }, 10.0)
    .fromTo(valid, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, 10.1);
  // 8 · the reminder goes out on WhatsApp; the card turns back; one more quote this month
  reach(7, 10.9);
  tl.fromTo(card, { rotateY: 180 }, { rotateY: 360, duration: 0.8, ease: 'power3.inOut', immediateRender: false }, 11.1)
    .set(card, { rotateY: 0 }, 11.9)
    .fromTo(remind, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)', immediateRender: false }, 11.2)
    .call(() => txt(count, String(++quotes)), [], 11.4)
    .fromTo(count, { scale: 1.25 }, { scale: 1, duration: 0.3, immediateRender: false }, 11.4)
    .to({}, { duration: 1.2 }, 11.9);
  return tl;
}

/** Continuous flows (plan F step 4). A kind without one falls back to the fade-and-replay loop. */
export const FLOWS: Partial<Record<DemoId, (root: Element, gsap: G) => TL>> = {
  website: websiteFlow, app: appFlow, whatsapp: whatsappFlow, n8n: n8nFlow, seo: seoFlow, nfc: nfcFlow, quote: quoteFlow,
};

export const DEMOS: Record<DemoId, (root: Element, gsap: G) => TL> = { website, app, whatsapp, n8n, quote, seo, nfc };
