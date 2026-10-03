'use client';

/** Illustrative workflow replay. This animation has no message-processing integration.
 *  The real bot, hosting, memory, opt-outs and verified messaging remain a separate release. */

import { useEffect, useRef, useState } from 'react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { CheckIcon } from '@/components/ui/icons';
import { waLink } from '@/lib/site';
import { useCompany } from '@/components/company-context';

const STEPS = [
  { key: 'received',   label: 'Sample message received',    at: 0.0 },
  { key: 'understood', label: 'Example request understood', at: 1.6 },
  { key: 'saved',      label: 'Example request saved',      at: 2.3 },
  { key: 'replied',    label: 'Example WhatsApp reply',      at: 3.4 },
  { key: 'notified',   label: 'Example team alert',         at: 4.2 },
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
  const company = useCompany();
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
    <section id="live-test" data-event-location="service" data-heat="0.8" className="section">
      <div className="wrap live-grid">
        <div className="live-copy">
          <h2 className="type-h2">Watch an example WhatsApp workflow.</h2>
          <ol className="live-steps">
            <li>Tap <strong>Run the demo</strong> to start the example.</li>
            <li>Watch a sample message get understood, saved and answered.</li>
            <li>See where your team would receive the request.</li>
          </ol>

          <button type="button" className="btn btn-primary" onClick={run} disabled={status === 'running'}>
            {status === 'idle' ? 'Run the demo' : status === 'running' ? 'Running…' : 'Run it again'}
          </button>

          {code && (
            <p className="live-code">
              Example reference <span className="num">{code}</span>
            </p>
          )}

          <p className="live-note">
            <strong>This is an illustrative demo.</strong> The messages, reference and timings are examples.
            It runs in this page, sends no WhatsApp message and collects no phone number. Your business
            workflow and response times depend on the integration we agree with you.
          </p>
        </div>

        <div className="live-graph-wrap">
          <p className="live-watch" data-state={status} aria-hidden="true">
            <span className="live-watch-dot" />
            <span ref={watch} className="live-watch-num num">{status === 'idle' ? '0.0' : REPLY_AT.toFixed(1)}</span>
            <span className="live-watch-unit">s</span>
            <span className="live-watch-label">{status === 'idle' ? 'example reply time' : lit >= 4 ? 'example reply sent' : 'waiting for the example reply…'}</span>
          </p>
          <ol className="live-graph" aria-label="Example workflow progress">
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
              <p>This example runs through the steps in <strong className="num">{total} seconds</strong>. Want a workflow like this for your business?</p>
              <a className="btn btn-ghost" href={waLink(company, 'Hi Legit Forge, I saw the WhatsApp demo and want this for my business.')}>Chat on WhatsApp</a>
            </div>
          )}
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      </div>
    </section>
  );
}
