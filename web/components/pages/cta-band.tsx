import { SITE, waLink } from '@/lib/site';

/** The closing call to action on inner pages. Same labels everywhere (PLAN §18.3). */
export function CtaBand({ title = 'Tell us what you want to build.', text, waText }: {
  title?: string; text?: string; waText?: string;
}) {
  return (
    <section className="cta-band wrap" aria-labelledby="cta-h">
      <div className="cta-card">
        <h2 id="cta-h" className="type-h3 cta-title">{title}</h2>
        <p className="cta-text">
          {text ?? `A 20-minute chat, then a fixed quote in writing. We reply within ${SITE.replyWithin} during working hours.`}
        </p>
        <div className="page-actions">
          <a className="btn btn-primary" href={waLink(waText)}>Chat on WhatsApp</a>
          <a className="btn btn-ghost" href="/contact">Send project details</a>
        </div>
      </div>
    </section>
  );
}
