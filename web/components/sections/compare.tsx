'use client';

/** Compare "Static or dynamic?" (PLAN §6.4, animation #13; plan G, 28 Sep: the owner asked for an
 *  example anyone can follow). The same café website twice, with the SAME features in the SAME
 *  rows: the menu, table booking, the customer's order, who is visiting.
 *  - Each row is [static answer | why] in the static version and [why | dynamic answer] in the
 *    dynamic one, so at 50 % the frame reads like a table (static beside dynamic, feature by
 *    feature) and dragging the chisel slides one version over the other and reveals its "why".
 *  - Above the frame, something happens at the café every few seconds (a sign-in, an order, a
 *    booking, a sell-out) and one line says what each website shows: the dynamic one updates on
 *    the spot, the static one can't know (only on screen, only with motion on; motion off: one
 *    still moment that shows every difference).
 *  - Under it, the difference in plain words, then "Which one do I need?": three yes/no
 *    questions glide the slider to the answer.
 *  A native range input covers the frame, so mouse, touch, keyboard and screen readers all
 *  work. Arrow keys 1 %, Page Up/Down 10 %, Home/End jump. */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { waLink } from '@/lib/site';
import { useCompany } from '@/components/company-context';

type Fact = { price: string; time: string };

/** One evening at the café, one change per tick; the last one sets up the loop again.
 *  order: 0 none, 1 received, 2 being prepared, 3 ready. booked: indexes into SLOTS. */
const EVENTS = [
  { at: '7:00 pm', what: 'Priya opens the café’s website and signs in', stat: 'Shows her the same page as everyone', dyn: 'Greets her: “Hi, Priya”', user: 'Priya', order: 0, booked: [] as number[], soldOut: false },
  { at: '7:02 pm', what: 'Priya orders a masala dosa', stat: 'Can’t take it: “call or WhatsApp”', dyn: 'Her order #214 appears', user: 'Priya', order: 1, booked: [], soldOut: false },
  { at: '7:04 pm', what: 'Someone books the 8:00 pm table', stat: 'No change: still “call us to book”', dyn: '8:00 pm shows as booked', user: 'Priya', order: 1, booked: [1], soldOut: false },
  { at: '7:06 pm', what: 'The last banana bread is sold', stat: 'Still lists it for ₹90', dyn: 'Shows “Sold out” straight away', user: 'Priya', order: 2, booked: [1], soldOut: true },
  { at: '7:09 pm', what: 'Priya’s dosa is ready', stat: 'Can’t tell her', dyn: 'Her order turns “Ready ✓”', user: 'Priya', order: 3, booked: [1], soldOut: true },
  { at: 'Next day', what: 'Fresh banana bread, every table free', stat: 'The same page as always', dyn: 'Everything resets by itself', user: '', order: 0, booked: [], soldOut: false },
];
type CafeEvent = (typeof EVENTS)[number];
/** The still frame (motion off, no JS, first paint): a moment where every difference shows. */
const STILL = 3;
const SLOTS = ['7:30', '8:00', '8:30'];
const ORDER = ['', 'Received', 'Being prepared', 'Ready ✓'];
const TICK_MS = 2800;

/** The difference in plain words, one row per question, the same questions for both. */
const PLAIN = [
  { q: 'Changes by itself?', static: 'No. It changes when someone edits it.', dynamic: 'Yes, the moment something happens.' },
  { q: 'Different for each customer?', static: 'No. Everyone sees the same page.', dynamic: 'Yes: their login, their bookings, their orders.' },
  { q: 'Bookings, orders, payments?', static: 'Through WhatsApp or a phone call.', dynamic: 'Right on the website.' },
  { q: 'Speed', static: 'The fastest, and very little to hack.', dynamic: 'Fast. More moving parts to build and look after.' },
  { q: 'It’s like', static: 'A newspaper: printed once, the same for everyone.', dynamic: 'A live cricket score: it changes every ball.' },
  { q: 'Best for', static: 'Portfolios, menus, clinic and shop information.', dynamic: 'Table bookings, online orders, member logins, dashboards.' },
] as const;

