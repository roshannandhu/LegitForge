import { MAKERS_PROMISE, WONT_DO } from '@/lib/content';
import { getTestimonials } from '@/lib/testimonials';
import { PunchIn } from '@/components/motion/punch-in';
import { SITE } from '@/lib/site';
import { SnapToGrid } from '@/components/motion/snap-to-grid';

/** Proof wall "Hallmarks" (PLAN §6.9). Only the quietest motion here, C8 snap to grid (§23.4):
 *  after all the motion above, near-stillness reads as confidence.
 *  Testimonials render only once a client has given written permission; until then the
 *  heading promises only what we can back — our own commitments. Each quote carries a punched
 *  hallmark with the client's business and the month (plan D #10), struck in once. */
export async function Hallmarks() {
  const testimonials = await getTestimonials();
  const hasTestimonials = testimonials.length > 0;

  return (
    <section id="proof" data-heat="0.45" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">{hasTestimonials ? 'What clients say' : 'What we promise, in writing'}</h2>
        </header>

        {hasTestimonials && (
          <PunchIn as="ul" className="testimonials">
            {testimonials.map((t, i) => (
              <li key={t.name + t.quote.slice(0, 20)} data-snap style={{ '--i': i } as React.CSSProperties}>
                <span className="punch t-mark" data-punch aria-hidden="true">{[t.company || t.name, t.date].filter(Boolean).join(' · ')}</span>
                <blockquote><p>{t.quote}</p></blockquote>
                <p className="t-by"><strong>{t.name}</strong>{[t.role, t.company].filter(Boolean).map((x) => `, ${x}`).join('')}</p>
              </li>
            ))}
          </PunchIn>
        )}

        <div className="engraved-grid">
          <div className="engraved" data-snap>
            <h3 className="engraved-h">Maker’s promise</h3>
            <ul className="engraved-list">{MAKERS_PROMISE.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
          <div className="engraved" data-snap>
            <h3 className="engraved-h">What we won’t do</h3>
            <ul className="engraved-list">{WONT_DO.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        </div>

        <p className="proof-speed">
          We sell fast websites, so check ours:{' '}
          <a className="text-link" href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(SITE.url)}`} target="_blank" rel="noopener">
            test this page’s speed
          </a>.
        </p>
      </div>
      <SnapToGrid />
    </section>
  );
}
