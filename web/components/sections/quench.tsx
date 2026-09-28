'use client';

/** Quench — the final call to action (PLAN §6.11). The only centred section. A two-tap brief in
 *  WhatsApp's own shape (the owner's pick, 28 Sep): our bot asks what to build and when, the
 *  visitor taps replies, and the chat opens in WhatsApp with those answers written out, ready to
 *  send. Nothing is stored on the site. The card keeps one height (the thread scrolls inside
 *  it), so a new message never shifts the page. Motion off: the bot answers at once. */

import { useEffect, useRef, useState } from 'react';
import { ChatIcon, CoinMark } from '@/components/ui/icons';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { replyByLabel } from '@/lib/business-hours';
import { SITE, waLink } from '@/lib/site';

/** The replies: [chip, how the WhatsApp message says it]. */
const NEEDS = [
  ['Website', 'a website'], ['Web app', 'a web app'], ['WhatsApp bot', 'a WhatsApp bot'],
  ['n8n automation', 'an n8n automation'], ['Quotes & warranties', 'a quotation or warranty system'],
  ['SEO', 'SEO for my business'], ['NFC cards', 'NFC cards or tags'], ['Not sure yet', 'not sure yet, can we talk it through?'],
] as const;
const WHEN = [['This week', 'this week'], ['This month', 'this month'], ['Just exploring', 'just exploring for now']] as const;
const NOT_SURE = NEEDS.length - 1;

function Chips({ items, label, onPick }: { items: readonly (readonly [string, string])[]; label: string; onPick: (i: number) => void }) {
  return (
    <div className="bc-chips" role="group" aria-label={label}>
      {items.map(([chip], i) => (
        <button key={chip} type="button" style={{ '--i': i } as React.CSSProperties} onClick={() => onPick(i)}>{chip}</button>
      ))}
    </div>
  );
}

const Ticks = ({ read }: { read: boolean }) => <span className={`bc-ticks${read ? ' read' : ''}`} aria-hidden="true">✓✓</span>;

export function Quench() {
  const motionOn = useMotionEnabled();
  const [need, setNeed] = useState<number | null>(null);
  const [when, setWhen] = useState<number | null>(null);
  const [shown, setShown] = useState(1);                   // bot lines on screen
  const answers = (need === null ? 0 : 1) + (when === null ? 0 : 1);
  const typing = shown <= answers;                         // the bot owes a reply
  const logRef = useRef<HTMLOListElement>(null);
  const repliesRef = useRef<HTMLDivElement>(null);
  const acted = useRef(false);                             // the visitor has tapped something

  // the bot types for a beat, then answers (at once with motion off)
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setShown(answers + 1), motionOn ? 850 : 0);
    return () => clearTimeout(t);
  }, [typing, answers, motionOn]);

  // after each tap: the thread shows its newest line, and focus moves to the new replies so a
  // keyboard or screen-reader visitor keeps their place. Nothing before the first tap: reading
  // scrollHeight on load would be a forced layout.
  useEffect(() => {
    if (!acted.current) return;
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: motionOn ? 'smooth' : 'auto' });
    if (!typing) repliesRef.current?.querySelector<HTMLElement>('button, a')?.focus({ preventScroll: true });
  }, [typing, shown, answers, motionOn]);

  const done = when !== null && shown >= 3;
  const replyBy = done ? replyByLabel() : '';              // "2:52 p.m." ends in a full stop already
  const text = need !== null && when !== null ? `Hi Legit Forge!\nI need: ${NEEDS[need][1]}\nWhen: ${WHEN[when][1]}` : '';
  const pickNeed = (i: number) => { acted.current = true; setNeed(i); };
  const pickWhen = (i: number) => { acted.current = true; setWhen(i); };
  const restart = () => { acted.current = true; setNeed(null); setWhen(null); setShown(1); };

  return (
    <section id="contact" data-heat="0.05" className="section quench">
      <div className="wrap quench-inner">
        <h2 className="type-h2">Tell us what you want to build.</h2>
        <p className="type-lead">Two taps, and the chat opens in WhatsApp. No pressure, no jargon.</p>

        <div className="bc" data-done={done ? '' : undefined}>
          <div className="bc-head">
            <span className="bc-avatar"><CoinMark /></span>
            <span className="bc-who"><b>Legit Forge</b><span>replies within {SITE.replyWithin}</span></span>
          </div>
          <ol className="bc-log" ref={logRef} aria-live="polite" aria-label="Chat with Legit Forge">
            <li className="bc-msg bc-bot">Hi! What should we build?</li>
            {need !== null && <li className="bc-msg bc-me">{NEEDS[need][0]}<Ticks read={shown >= 2} /></li>}
            {need !== null && shown >= 2 && (
              <li className="bc-msg bc-bot">
                {need === NOT_SURE ? 'No problem, we’ll work it out together. When would you like to start?' : 'Nice. When do you need it?'}
              </li>
            )}
            {when !== null && <li className="bc-msg bc-me">{WHEN[when][0]}<Ticks read={shown >= 3} /></li>}
            {done && (
              <li className="bc-msg bc-bot">
                Done. Tap below and this chat opens in WhatsApp with your answers, ready to send.
                We’ll reply by {replyBy}{replyBy.endsWith('.') ? '' : '.'}
              </li>
            )}
            {typing && <li className="bc-typing"><span className="sr-only">Legit Forge is typing</span><i /><i /><i /></li>}
          </ol>
          <div className="bc-replies" ref={repliesRef}>
            {!typing && need === null && <Chips items={NEEDS} label="What should we build?" onPick={pickNeed} />}
            {!typing && need !== null && when === null && <Chips items={WHEN} label="When do you need it?" onPick={pickWhen} />}
            {done && (
              <>
                <a className="btn btn-primary bc-send" href={waLink(text)}><ChatIcon aria-hidden="true" />Open in WhatsApp</a>
                <button type="button" className="bc-restart" onClick={restart}>Start over</button>
              </>
            )}
          </div>
        </div>

        <p className="quench-direct">or <a href={waLink()}>message us directly</a></p>
      </div>
    </section>
  );
}