const QUESTIONS = [
  { id: 'daily', q: 'Does your content change every day?', why: 'content that changes daily' },
  { id: 'login', q: 'Do customers log in or have accounts?', why: 'logins' },
  { id: 'orders', q: 'Do you take bookings, orders or payments online?', why: 'bookings and orders' },
] as const;
type QId = (typeof QUESTIONS)[number]['id'];

export function Compare({ facts }: { facts: { static: Fact; dynamic: Fact } }) {
  const company = useCompany();
  const motionOn = useMotionEnabled();
  const [tick, setTick] = useState(STILL);
  const [answers, setAnswers] = useState<Partial<Record<QId, boolean>>>({});
  const frame = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const pos = useRef(50);
  const glide = useRef(0);

  /** The slider position lives in the DOM, not in React state: a drag or a glide sets one CSS
   *  variable on the frame (plus the input's value and text), so nothing re-renders per frame.
   *  React never overwrites it: the JSX always passes the same starting values. */
  const place = useCallback((v: number) => {
    pos.current = v;
    frame.current?.style.setProperty('--pos', String(v));
    const r = range.current;
    if (r) {
      if (r.valueAsNumber !== v) r.value = String(v);
      r.setAttribute('aria-valuetext', `${v}% static version shown`);
    }
  }, []);

  // the evening plays only while the frame is on screen, and only with motion on
  useEffect(() => {
    const el = frame.current;
    if (!el || !motionOn) { setTick(STILL); return; }
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = window.setInterval(() => setTick((t) => (t + 1) % EVENTS.length), TICK_MS);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [motionOn]);

  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  /** Move the slider to a side: glides with motion, jumps without. */
  function slideTo(target: number) {
    cancelAnimationFrame(glide.current);
    if (!motionOn) { place(target); return; }
    const from = pos.current, t0 = performance.now(), dur = 900;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      place(Math.round(from + (target - from) * e));
      if (k < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  }

  const answered = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const needs = QUESTIONS.filter((q) => answers[q.id]);
  const verdict = answered === 0 ? null : needs.length ? 'dynamic' : answered === QUESTIONS.length ? 'static' : null;

  function answer(id: QId, yes: boolean) {
    const next = { ...answers, [id]: yes };
    setAnswers(next);
    const need = QUESTIONS.some((q) => next[q.id]);
    const all = QUESTIONS.every((q) => next[q.id] !== undefined);
    if (need) slideTo(4); else if (all) slideTo(96);     // show the side that fits
  }

  const now = EVENTS[tick];
  const waText = verdict
    ? `Hi Legit Forge, your site says I need a ${verdict} website${needs.length ? ` (${needs.map((n) => n.why).join(', ')})` : ''}. Can we talk?`
    : 'Hi Legit Forge, should my site be static or dynamic?';

  return (
    <section id="compare" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Static or dynamic? Drag to compare.</h2>
          <p className="type-lead">The same café website, built two ways. Things keep happening at the café: watch which website keeps up.</p>
        </header>

        <p className="sr-only">
          An example evening at a café. When the last banana bread sells, the static website still lists it for ₹90 until someone
          edits the page, while the dynamic website shows “Sold out” straight away. The dynamic one can also take table bookings
          and show each customer their own order; the static one asks people to call or WhatsApp.
        </p>

        {/* what just happened, and what each website shows about it. Every moment is rendered in the
            same grid cell and only the current one shows: the tallest sets the height, so nothing
            below ever moves when the text changes (no layout shift while someone scrolls or reads) */}
        <div className="cafe-events" aria-hidden="true">
          {EVENTS.map((ev, i) => (
            <div className="cafe-moment" key={ev.at} data-on={i === tick ? '' : undefined}>
              <p className="cafe-event"><span className="live-dot" /><b className="num">{ev.at}</b>{ev.what}</p>
              <p className="cafe-outcome is-static"><b>Static site</b>{ev.stat}</p>
              <p className="cafe-outcome is-dynamic"><b>Dynamic site</b>{ev.dyn}</p>
            </div>
          ))}
        </div>

        <div className="compare" ref={frame} style={{ '--pos': 50 } as React.CSSProperties}>
          <CafeSite dynamic s={now} />
          {/* the static site never changes: a constant moment, so a tick never re-renders it */}
          <div className="compare-static"><CafeSite s={EVENTS[STILL]} /></div>
          <span className="compare-divider" aria-hidden="true" />
          <span className="compare-fact is-static" aria-hidden="true"><b>Static</b> {facts.static.price} · {facts.static.time}</span>
          <span className="compare-fact is-dynamic" aria-hidden="true"><b>Dynamic</b> {facts.dynamic.price} · {facts.dynamic.time}</span>
          <span className="compare-handle" aria-hidden="true">
            <svg viewBox="0 0 28 72">
              <defs>
                <linearGradient id="chisel-steel" x1="0" x2="1"><stop offset="0" stopColor="#5C6B7A" /><stop offset=".45" stopColor="#C9D2DB" /><stop offset="1" stopColor="#3A4652" /></linearGradient>
                <linearGradient id="chisel-heat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9D2DB" /><stop offset=".35" stopColor="#E3B452" /><stop offset="1" stopColor="#FFE2A0" /></linearGradient>
              </defs>
              <rect x="7" y="0" width="14" height="30" rx="3" fill="url(#chisel-steel)" />
              <path d="M8 30 H20 L18 60 L14 72 L10 60 Z" fill="url(#chisel-heat)" />
              <path d="M4 44 L0 48 L4 52 M24 44 L28 48 L24 52" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={range} type="range" min={0} max={100} defaultValue={50}
            onChange={(e) => { cancelAnimationFrame(glide.current); place(e.currentTarget.valueAsNumber); }}
            aria-label="Compare the static and dynamic versions of the same café website"
            aria-valuetext="50% static version shown"
          />
        </div>

        <p className="compare-facts" aria-hidden="true">
          <span><b>Static</b> {facts.static.price} · {facts.static.time}</span>
          <span><b>Dynamic</b> {facts.dynamic.price} · {facts.dynamic.time}</span>
        </p>

        <PlainWords facts={facts} />

        {/* which one do I need? three yes/no questions */}
        <div className="picker">
          <p className="picker-h">Which one do you need? Answer three questions.</p>
          <ol className="picker-qs">
            {QUESTIONS.map((q) => (
              <li key={q.id}>
                <span className="picker-q">{q.q}</span>
                <span className="picker-btns" role="group" aria-label={q.q}>
                  <button type="button" className="chip" aria-pressed={answers[q.id] === true} onClick={() => answer(q.id, true)}>Yes</button>
                  <button type="button" className="chip" aria-pressed={answers[q.id] === false} onClick={() => answer(q.id, false)}>No</button>
                </span>
              </li>
            ))}
          </ol>
          <div className="picker-result" aria-live="polite" data-verdict={verdict ?? undefined}>
            {verdict === 'static' && <p><b>A static site is enough.</b> Fast, low cost, {facts.static.price.toLowerCase()} · {facts.static.time.toLowerCase()}. You can add one live piece later.</p>}
            {verdict === 'dynamic' && <p><b>You need a dynamic site</b> for {needs.map((n) => n.why).join(' and ')}. {facts.dynamic.price} · {facts.dynamic.time.toLowerCase()}. The rest can stay static and fast.</p>}
            {!verdict && <p className="picker-wait">{answered ? 'One more…' : 'Your answer appears here, and the slider moves to the side that fits.'}</p>}
            <a className="btn btn-ghost btn-sm" href={waLink(company, waText)}>{verdict ? 'Send this to us on WhatsApp' : 'Not sure? Ask us on WhatsApp'}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The difference in plain words: one table, static on the left and dynamic on the right like the
 *  frame (grid rows keep their table roles; on phones the question sits above its answers).
 *  memo: dragging the slider or a tick of the café never re-renders it. */
const PlainWords = memo(function PlainWords({ facts }: { facts: { static: Fact; dynamic: Fact } }) {
  const rows = [...PLAIN, { q: 'Price and time', static: `${facts.static.price} · ${facts.static.time}`, dynamic: `${facts.dynamic.price} · ${facts.dynamic.time}` }];
  return (
    <div className="plain" role="table" aria-label="Static and dynamic websites in plain words">
      <div className="plain-row plain-head" role="row">
        <span className="plain-q" role="columnheader"><span className="sr-only">Question</span></span>
        <span className="is-static" role="columnheader">Static website</span>
        <span className="is-dynamic" role="columnheader">Dynamic website</span>
      </div>
      {rows.map((row) => (
        <div className="plain-row" role="row" key={row.q}>
          <span className="plain-q" role="rowheader">{row.q}</span>
          <span role="cell">{row.static}</span>
          <span role="cell">{row.dynamic}</span>
        </div>
      ))}
    </div>
  );
});

/** One feature row: the version's answer on its own side of the divider, the "why" on the other
 *  (static: [answer | why], dynamic: [why | answer], placed by CSS). */
function Row({ className, why, children }: { className?: string; why: string; children: React.ReactNode }) {
  return (
    <div className={`cafe-row${className ? ` ${className}` : ''}`}>
      <div className="cafe-card">{children}</div>
      <p className="cafe-why">{why}</p>
    </div>
  );
}

/** Every version of a changing value in one grid cell, only `on` visible: the longest sets the
 *  size, so a row never grows or shrinks (no layout shift) when the café's state changes. */
function Swap({ on, options, align = 'end' }: { on: number; options: React.ReactNode[]; align?: 'start' | 'end' }) {
  return (
    <span className="cafe-swap" style={{ justifyItems: align }}>
      {options.map((o, i) => <span key={i} data-on={i === on ? '' : undefined}>{o}</span>)}
    </span>
  );
}

/** The same café website twice: the same rows in the same places, answered two ways.
 *  memo: dragging only moves the divider (a CSS variable on the frame); the sites re-render on a
 *  tick of the café alone. */
const CafeSite = memo(function CafeSite({ dynamic = false, s }: { dynamic?: boolean; s: CafeEvent }) {
  return (
    <div className={`cafe ${dynamic ? 'cafe-dynamic' : 'cafe-static'}`} aria-hidden="true">
      <Row className="cafe-nav" why={dynamic ? 'Knows who is visiting' : 'Everyone sees this same page'}>
        <span className="cafe-brand">Corner Café</span>
        {dynamic
          ? <span className="cafe-account" key={s.user || 'out'}>{s.user ? `Hi, ${s.user}` : 'Sign in'}</span>
          : <span className="cafe-call">Call us</span>}
      </Row>

      <Row why={dynamic ? 'Checks what’s left in the kitchen on every visit' : 'Sold out? It still says ₹90 until someone edits it'}>
        <p className="cafe-h">Today’s menu</p>
        <ul className="cafe-menu num">
          <li><span>Filter coffee</span><span>₹60</span></li>
          <li><span>Masala dosa</span><span>₹120</span></li>
          <li className={dynamic && s.soldOut ? 'is-out' : undefined}>
            <span>Banana bread</span>
            <Swap on={dynamic && s.soldOut ? 1 : 0} options={['₹90', <em key="out" className="cafe-out">Sold out</em>]} />
          </li>
        </ul>
      </Row>

      <Row why={dynamic ? 'Updates the moment someone books' : 'Can’t show which tables are free'}>
        <p className="cafe-h">Book a table tonight</p>
        {dynamic
          ? <span className="cafe-slots">{SLOTS.map((t, i) => <span key={t} className={`cafe-slot num${s.booked.includes(i) ? ' is-taken' : ''}`}>{t}</span>)}</span>
          : <span className="cafe-note">Call us to book</span>}
      </Row>

      <Row why={dynamic ? 'Each customer sees only their own order' : 'Can’t follow an order'}>
        <p className="cafe-h">Your order</p>
        {/* the same shape with or without an order, so the row never changes height */}
        {!dynamic ? <span className="cafe-note">Call or WhatsApp to order</span> : (
          <span className="cafe-track">
            <span className="cafe-steps">{[1, 2, 3].map((n) => <i key={n} className={n <= s.order ? 'is-on' : undefined} />)}</span>
            <Swap on={s.order} align="start" options={ORDER.map((o, i) => (i
              ? <><span className="num">#214</span> {o}</>
              : <span className="cafe-note">Nothing ordered yet</span>))} />
          </span>
        )}
      </Row>

      <span className={`cafe-stamp ${dynamic ? 'is-live' : 'is-printed'}`}>{dynamic ? 'Live · updates by itself' : 'Printed · same for everyone'}</span>
    </div>
  );
});
