import { HOME_SERVICES } from '@/lib/content';

/** A short service ledger. Animated examples remain on the linked service pages. */
export function Services() {
  return (
    <section id="services" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">What we offer</h2>
          <p className="type-lead">Start with the problem you want to solve. Every build gets a fixed written quote; each service page shows the details and an example.</p>
        </header>

        <ol className="service-ledger">
          {HOME_SERVICES.map((s, i) => (
            <li key={s.id} data-service={s.id}>
                <span className="fire-num num">{String(i + 1).padStart(2, '0')}</span>
              <div className="service-ledger-copy">
                <h3 className="type-h3">{s.name}</h3>
                <p className="fire-line">{s.line}</p>
              </div>
              <div className="service-ledger-details">
                <p className="num">{s.time}</p>
                <a className="text-link" href={s.href}>{s.link}</a>
              </div>
            </li>
          ))}
        </ol>
        <p className="section-more"><a className="text-link" href="#contact">Send project details</a> — we’ll help you choose the smallest thing that solves it.</p>
      </div>
    </section>
  );
}
