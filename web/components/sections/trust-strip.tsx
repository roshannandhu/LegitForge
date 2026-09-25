import { TRUST_INTRO, TRUST_LINES } from '@/lib/content';

/** Trust strip (PLAN §18.6): what we build in one sentence, then four promises we keep.
 *  Right under the hero, so the first scroll answers "can I trust these two?". Static on purpose. */
export function TrustStrip() {
  return (
    <section className="trust wrap" aria-label="What we build and what we promise">
      <p className="trust-intro">{TRUST_INTRO}</p>
      <ul className="trust-list">
        {TRUST_LINES.map((t) => (
          <li key={t.k}><strong>{t.k}</strong> {t.v}</li>
        ))}
      </ul>
    </section>
  );
}
