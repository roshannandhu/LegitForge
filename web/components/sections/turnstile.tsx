'use client';

/** Turnstile widget (PLAN §13.3). Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set at
 *  build time. The script (~30 KB, Cloudflare's) loads the first time the visitor focuses the
 *  form, never with the page, so the first-load budget (§11.1) is untouched. "interaction-only"
 *  keeps it invisible unless Cloudflare needs the visitor to click. Turnstile adds the hidden
 *  `cf-turnstile-response` input inside this box, so it submits with the form. */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile() {
  return (loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => { loading = undefined; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  }));
}

export const turnstileEnabled = !!SITE_KEY;

export interface TurnstileHandle { reset: () => void }

/** `armed`: load and render (the parent sets it on the form's first focus). */
export const Turnstile = forwardRef<TurnstileHandle, { armed: boolean; theme?: string }>(function Turnstile({ armed, theme }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);

  useImperativeHandle(ref, () => ({ reset: () => { if (id.current) window.turnstile?.reset(id.current); } }), []);

  useEffect(() => {
    if (!SITE_KEY || !armed || id.current) return;
    let alive = true;
    loadTurnstile().then((t) => {
      if (!alive || !box.current || id.current) return;
      id.current = t.render(box.current, {
        sitekey: SITE_KEY, appearance: 'interaction-only', theme: theme === 'dark' ? 'dark' : 'light',
        action: 'lead', 'refresh-expired': 'auto',
      });
    }).catch(() => {});                              // blocked script: the server answers 400, the form says so
    return () => { alive = false; };
  }, [armed, theme]);

  useEffect(() => () => { if (id.current) window.turnstile?.remove(id.current); }, []);

  if (!SITE_KEY) return null;
  return <div ref={box} className="turnstile field-wide" />;
});
