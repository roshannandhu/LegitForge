import { PunchIn } from '@/components/motion/punch-in';
import { TRUST_INTRO, TRUST_LINES } from '@/lib/content';

/** Trust strip (PLAN §18.6): what we build in one sentence, then four promises we keep.
 *  Right under the hero, so the first scroll answers "can I trust these two?". As the Cleave
 *  opens, each promise's hallmark is punched in, like an assay mark on metal (plan D #2). */
export function TrustStrip() {
  return (
    <section className="trust wrap" aria-label="What we build and what we promise">
      <p className="trust-intro">{TRUST_INTRO}</p>
      <PunchIn as="ul" className="trust-list">
        {TRUST_LINES.map((t, i) => (
          <li key={t.k} style={{ '--i': i } as React.CSSProperties}>
            <span className="punch" data-punch aria-hidden="true">{t.mark}</span>
            <strong>{t.k}</strong> {t.v}
          </li>
        ))}
      </PunchIn>
    </section>
  );
}
