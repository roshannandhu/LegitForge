import { FAQ, PRICING } from '@/lib/content';
import { PunchIn } from '@/components/motion/punch-in';

const SCALE_WEEKS = 6;   // the timeline bars share one scale, so rows compare at a glance (plan D #11)

/** Pricing and FAQ (PLAN §6.10). One row per service, not identical cards.
 *  FAQ uses native <details>: keyboard and screen-reader support for free. */
export function PricingFaq({ compact = false }: { compact?: boolean }) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section id="pricing" data-heat="0.45" className={`section${compact ? ' pricing-compact' : ''}`}>
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Quotes and timelines.</h2>
          <p className="type-lead">Tell us what needs to work. We agree the deliverables, cost and timing with you before the project starts.</p>
        </header>

        <details className="quote-details" open={!compact}>
        <summary>How each service is quoted, and typical delivery times</summary>
        <PunchIn className="price-table-wrap" threshold={0.3}>
          <table className="price-table">
            <caption className="sr-only">Quote basis, typical time and what is included, by service</caption>
            <thead>
              <tr><th scope="col">Service</th><th scope="col">Quote basis</th><th scope="col">Typical time</th><th scope="col">Includes</th></tr>
            </thead>
            <tbody>
              {PRICING.map((r, i) => (
                <tr key={r.service} style={{ '--i': i } as React.CSSProperties}>
                  <th scope="row">{r.service}</th>
                  <td data-label="Quote basis" className="num">{r.from}</td>
                  <td data-label="Typical time" className="num">
                    <span className="tl-cell">
                      {r.time}
                      <span className="tl-bar" aria-hidden="true" style={{ '--a': r.weeks[0] / SCALE_WEEKS, '--b': r.weeks[1] / SCALE_WEEKS } as React.CSSProperties}><i className="tl-fill" /></span>
                    </span>
                  </td>
                  <td data-label="Includes">{r.includes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PunchIn>
        <p className="price-scale" aria-hidden="true">Bars show the typical time on a {SCALE_WEEKS}-week scale.</p>
        </details>

        <div className="faq">
          <h2 className="type-h2 faq-h" id="faq">Questions people ask us</h2>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }}
      />
    </section>
  );
}
