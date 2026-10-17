'use client';

/** The website chat bubble (phase 7): the WhatsApp bot, on the site. Only the button ships with
 *  the page; the panel (chat-panel.tsx) loads on the first tap. Shown only when the bot's chat
 *  address is set at build time (NEXT_PUBLIC_BOT_CHAT_URL), and never in the admin. */

import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCompany } from '@/components/company-context';
import { waLink } from '@/lib/site';

const CHAT_URL = (process.env.NEXT_PUBLIC_BOT_CHAT_URL ?? '').replace(/\/+$/, '');

/** The panel's code did not load (a dropped connection, or a deploy since the page opened). */
function Unavailable({ open, onClose }: { url?: string; open: boolean; onClose: () => void }) {
  const company = useCompany();
  return (
    <section id="chat-panel" className="chat-panel chat-panel-down" role="dialog" aria-label="Chat with Legit Forge" hidden={!open}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <p>The chat could not load. Reload the page to try again, or <a href={waLink(company)}>message us on WhatsApp</a>.</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
    </section>
  );
}

const Panel = lazy(() => import('./chat-panel').catch(() => ({ default: Unavailable })));

export function ChatBubble() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);   // back to the bubble, not the page's top
  if (!CHAT_URL || path.startsWith('/admin')) return null;
  return (
    <>
      <button ref={button} type="button" className="chat-bubble" aria-expanded={open} aria-controls="chat-panel"
        onClick={() => { setLoaded(true); setOpen((o) => !o); }}>
        <span aria-hidden="true">💬</span> <span>{open ? 'Close chat' : 'Chat with us'}</span>
      </button>
      {loaded && <Suspense fallback={null}><Panel url={CHAT_URL} open={open} onClose={close} /></Suspense>}
    </>
  );
}
