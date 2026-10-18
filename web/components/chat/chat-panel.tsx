'use client';

/** The chat panel behind the bubble (chat-bubble.tsx), loaded on the first tap. It talks to the
 *  bot Worker's /chat (bot/worker.ts): POST a message, GET the chat (the newest first, then what
 *  came after). Polled while open: every 2.5 s for a minute after a message, then every 15 s,
 *  every minute after 5 idle minutes, not at all after 30 (opening, focus or typing wakes it).
 *  The session id lives in this browser only (localStorage): it is the key to this chat. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCompany } from '@/components/company-context';
import { waLink } from '@/lib/site';
import './chat.css';

type Option = { id: string; title: string };
interface Line { id: string; at: string; mine: boolean; body: string; options: Option[] }
const KEY = 'lf-chat-session';

function sessionId(fresh = false) {
  try {
    const old = localStorage.getItem(KEY);
    if (!fresh && old && /^[0-9a-f-]{36}$/.test(old)) return old;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }                  // private mode: this visit only
}

/** Text with its https links tappable (the bot's quote, payment, Meet and work links). */
function Linked({ text }: { text: string }) {
  return <>{text.split(/(https:\/\/[^\s<>"]+[^\s<>".,;:!?)])/).map((part, i) => (i % 2 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part))}</>;
}

const every = (idle: number) => (idle < 60_000 ? 2500 : idle < 5 * 60_000 ? 15_000 : idle < 30 * 60_000 ? 60_000 : 0);

export default function ChatPanel({ url, open, onClose }: { url: string; open: boolean; onClose: () => void }) {
  const company = useCompany();
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<{ text: string; whatsapp?: boolean } | null>(null);
  const [ready, setReady] = useState(false);               // the stored chat is in: only new lines are announced
  const session = useRef('');
  const after = useRef('');
  const active = useRef(Date.now());                       // the last message either way, or the panel opening
  const wake = useRef<() => void>(() => {});
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${url}?session=${session.current}${after.current ? `&after=${encodeURIComponent(after.current)}` : ''}`);
      if (!r.ok) return;
      const { messages } = (await r.json()) as { messages: { wamid: string; at: string; dir: 'in' | 'out'; body: string; options: Option[] | null }[] };
      if (!messages.length) return;
      after.current = messages[messages.length - 1].at;      // the bot sends a little overlap: drop what is already shown
      setLines((old) => {
        const fresh = messages.filter((m) => !old.some((o) => o.id === m.wamid));
        if (fresh.some((m) => m.dir === 'out')) active.current = Date.now();
        return fresh.length ? [...old, ...fresh.map((m) => ({ id: m.wamid, at: m.at, mine: m.dir === 'in', body: m.body, options: m.options ?? [] }))] : old;
      });
    } catch { /* offline: the next poll tries again */ } finally { setReady(true); }
  }, [url]);

  useEffect(() => { session.current = sessionId(); }, []);
  useEffect(() => {
    if (!open) return;
    let alive = true, timer = 0;
    const next = () => {
      clearTimeout(timer);
      const wait = every(Date.now() - active.current);
      if (alive && wait) timer = window.setTimeout(async () => { if (document.visibilityState === 'visible') await poll(); next(); }, wait);
    };
    wake.current = () => { active.current = Date.now(); next(); };
    const back = () => { if (document.visibilityState === 'visible' && alive) { void poll(); next(); } };
    active.current = Date.now();
    input.current?.focus();
    void poll().then(next);
    document.addEventListener('visibilitychange', back);
    return () => { alive = false; clearTimeout(timer); wake.current = () => {}; document.removeEventListener('visibilitychange', back); };
  }, [open, poll]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [lines]);

  async function send(message: { text: string } | { reply: Option }) {
    setError(null);
    wake.current();
    const temp = `me-${Date.now()}`;
    setLines((old) => [...old, { id: temp, at: new Date().toISOString(), mine: true, body: 'text' in message ? message.text : message.reply.title, options: [] }]);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: session.current, ...message }) });
      const b = (await r.json().catch(() => ({}))) as { id?: string; error?: string; erased?: boolean; notice?: string };
      if (r.ok && b.erased) {                                // DELETE MY DATA: nothing of this chat is kept, here either
        session.current = sessionId(true);
        after.current = '';
        setLines([{ id: `notice-${Date.now()}`, at: new Date().toISOString(), mine: false, body: b.notice ?? '', options: [] }]);
        return;
      }
      if (r.ok && b.id) {
        const id = b.id;
        setLines((old) => (old.some((l) => l.id === id) ? old.filter((l) => l.id !== temp) : old.map((l) => (l.id === temp ? { ...l, id } : l))));
        setTimeout(() => void poll(), 1500);
        return;
      }
      setError(b.error === 'busy' ? { text: 'The chat is busy right now.', whatsapp: true }
        : b.error === 'rate-limited' ? { text: 'Too many messages at once: please wait a minute.' }
        : b.error === 'old-button' ? { text: 'That choice is no longer open: please type your answer.' }
        : { text: 'That did not go through. Please try again.' });
    } catch { setError({ text: 'You seem to be offline. Please try again.' }); }
    setLines((old) => old.filter((l) => l.id !== temp));
  }

  // the buttons of the bot's latest message that had any, until the client answers (as on WhatsApp)
  const lastMine = lines.findLastIndex((l) => l.mine);
  const offered = lines.findLastIndex((l, i) => !l.mine && l.options.length > 0 && i > lastMine);
  return (
    <section id="chat-panel" className="chat-panel" role="dialog" aria-label="Chat with Legit Forge" hidden={!open} data-lenis-prevent
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.nativeEvent.isComposing) { e.preventDefault(); onClose(); } }}
      onFocus={() => wake.current()}>
      <header className="chat-head">
        <strong>Legit Forge</strong> <span>Automated assistant · our team replies here too</span>
        <button type="button" className="chat-x" onClick={onClose} aria-label="Close the chat">×</button>
      </header>
      <div className="chat-log" role="log" aria-live={ready ? 'polite' : 'off'}>
        {!lines.length && <p className="chat-hint">Say hi to start. Replies in English, Malayalam, Hindi, Kannada or Tamil. <a href="/privacy">Privacy</a></p>}
        {lines.map((l, i) => (
          <div key={l.id} className={`chat-line${l.mine ? ' is-mine' : ''}`}>
            <p>{l.mine ? l.body : <Linked text={l.body} />}</p>
            {i === offered && (
              <div className="chat-options">
                {l.options.map((o) => <button key={o.id} type="button" onClick={() => void send({ reply: o })}>{o.title}</button>)}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <p className="chat-error" role="alert">{error.text}{error.whatsapp && <> <a href={waLink(company)}>Message us on WhatsApp</a>.</>}</p>}
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(''); void send({ text: t.slice(0, 1000) }); } }}>
        <label className="sr-only" htmlFor="chat-input">Your message</label>
        <textarea id="chat-input" ref={input} rows={1} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;               // Enter that confirms an input-method word
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
          }} placeholder="Type a message" />
        <button type="submit" className="btn btn-primary btn-sm">Send</button>
      </form>
    </section>
  );
}
