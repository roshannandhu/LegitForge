import { SERVICES } from '@/lib/content';
import { ServiceDemo } from './service-demos';

/** Services, "What we offer" (PLAN §6.3; was "Four fires"). Each service proves itself with a demo.
 *  This is the finished-frame layout: correct with no JS, and the motion-off state.
 *  While a demo's flow runs, its number and frame warm up, and cool on the hold (plan D #3). */
export function Services() {
  return (
    <section id="services" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">What we offer</h2>
          <p className="type-lead">Everything we offer businesses, from websites to signage subscriptions — each one shown working, not described.</p>
        </header>

        <ol className="fires">
          {SERVICES.map((s, i) => (
            <li key={s.id} className="fire">
              <div className="fire-copy">
                <span className="fire-num num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="type-h3">{s.name}</h3>
                <p className="fire-line">{s.line}</p>
                <p className="fire-for"><span className="type-label">For</span> {s.audience}</p>
                <p className="fire-price"><span className="num">{s.price}</span> <span className="fire-time">{s.time}</span></p>
                <a className="text-link" href={s.href}>{s.link}</a>
              </div>
              <div className="fire-stage">
                <ServiceDemo kind={s.id} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
