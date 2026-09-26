/** Quotation and warranty system (PLAN §6.3b). Our own product, and the plainest proof
 *  that we ship real software. The mock plays as a working flow when it comes into view
 *  (demos.ts "quote"): the markup is its finished frame. The request arrives as a WhatsApp
 *  message, the quote grows out of it, and our coin seal presses ACCEPTED into it (plan D #4). */

import { CoinMark } from '@/components/ui/icons';
import { DemoPlayer } from './demo-player';
import { DemoTranscript } from './demo-transcript';

const POINTS = [
  { h: 'Quote', p: 'Build a quote from saved line items, send it as a link or PDF, and see when it was opened. Accepted quotes are timestamped and stored.' },
  { h: 'Warranty', p: 'Every completed job gets a warranty record with a serial or QR code. Your customer scans it and sees what is covered, until when, and how to claim.' },
  { h: 'Reminders', p: 'Expiry reminders and claim requests go out on WhatsApp automatically — the same automation we build for clients.' },
];

export function Quotation() {
  return (
    <section id="quotation" data-heat="0.55" className="section">
      <div className="wrap quote-grid">
        <div className="quote-copy">
          <h2 className="type-h2">Quotes that look professional. Warranties customers can check.</h2>
          <p className="type-lead">Our own product, and the plainest answer to “can these two build real software?”</p>
          <ol className="quote-points">
            {POINTS.map((pt) => (
              <li key={pt.h}><h3 className="type-h3">{pt.h}</h3><p>{pt.p}</p></li>
            ))}
          </ol>
          <p className="quote-trust">
            Your quotes and warranty records are your data. Export everything as CSV at any time,
            including if you leave us.
          </p>
        </div>

        <DemoPlayer kind="quote">
        <div className="quote-mock" aria-hidden="true">
          <p className="qm-bubble">Hi, can I get a quote for a split AC? <span className="qm-bubble-time">10:42</span></p>
          <div className="qm qm-quote">
            <div className="qm-head"><span className="qm-kicker num">Quote Q-2041</span><span className="stamp stamp-ok">Accepted</span></div>
            <p className="qm-title">Split AC installation</p>
            <ul className="qm-lines num">
              <li><span>1.5 ton split AC</span><span>₹38,500</span></li>
              <li><span>Installation and copper kit</span><span>₹4,200</span></li>
              <li><span>Stabiliser</span><span>₹3,100</span></li>
            </ul>
            <p className="qm-total num"><span>Total</span><span>₹45,800</span></p>
            <p className="qm-meta">Opened twice · accepted 14 Sep</p>
            {/* our seal accepts it (plan D #4): the logo coin, pressed into the paper */}
            <span className="qm-seal"><CoinMark /></span>
          </div>

          <svg className="qm-link" viewBox="0 0 40 120" preserveAspectRatio="none"><path d="M20 0 V120" /></svg>

          <div className="qm qm-warranty">
            <div className="qm-head"><span className="qm-kicker">Warranty check</span><span className="stamp stamp-ok">Valid</span></div>
            <dl className="qm-facts">
              <div><dt>Serial</dt><dd className="num">LF-AC-88213</dd></div>
              <div><dt>Covers</dt><dd>Parts and labour</dd></div>
              <div><dt>Until</dt><dd className="num">14 Sep 2027</dd></div>
            </dl>
            <span className="qm-claim">Claim on WhatsApp</span>
            <i className="qm-scan" />
          </div>
          <span className="qm-remind">Expiry reminder set on WhatsApp <b>✓✓</b></span>
        </div>
        </DemoPlayer>
        <DemoTranscript kind="quote" />
      </div>
    </section>
  );
}
