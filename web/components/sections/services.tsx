import { SERVICES } from '@/lib/content';
import { ServiceDemo } from './service-demos';

/** Services "Four fires" (PLAN §6.3). Each service proves itself with a demo.
 *  This is the finished-frame layout: correct with no JS, and the motion-off state. */
export function Services() {
  return (
    <section id="services" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">What we build</h2>
          <p className="type-lead">Four things we build for businesses — each one shown working, not described.</p>
        </header>

        <ol className="fires">
          {SERVICES.map((s, i) => (
            <li key={s.id} className="fire">
              <div className="fire-copy">
                <span className="fire-num num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="type-h3">{s.name}</h3>
                <p className="fire-line">{s.line}</p>
                <p className="fire-for"><span className="type-label">For</span> {s.audience}</p>
                <p className="fire-price num">{s.price}</p>
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
