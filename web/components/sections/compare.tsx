'use client';

/** Compare "Static or dynamic?" (PLAN §6.4, animation #13; plan E). The same café twice:
 *  - the static half is a PRINTED menu: the same for everyone, until someone edits it;
 *  - the dynamic half is ALIVE while you watch: tables free tick down, an order moves along,
 *    an item sells out, the visitor is signed in (only on screen, only with motion on);
 *  - under the frame, how each is served (one hop vs a round trip to a database);
 *  - "Which one do I need?": three yes/no questions glide the slider to the answer.
 *  A native range input covers the frame, so mouse, touch, keyboard and screen readers all
 *  work. Arrow keys 1%, Page Up/Down 10%, Home/End jump. */

import { useEffect, useRef, useState } from 'react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { waLink } from '@/lib/site';

type Fact = { price: string; time: string };

/** The dynamic café's live states, one per tick. Index 0 is also the still frame. */
const LIVE = [
  { tables: 3, order: 'Received', soldOut: false, user: '', taken: [] as number[] },
  { tables: 2, order: 'Being prepared', soldOut: false, user: 'Priya', taken: [1] },
  { tables: 2, order: 'Being prepared', soldOut: true, user: 'Priya', taken: [1] },
  { tables: 1, order: 'Ready to collect ✓', soldOut: true, user: 'Priya', taken: [1, 2] },
  { tables: 3, order: 'Ready to collect ✓', soldOut: false, user: 'Priya', taken: [2] },
];
const SLOTS = ['7:30 pm', '7:45 pm', '8:00 pm'];
const TICK_MS = 2200;

const QUESTIONS = [
  { id: 'daily', q: 'Does your content change every day?', why: 'content that changes daily' },
  { id: 'login', q: 'Do customers log in or have accounts?', why: 'logins' },
  { id: 'orders', q: 'Do you take bookings, orders or payments online?', why: 'bookings and orders' },
] as const;
type QId = (typeof QUESTIONS)[number]['id'];

