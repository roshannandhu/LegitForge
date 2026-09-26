'use client';

/** Small client pieces the admin forms share: a form that shows its Server Action's answer,
 *  and a submit button that says when it is working. */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
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

/** A one-button form for an action that may refuse (publishing a testimonial). */
export function ActionButton({ action, children, className = 'btn btn-ghost btn-sm' }: {
  action: () => Promise<FormState>; children: React.ReactNode; className?: string;
}) {
  const [state, run] = useActionState(async () => action(), undefined);
  return (
    <form action={run} className="admin-inline">
      <Submit className={className} pending="…">{children}</Submit>
      {state?.error && <span className="admin-msg is-error" role="alert">{state.error}</span>}
    </form>
  );
}
