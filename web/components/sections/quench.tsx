'use client';

/** Quench — the final call to action (PLAN §6.11). The only centred section.
 *  Validation runs on submit (button stays enabled); focus moves to the first error;
 *  every error sits under its field and is linked with aria-describedby. */

import { useRef, useState } from 'react';
import { CoinMark } from '@/components/ui/icons';
import { replyByLabel } from '@/lib/business-hours';
import { BUDGETS, HONEYPOT, NEEDS, validateLead, type LeadErrors, type LeadField } from '@/lib/lead';
import { SITE, waLink } from '@/lib/site';
import { useCompany } from '@/components/company-context';
import { Turnstile, type TurnstileHandle } from './turnstile';

type State = 'idle' | 'sending' | 'sent' | 'error' | 'limited' | 'unverified';

export function Quench() {
  const company = useCompany();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [state, setState] = useState<State>('idle');
  const [replyBy, setReplyBy] = useState('');
  const [armed, setArmed] = useState(false);          // Turnstile loads on the form's first focus
  const turnstile = useRef<TurnstileHandle>(null);
  const pending = useRef(false);
  const submission = useRef<{ fingerprint: string; id: string } | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (pending.current) return;
    const form = ev.currentTarget;
    const data = new FormData(form);
    const showErrors = (found: LeadErrors) => {
      setErrors(found);
      const first = (Object.keys(found) as LeadField[])[0];
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return !!first;
    };
    const validated = validateLead(data);
    if (showErrors(validated.errors)) return;
    const fingerprint = JSON.stringify(validated.lead);
    if (submission.current?.fingerprint !== fingerprint) {
      submission.current = { fingerprint, id: crypto.randomUUID() };
    }
    data.set('submission_id', submission.current.id);

    pending.current = true;
    setState('sending');
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      const body = await res.json().catch(() => null) as {
        ok?: boolean; stored?: boolean; error?: string; errors?: LeadErrors;
      } | null;
      if (res.status === 429) { setState('limited'); return; }
      if (body?.error === 'verification_failed') {
        setState('unverified');
        return;
      }
      if (res.status === 422) {                          // server is the real check
        setState('idle');
        showErrors(body?.errors ?? {});
        return;
      }
      if (!res.ok || body?.ok !== true || body.stored !== true) throw new Error('receipt-unconfirmed');
      setReplyBy(replyByLabel());
      setState('sent');
      form.reset();
      submission.current = null;
    } catch {
      setState('error');
    } finally {
      pending.current = false;
      turnstile.current?.reset();                    // a new attempt needs a fresh challenge; accepted retries use their receipt
    }
  }

  const describe = (f: LeadField) => (errors[f] ? `${f}-error` : undefined);
  const Err = ({ f }: { f: LeadField }) =>
    errors[f] ? <p className="field-error" id={`${f}-error`}>{errors[f]}</p> : null;

  return (
    <section id="contact" data-heat="0.05" className="section quench">
      <div className="wrap quench-inner">
        <h2 className="type-h2">Tell us what you want to build.</h2>
        <p className="type-lead">Most projects start with a 20-minute chat. No pressure, no jargon.</p>
        <a className="btn btn-primary quench-wa" href={waLink(company)}>Chat on WhatsApp</a>
        <p className="quench-or">or send the details</p>

        {state === 'sent' ? (
          // the quench (plan D #12): a puff of steam, then our seal stamps RECEIVED with the reply-by time
          <div className="form-sent" role="status">
            <div className="sent-seal" aria-hidden="true">
              <i className="steam" /><i className="steam" /><i className="steam" />
              <span className="sent-coin"><CoinMark /></span>
              <span className="stamp stamp-ok sent-stamp">Received</span>
            </div>
            <p className="sent-by">
              {replyBy ? <>We’ll reply on WhatsApp by <strong>{replyBy}</strong>{replyBy.endsWith('.') ? '' : '.'}</> : <>We’ll reply on WhatsApp within <strong>{SITE.replyWithin}</strong>.</>}
            </p>
            <p className="sent-note">Details received. We usually reply within {SITE.replyWithin} during working hours.</p>
            <a className="btn btn-ghost" href={waLink(company)}>Open WhatsApp now</a>
          </div>
        ) : (
          <form ref={formRef} className="lead-form" method="post" action="/api/leads" onSubmit={onSubmit} onFocus={() => setArmed(true)} aria-busy={state === 'sending'} noValidate>
            {/* honeypot: hidden from people and assistive tech; bots fill it */}
            <div className="hp" aria-hidden="true">
              <label htmlFor={HONEYPOT}>Leave this empty</label>
              <input id={HONEYPOT} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" autoComplete="name" maxLength={80} minLength={2} required readOnly={state === 'sending'}
                     aria-invalid={!!errors.name} aria-describedby={describe('name')} />
              <Err f="name" />
            </div>

            <div className="field">
              <label htmlFor="phone">WhatsApp number</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required readOnly={state === 'sending'}
                     aria-invalid={!!errors.phone} aria-describedby={describe('phone')} />
              <Err f="phone" />
            </div>

            <div className="field">
              <label htmlFor="need">What do you need?</label>
              <select id="need" name="need" defaultValue="" required disabled={state === 'sending'} aria-invalid={!!errors.need} aria-describedby={describe('need')}>
                <option value="" disabled>Choose one</option>
                {NEEDS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Err f="need" />
            </div>

            {BUDGETS.length > 1 && <div className="field">
              <label htmlFor="budget">Budget <span className="optional">(optional)</span></label>
              <select id="budget" name="budget" defaultValue="" disabled={state === 'sending'}>
                <option value="">Choose a range</option>
                {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>}

            <div className="field field-wide">
              <label htmlFor="message">Message <span className="optional">(optional)</span></label>
              <textarea id="message" name="message" rows={4} maxLength={1500} readOnly={state === 'sending'}
                        aria-invalid={!!errors.message} aria-describedby={describe('message')} />
              <Err f="message" />
            </div>

            <div className="field field-wide field-check">
              <input id="consent" name="consent" type="checkbox" value="yes" required disabled={state === 'sending'}
                     aria-invalid={!!errors.consent} aria-describedby={describe('consent')} />
              <label htmlFor="consent">Contact me on WhatsApp about this request.</label>
              <Err f="consent" />
            </div>

            <Turnstile ref={turnstile} armed={armed} />
            <noscript>
              <p className="field-wide form-alert">
                This form submits securely without JavaScript. If human verification is required,{' '}
                <a href={waLink(company)}>contact us on WhatsApp</a>
                {company.contactEmail && <> or <a href={`mailto:${company.contactEmail}`}>email us</a></>} instead.
              </p>
            </noscript>

            <div className="field-wide form-actions">
              <button type="submit" className="btn btn-primary" disabled={state === 'sending'} data-sending={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send project details'}
              </button>
              <p className="form-promise">No payment until you approve a written quote.</p>
            </div>

            {state === 'error' && (
              <p className="form-alert" role="alert">
                We couldn’t confirm receipt. Your details are still here; retrying won’t create another enquiry. Try again, or{' '}
                <a href={waLink(company)}>message us on WhatsApp</a>.
              </p>
            )}
            {state === 'unverified' && (
              <p className="form-alert" role="alert">
                We couldn’t confirm you’re human. Refresh the page and try again, or{' '}
                <a href={waLink(company)}>message us on WhatsApp</a>.
              </p>
            )}
            {state === 'limited' && (
              <p className="form-alert" role="alert">
                You’ve sent several requests in the last hour. <a href={waLink(company)}>Message us on WhatsApp</a> instead.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
