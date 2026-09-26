'use client';

/** Quench — the final call to action (PLAN §6.11). The only centred section.
 *  Validation runs on submit (button stays enabled); focus moves to the first error;
 *  every error sits under its field and is linked with aria-describedby. */

import { useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { CoinMark } from '@/components/ui/icons';
import { replyByLabel } from '@/lib/business-hours';
import { BUDGETS, HONEYPOT, NEEDS, validateLead, type LeadErrors, type LeadField } from '@/lib/lead';
import { SITE, waLink } from '@/lib/site';
import { Turnstile, type TurnstileHandle } from './turnstile';

type State = 'idle' | 'sending' | 'sent' | 'error' | 'limited' | 'unverified';

export function Quench() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [state, setState] = useState<State>('idle');
  const [replyBy, setReplyBy] = useState('');
  const [armed, setArmed] = useState(false);          // Turnstile loads on the form's first focus
  const turnstile = useRef<TurnstileHandle>(null);
  const { resolvedTheme } = useTheme();

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const data = new FormData(form);
    const showErrors = (found: LeadErrors) => {
      setErrors(found);
      const first = (Object.keys(found) as LeadField[])[0];
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return !!first;
    };
    if (showErrors(validateLead(data).errors)) return;

    setState('sending');
    try {
      const res = await fetch('/api/leads', { method: 'POST', body: data });
      turnstile.current?.reset();                     // tokens are single-use, whatever happened
      if (res.status === 429) { setState('limited'); return; }
      if (res.status === 400 && ((await res.clone().json().catch(() => ({}))) as { error?: string }).error === 'verification_failed') {
        setState('unverified');
        return;
      }
      if (res.status === 422) {                          // server is the real check
        const body = (await res.json()) as { errors?: LeadErrors };
        setState('idle');
        showErrors(body.errors ?? {});
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setReplyBy(replyByLabel());
      setState('sent');
      form.reset();
    } catch {
      setState('error');
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
        <a className="btn btn-primary quench-wa" href={waLink()}>Chat on WhatsApp</a>
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
            <a className="btn btn-ghost" href={waLink()}>Open WhatsApp now</a>
          </div>
        ) : (
          <form ref={formRef} className="lead-form" onSubmit={onSubmit} onFocus={() => setArmed(true)} noValidate>
            {/* honeypot: hidden from people and assistive tech; bots fill it */}
            <div className="hp" aria-hidden="true">
              <label htmlFor={HONEYPOT}>Leave this empty</label>
              <input id={HONEYPOT} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" autoComplete="name" maxLength={80}
                     aria-invalid={!!errors.name} aria-describedby={describe('name')} />
              <Err f="name" />
            </div>

            <div className="field">
              <label htmlFor="phone">WhatsApp number</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210"
                     aria-invalid={!!errors.phone} aria-describedby={describe('phone')} />
              <Err f="phone" />
            </div>

            <div className="field">
              <label htmlFor="need">What do you need?</label>
              <select id="need" name="need" defaultValue="" aria-invalid={!!errors.need} aria-describedby={describe('need')}>
                <option value="" disabled>Choose one</option>
                {NEEDS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Err f="need" />
            </div>

            <div className="field">
              <label htmlFor="budget">Budget <span className="optional">(optional)</span></label>
              <select id="budget" name="budget" defaultValue="">
                <option value="">Choose a range</option>
                {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="field field-wide">
              <label htmlFor="message">Message <span className="optional">(optional)</span></label>
              <textarea id="message" name="message" rows={4} maxLength={1500}
                        aria-invalid={!!errors.message} aria-describedby={describe('message')} />
              <Err f="message" />
            </div>

            <div className="field field-wide field-check">
              <input id="consent" name="consent" type="checkbox" value="yes"
                     aria-invalid={!!errors.consent} aria-describedby={describe('consent')} />
              <label htmlFor="consent">Contact me on WhatsApp about this request.</label>
              <Err f="consent" />
            </div>

            <Turnstile ref={turnstile} armed={armed} theme={resolvedTheme} />

            <div className="field-wide form-actions">
              <button type="submit" className="btn btn-primary" data-sending={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send project details'}
              </button>
              <p className="form-promise">No payment until you approve a written quote.</p>
            </div>

            {state === 'error' && (
              <p className="form-alert" role="alert">
                Your details didn’t send because our server didn’t respond. Try again, or{' '}
                <a href={waLink()}>message us on WhatsApp</a>.
              </p>
            )}
            {state === 'unverified' && (
              <p className="form-alert" role="alert">
                We couldn’t confirm you’re human. Refresh the page and try again, or{' '}
                <a href={waLink()}>message us on WhatsApp</a>.
              </p>
            )}
            {state === 'limited' && (
              <p className="form-alert" role="alert">
                You’ve sent several requests in the last hour. <a href={waLink()}>Message us on WhatsApp</a> instead.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
