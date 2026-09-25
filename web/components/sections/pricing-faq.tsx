import { FAQ, PRICING } from '@/lib/content';

/** Pricing and FAQ (PLAN §6.10). One row per service, not identical cards.
 *  FAQ uses native <details>: keyboard and screen-reader support for free. */
export function PricingFaq() {
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
    <section id="pricing" data-heat="0.45" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Prices, up front</h2>
          <p className="type-lead">Every price here is a real starting price. Every project gets a fixed quote after a 20-minute call.</p>
        </header>

        <div className="price-table-wrap">
          <table className="price-table">
            <caption className="sr-only">Starting prices, typical time and what is included, by service</caption>
            <thead>
              <tr><th scope="col">Service</th><th scope="col">From</th><th scope="col">Typical time</th><th scope="col">Includes</th></tr>
            </thead>
            <tbody>
              {PRICING.map((r) => (
                <tr key={r.service}>
                  <th scope="row">{r.service}</th>
                  <td data-label="From" className="num">{r.from}</td>
                  <td data-label="Typical time" className="num">{r.time}</td>
                  <td data-label="Includes">{r.includes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
