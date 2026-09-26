'use client';

/** Small client pieces the admin forms share: a form that shows its Server Action's answer,
 *  and a submit button that says when it is working. */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { usePathname } from 'next/navigation';
import type { FormState } from './actions';

export function ActionForm({ action, children, className }: {
  action: (s: FormState, f: FormData) => Promise<FormState>; children: React.ReactNode; className?: string;
}) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      {children}
      {state?.error && <p className="admin-msg is-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="admin-msg is-ok" role="status">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = 'btn btn-primary', pending = 'Saving…' }: {
  children: React.ReactNode; className?: string; pending?: string;
}) {
  const { pending: busy } = useFormStatus();
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

/** The admin's section links, with the current one marked. */
export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
  return (
    <nav aria-label="Admin">
      <ul className="admin-nav">{items.map((n) => (
        <li key={n.href}><a href={n.href} aria-current={current(n.href) ? 'page' : undefined}>{n.label}</a></li>
      ))}</ul>
    </nav>
  );
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
