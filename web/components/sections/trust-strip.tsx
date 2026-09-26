import { PunchIn } from '@/components/motion/punch-in';
import { TRUST_INTRO, TRUST_LINES, TRUST_TITLE } from '@/lib/content';

/** Trust strip (PLAN §18.6): what we build, then four promises we keep, forged in front of you.
 *  Right under the hero, so the first scroll answers "can I trust these two?".
 *
 *  As the Cleave opens (data-open), each plate arrives red-hot, a press strikes its hallmark
 *  (plan D #2's punch, with a spark burst), the plate cools to brushed steel and its little
 *  machine runs once; then a white-hot weld joins the four. Pure CSS, transform and opacity
 *  only (sections.css "trust strip"). Without JS or with motion off it is simply the finished,
 *  cooled, stamped frame: the animations only exist while PunchIn has armed a plate. */

const ICONS: Record<(typeof TRUST_LINES)[number]['icon'], React.ReactNode> = {
  lock: (
    <span className="ti ti-lock">
      <span className="ti-price num">₹45,800</span>
      <svg viewBox="0 0 24 28" width="26" height="30">
        <path className="ti-shackle" d="M7 12V8a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="3" y="12" width="18" height="14" rx="3" fill="currentColor" />
        <circle cx="12" cy="19" r="2" className="ti-hole" />
      </svg>
    </span>
  ),
  weeks: (
    <span className="ti ti-weeks">
      {[1, 2, 3, 4].map((w) => (
        <span key={w} className="ti-week" style={{ '--w': w } as React.CSSProperties}>
          <small>W{w}</small>
          <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      ))}
      <span className="ti-chip">Preview ready</span>
    </span>
  ),
  key: (
    <span className="ti ti-key">
      <svg viewBox="0 0 32 16" width="40" height="20">
        <g className="ti-keyart">
          <circle cx="7" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="M12 8h17M24 8v4M28 8v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
      <span className="ti-drops">
        {['Code', 'Domain', 'WhatsApp', 'Workflows'].map((c, i) => (
          <span key={c} style={{ '--d': i } as React.CSSProperties}>{c}</span>
        ))}
      </span>
    </span>
  ),
  meter: (
    <span className="ti ti-meter">
      <b className="num">30</b>
      <span className="ti-bar"><i /></span>
    </span>
  ),
};

export function TrustStrip() {
  return (
    <section className="trust wrap" aria-labelledby="trust-h">
      <div className="trust-head">
        <h2 id="trust-h" className="type-h2">{TRUST_TITLE}</h2>
        <p className="trust-intro">{TRUST_INTRO}</p>
      </div>
      <ul className="trust-list">
        {TRUST_LINES.map((t, i) => (
          <PunchIn as="li" key={t.k} className="trust-plate" threshold={0.6} style={{ '--i': i } as React.CSSProperties}>
            <span className="press" aria-hidden="true" />
            <span className="sparks" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((s) => <i key={s} style={{ '--s': s } as React.CSSProperties} />)}</span>
            <span className="punch" data-punch aria-hidden="true">{t.mark}</span>
            <span aria-hidden="true">{ICONS[t.icon]}</span>
            <strong>{t.k}</strong> {t.v}
          </PunchIn>
        ))}
        <PunchIn as="li" className="trust-weld" threshold={1} aria-hidden>{null}</PunchIn>
      </ul>
    </section>
  );
}