export function Compare({ facts }: { facts: { static: Fact; dynamic: Fact } }) {
  const motionOn = useMotionEnabled();
  const [pos, setPos] = useState(50);
  const [tick, setTick] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<QId, boolean>>>({});
  const frame = useRef<HTMLDivElement>(null);
  const glide = useRef(0);

  // the dynamic half lives only while the frame is on screen, and only with motion on
  useEffect(() => {
    const el = frame.current;
    if (!el || !motionOn) { setTick(0); return; }
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = window.setInterval(() => setTick((t) => (t + 1) % LIVE.length), TICK_MS);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [motionOn]);

  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  /** Move the slider to a side: glides with motion, jumps without. */
  function slideTo(target: number) {
    cancelAnimationFrame(glide.current);
    if (!motionOn) { setPos(target); return; }
    const from = pos, t0 = performance.now(), dur = 900;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setPos(Math.round(from + (target - from) * e));
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

  const live = LIVE[tick];
  const waText = verdict
    ? `Hi Legit Forge, your site says I need a ${verdict} website${needs.length ? ` (${needs.map((n) => n.why).join(', ')})` : ''}. Can we talk?`
    : 'Hi Legit Forge, should my site be static or dynamic?';

  return (
    <section id="compare" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Static or dynamic? Drag to compare.</h2>
          <p className="type-lead">The same café website, built two ways. One is a printed menu. The other is alive.</p>
        </header>

        <div className="compare-labels">
          <p><strong>Static:</strong> fast, simple, lower cost. Best when content changes a few times a month. <span className="sr-only">{facts.static.price}, {facts.static.time}.</span></p>
          <p><strong>Dynamic:</strong> logins, bookings, dashboards. Best when content changes daily or per customer. <span className="sr-only">{facts.dynamic.price}, {facts.dynamic.time}.</span></p>
        </div>

        <div className="compare" ref={frame} style={{ '--pos': pos } as React.CSSProperties}>
          <CafeSite dynamic live={live} />
          <div className="compare-static"><CafeSite /></div>
          <span className="compare-divider" aria-hidden="true" />
          <span className="compare-fact is-static" aria-hidden="true"><b>Static</b> {facts.static.price} · {facts.static.time}</span>
          <span className="compare-fact is-dynamic" aria-hidden="true"><b>Dynamic</b> {facts.dynamic.price} · {facts.dynamic.time}</span>
          <span className="compare-handle" aria-hidden="true">
            <svg viewBox="0 0 28 72">
              <defs>
                <linearGradient id="chisel-steel" x1="0" x2="1"><stop offset="0" stopColor="#5C6B7A" /><stop offset=".45" stopColor="#C9D2DB" /><stop offset="1" stopColor="#3A4652" /></linearGradient>
                <linearGradient id="chisel-heat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C9D2DB" /><stop offset=".35" stopColor="#F0701E" /><stop offset="1" stopColor="#FFE2A0" /></linearGradient>
              </defs>
              <rect x="7" y="0" width="14" height="30" rx="3" fill="url(#chisel-steel)" />
              <path d="M8 30 H20 L18 60 L14 72 L10 60 Z" fill="url(#chisel-heat)" />
              <path d="M4 44 L0 48 L4 52 M24 44 L28 48 L24 52" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="range" min={0} max={100} value={pos}
            onChange={(e) => { cancelAnimationFrame(glide.current); setPos(Number(e.target.value)); }}
            aria-label="Compare the static and dynamic versions of the same café website"
            aria-valuetext={`${pos}% static version shown`}
          />
        </div>

        <p className="compare-facts" aria-hidden="true">
          <span><b>Static</b> {facts.static.price} · {facts.static.time}</span>
          <span><b>Dynamic</b> {facts.dynamic.price} · {facts.dynamic.time}</span>
        </p>

        {/* how each is served: the reason one is instant and cheap, and the other can know you */}
        <div className="engines" style={{ '--pos': pos } as React.CSSProperties}>
          <div className="engine is-static">
            <p className="engine-h">Underneath the static site</p>
            <ol className="engine-path" aria-hidden="true">
              <li>Finished page</li><li>Server near you</li><li>Your visitor</li>
            </ol>
            <span className="engine-track" aria-hidden="true" />
            <p className="engine-note">Pages are made once and copied close to every visitor. Nothing is worked out when someone opens it: about <b>0.9 s</b>, almost nothing to run or hack.</p>
          </div>
          <div className="engine is-dynamic">
            <p className="engine-h">Underneath the dynamic site</p>
            <ol className="engine-path is-loop" aria-hidden="true">
              <li>Your visitor</li><li>App server</li><li>Database</li><li>Live page</li>
            </ol>
            <span className="engine-track is-loop" aria-hidden="true" />
            <p className="engine-note">Every visit asks the database what is true <i>right now</i>: tables free, order status, who is signed in. That is what makes bookings, logins and dashboards possible.</p>
          </div>
        </div>

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
            <a className="btn btn-ghost btn-sm" href={waLink(waText)}>{verdict ? 'Send this to us on WhatsApp' : 'Not sure? Ask us on WhatsApp'}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The same café website twice. The dynamic one adds live data and a login. */
function CafeSite({ dynamic = false, live = LIVE[0] }: { dynamic?: boolean; live?: (typeof LIVE)[number] }) {
  return (
    <div className={`cafe ${dynamic ? 'cafe-dynamic' : 'cafe-static'}`} aria-hidden="true">
      <div className="cafe-nav">
        <span className="cafe-brand">Corner Café</span>
        <span className="cafe-links"><span>Menu</span><span>Visit</span></span>
        {dynamic
          ? <span className="cafe-account" key={live.user}>{live.user ? `Hi, ${live.user}` : 'Sign in'}</span>
          : <span className="cafe-call">Call us</span>}
      </div>

      <div className="cafe-body">
        <div className="cafe-menu">
          <p className="cafe-h">Today’s menu</p>
          <ul className="num">
            <li><span>Filter coffee</span><span>₹60</span></li>
            <li><span>Masala dosa</span><span>₹120</span></li>
            <li className={dynamic && live.soldOut ? 'is-out' : undefined}>
              <span>Banana bread</span>
              <span>{dynamic && live.soldOut ? <em className="cafe-out">Sold out</em> : '₹90'}</span>
            </li>
          </ul>
          {dynamic && <span className="cafe-order">Order ahead</span>}
          {!dynamic && <span className="cafe-stamp is-printed">Printed · same for everyone · updated 3 weeks ago</span>}
        </div>

        <div className="cafe-side">
          {dynamic ? (
            <>
              <div className="cafe-live"><span className="live-dot" /><b className="cafe-flip" key={live.tables}>{live.tables}</b>&nbsp;tables free now</div>
              <div className="cafe-status"><span className="num">Order #214</span><span className="cafe-flip" key={live.order}>{live.order}</span></div>
              <div className="cafe-book">
                <span className="cafe-book-h">Book a table tonight</span>
                <span className="cafe-slots">
                  {SLOTS.map((t, i) => <span key={t} className={`cafe-slot num${live.taken.includes(i) ? ' is-taken' : ''}`}>{t}</span>)}
                </span>
              </div>
              <span className="cafe-stamp is-live">Live · updated just now</span>
            </>
          ) : (
            <>
              <div className="cafe-hours"><span>Open</span><span className="num">7 am – 10 pm</span></div>
              <div className="cafe-map" />
              <div className="cafe-book"><span className="cafe-book-h">Book a table</span><span className="cafe-call-note">Call us on 98765 43210</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
