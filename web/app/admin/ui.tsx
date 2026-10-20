'use client';

/** Small client pieces the admin forms share: a form that shows its Server Action's answer,
 *  and a submit button that says when it is working. */

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import type { FormState } from './actions';

const Busy = createContext<boolean | null>(null);

/** A form that shows its Server Action's answer. It submits by hand (onSubmit), not through
 *  <form action>: React resets a form after its action runs, so a refused save ("the live URL
 *  must start with https://") used to wipe everything the owner had typed. `resetOnOk` clears
 *  it after a success, for "add another" forms. */
export function ActionForm({ action, children, className, resetOnOk = false }: {
  action: (s: FormState, f: FormData) => Promise<FormState>; children: React.ReactNode; className?: string; resetOnOk?: boolean;
}) {
  const [state, run, busy] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (resetOnOk && state?.ok) form.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={form} className={className} onSubmit={(e) => {
      e.preventDefault();
      if (busy) return;
      const data = new FormData(e.currentTarget);
      startTransition(() => run(data));
    }}>
      <Busy.Provider value={busy}>{children}</Busy.Provider>
      {state?.error && <p className="admin-msg is-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="admin-msg is-ok" role="status">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = 'btn btn-primary', pending = 'Saving…' }: {
  children: React.ReactNode; className?: string; pending?: string;
}) {
  const ctx = useContext(Busy);
  const { pending: status } = useFormStatus();
  const busy = ctx ?? status;
  return <button type="submit" className={className} disabled={busy} aria-busy={busy}>{busy ? pending : children}</button>;
}

/** A submit button that asks first (deleting an image or a testimonial): one stray click can't
 *  remove something for good. */
export function ConfirmSubmit({ children, message, className = 'btn btn-ghost btn-sm btn-danger' }: {
  children: React.ReactNode; message: string; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{pending ? '…' : children}</button>
  );
}

/** Section links (the admin's, or a section's own tabs), with the current one marked. `exact`:
 *  only that address, not the pages under it. */
export function AdminNav({ items, label = 'Admin', className = 'admin-nav' }: {
  items: { href: string; label: string; exact?: boolean }[]; label?: string; className?: string;
}) {
  const path = usePathname();
  const list = useRef<HTMLUListElement>(null);
  const current = (n: { href: string; exact?: boolean }) => path === n.href || (!n.exact && path.startsWith(n.href + '/'));
  // a phone shows a few at a time: bring the current one into view
  useEffect(() => { list.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [path]);
  return (
    <nav aria-label={label}>
      <ul ref={list} className={className}>{items.map((n) => (
        <li key={n.href}><a href={n.href} aria-current={current(n) ? 'page' : undefined}>{n.label}</a></li>
      ))}</ul>
    </nav>
  );
}

/** A fresh page every `seconds` while the tab is visible (the live view, the QR WhatsApp changes). */
export function Refresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

/** A one-button form for an action that may refuse (publishing a testimonial). */
export function ActionButton({ action, children, className = 'btn btn-ghost btn-sm' }: {
  action: () => Promise<FormState>; children: React.ReactNode; className?: string;
}) {
  const [state, run] = useActionState(async () => action(), undefined);
  return (
    <form action={run} className="admin-inline">
      <Submit className={className} pending="…">{children}</Submit>
      {state?.error && <span className="admin-msg is-error" role="alert">{state.error}</span>}
      {state?.ok && <span className="admin-msg is-ok" role="status">{state.ok}</span>}
    </form>
  );
}
