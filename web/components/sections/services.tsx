import { HOME_SERVICES } from '@/lib/content';
import { ServiceDemo } from './service-demos';
import { QuoteDemo } from './quotation';

/** Old bookmarks (/#app-example, /#quotation) land on their service here. */
const ANCHOR: Record<string, string> = { app: 'app-example', quote: 'quotation' };

/** What we offer (PLAN §6.3): each service with its demo beside it (the owner's call, 16 Oct).
 *  This is the finished-frame layout: correct with no JS, and the motion-off state.
 *  While a demo's flow runs, its number warms up (sections.css .fire:has(...)). */
export function Services() {
  return (
    <section id="services" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">What we offer</h2>
          <p className="type-lead">Everything we build for businesses, each one shown working. Every build gets a fixed written quote.</p>
        </header>

        <ol className="fires">
          {HOME_SERVICES.map((s, i) => (
            <li key={s.id} id={ANCHOR[s.id]} className="fire" data-service={s.id}>
              <div className="fire-copy">
                <span className="fire-num num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="type-h3">{s.name}</h3>
                <p className="fire-line">{s.line}</p>
                <p className="fire-for"><span className="type-label">For</span> {s.audience}</p>
                <p className="fire-price"><span className="fire-time">{s.time}</span></p>
                <a className="text-link" href={s.href}>{s.link}</a>
              </div>
              <div className="fire-stage">
                {s.id === 'quote' ? <QuoteDemo /> : <ServiceDemo kind={s.id} />}
              </div>
            </li>
          ))}
        </ol>
        <p className="section-more"><a className="text-link" href="#contact">Send project details</a> — we’ll help you choose the smallest thing that solves it.</p>
      </div>
    </section>
  );
}
