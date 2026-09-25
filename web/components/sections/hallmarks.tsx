import { MAKERS_PROMISE, TESTIMONIALS, WONT_DO } from '@/lib/content';
import { SITE } from '@/lib/site';
import { SnapToGrid } from '@/components/motion/snap-to-grid';

/** Proof wall "Hallmarks" (PLAN §6.9). Only the quietest motion here, C8 snap to grid (§23.4):
 *  after all the motion above, near-stillness reads as confidence.
 *  Testimonials render only once a client has given written permission; until then the
 *  heading promises only what we can back — our own commitments. */
export function Hallmarks() {
  const hasTestimonials = TESTIMONIALS.length > 0;

  return (
    <section id="proof" data-heat="0.45" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">{hasTestimonials ? 'What clients say' : 'What we promise, in writing'}</h2>
        </header>

        {hasTestimonials && (
          <ul className="testimonials">
            {TESTIMONIALS.map((t) => (
              <li key={t.name} data-snap>
                <blockquote><p>{t.quote}</p></blockquote>
                <p className="t-by"><strong>{t.name}</strong>, {t.role}, {t.company}</p>
              </li>
            ))}
          </ul>
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
