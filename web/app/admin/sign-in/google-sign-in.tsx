'use client';

/** Google's own sign-in button (Google Identity Services, loaded on this page only). Google gives
 *  the browser a signed ID token; POST /api/admin/session checks it and signs the admin in.
 *  Nothing here decides who gets in: the server does (lib/admin/auth.ts). */

import Script from 'next/script';
import { useCallback, useRef, useState } from 'react';

type Gis = {
  initialize(o: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; auto_select: boolean; itp_support: boolean; ux_mode: 'popup' }): void;
  renderButton(el: HTMLElement, o: Record<string, string | number>): void;
  disableAutoSelect(): void;
};
declare global { interface Window { google?: { accounts: { id: Gis } } } }

export function GoogleSignIn({ clientId }: { clientId: string }) {
  const slot = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    const gis = window.google?.accounts.id;
    if (!gis || !slot.current) return;
    const { nonce } = (await (await fetch('/api/admin/session', { cache: 'no-store' })).json()) as { nonce: string };
    gis.initialize({
      client_id: clientId, nonce, auto_select: false, itp_support: true, ux_mode: 'popup',
      callback: async ({ credential }) => {
        setBusy(true);
        setMsg(null);
        const res = await fetch('/api/admin/session', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential }),
        });
        if (res.ok) { location.replace('/admin'); return; }
        setBusy(false);
        setMsg(res.status === 403 ? 'That Google account isn’t allowed into this admin.' : 'Sign-in didn’t work. Try again.');
        gis.disableAutoSelect();
        start();                                              // a fresh nonce for the next try
      },
    });
    gis.renderButton(slot.current, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: 280 });
  }, [clientId]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => void start()} />
      <div ref={slot} className="admin-google" aria-busy={busy} />
      {msg && <p className="admin-msg is-error" role="alert">{msg}</p>}
    </>
  );
}
