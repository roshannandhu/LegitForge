'use client';

/** Live test "Test us live" (PLAN §6.5), R1 build: an honest REPLAY of the real system's
 *  steps. §22.2 — ship the scripted demo first, label it as a demo, and swap in the real
 *  bot (Durable Object / polling, §9) once Meta verifies the number. */

import { useEffect, useRef, useState } from 'react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { CheckIcon } from '@/components/ui/icons';
import { waLink } from '@/lib/site';

const STEPS = [
  { key: 'received',   label: 'Our server got your message', at: 0.0 },
  { key: 'understood', label: 'Understood what you need',    at: 1.6 },
  { key: 'saved',      label: 'Saved your request',          at: 2.3 },
  { key: 'replied',    label: 'Replied on WhatsApp',         at: 3.4 },
  { key: 'notified',   label: 'Alerted our team',            at: 4.2 },
] as const;

type Status = 'idle' | 'running' | 'done';
const REPLY_AT = STEPS.find((s) => s.key === 'replied')!.at;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to misread
const makeCode = () => {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return 'LF-' + [...b].map((n) => ALPHABET[n % ALPHABET.length]).join('');
};

export function LiveTest() {
  const motionOn = useMotionEnabled();
  const [status, setStatus] = useState<Status>('idle');
  const [lit, setLit] = useState(0);
  const [code, setCode] = useState('');
  const [announce, setAnnounce] = useState('');
  const timers = useRef<number[]>([]);
  const watch = useRef<HTMLSpanElement>(null);
  const raf = useRef(0);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; cancelAnimationFrame(raf.current); };
  useEffect(() => clear, []);

  /** The reply stopwatch (plan D #6): counts from the message's arrival and freezes at the reply. */
  function startWatch(delayMs: number) {
    const el = watch.current;
    if (!el) return;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const t = Math.min(Math.max(0, (now - t0) / 1000), REPLY_AT);
      el.textContent = t.toFixed(1);
      if (t < REPLY_AT) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function run() {
    clear();
    setCode(makeCode());
    setStatus('running');
    setLit(0);
    setAnnounce('Demo started.');
    if (motionOn) startWatch(600); else if (watch.current) watch.current.textContent = REPLY_AT.toFixed(1);

    STEPS.forEach((s, i) => {
      const fire = () => {
        setLit(i + 1);
        setAnnounce(`Step ${i + 1} of ${STEPS.length} done: ${s.label.toLowerCase()}.`);
        if (i === STEPS.length - 1) setStatus('done');
      };
      if (!motionOn) fire();                                       // motion off: every step at once
      else timers.current.push(window.setTimeout(fire, 600 + s.at * 1000));
    });
  }

  const total = STEPS[STEPS.length - 1].at.toFixed(1);

  return (
    <section id="live-test" data-heat="0.8" className="section">
      <div className="wrap live-grid">
        <div className="live-copy">
          <h2 className="type-h2">Test our WhatsApp bot. Watch it work here.</h2>
          <ol className="live-steps">
            <li>Tap <strong>Run the demo</strong>. You get a one-time code.</li>
            <li>In the live version, you send that code to our WhatsApp.</li>
            <li>Watch the message move through our system on this screen.</li>
          </ol>

          <button type="button" className="btn btn-primary" onClick={run} disabled={status === 'running'}>
            {status === 'idle' ? 'Run the demo' : status === 'running' ? 'Running…' : 'Run it again'}
          </button>

          {code && (
            <p className="live-code">
              Your demo code <span className="num">{code}</span>
            </p>
          )}

          <p className="live-note">
            <strong>This is a replay</strong> of the steps our real system runs, with real timings.
            The live test — using your own phone and our real bot — switches on once our WhatsApp
            number is verified. We use your number only to reply to that test, and you can reply STOP any time.
          </p>
        </div>

        <div className="live-graph-wrap">
          <p className="live-watch" data-state={status} aria-hidden="true">
            <span className="live-watch-dot" />
            <span ref={watch} className="live-watch-num num">{status === 'idle' ? '0.0' : REPLY_AT.toFixed(1)}</span>
            <span className="live-watch-unit">s</span>
            <span className="live-watch-label">{status === 'idle' ? 'reply time' : lit >= 4 ? 'replied on WhatsApp' : 'waiting for the reply…'}</span>
          </p>
          <ol className="live-graph" aria-label="Live test progress">
            {STEPS.map((s, i) => {
              const done = i < lit;
              return (
                <li key={s.key} className="live-node" data-state={done ? 'done' : status === 'idle' ? 'idle' : 'waiting'}>
                  <span className="live-dot" aria-hidden="true">{done && <CheckIcon />}</span>
                  <span className="live-label">{s.label}</span>
                  <span className="live-time num">{done ? `+${s.at.toFixed(1)} s` : ''}</span>
                  <span className="sr-only">{done ? ', done' : ', not yet'}</span>
                </li>
              );
            })}
          </ol>

          {status === 'done' && (
            <div className="live-done">
              <p>That message took <strong className="num">{total} seconds</strong> from arrival to reply and team alert. Want this for your business?</p>
              <a className="btn btn-ghost" href={waLink('Hi Legit Forge, I saw the WhatsApp demo and want this for my business.')}>Chat on WhatsApp</a>
            </div>
          )}
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      </div>
    </section>
  );
}
