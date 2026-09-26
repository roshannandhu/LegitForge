/** Quotation and warranty system (PLAN §6.3b). Our own product, and the plainest proof
 *  that we ship real software. The mock is one living document on a lifecycle rail (plan F
 *  step 5): a WhatsApp enquiry becomes a quote, it is sent, opened, signed and sealed with our
 *  coin, installed, flips over into its warranty card (QR or NFC tap), and the reminder goes
 *  out. Then the next job starts, forever (demos.ts "quote" + its flow). The markup is the
 *  finished frame: the accepted, signed quote, with the warranty summary under it. */

import { CoinMark } from '@/components/ui/icons';
import { DemoPlayer } from './demo-player';
import { DemoTranscript } from './demo-transcript';

const POINTS = [
  { h: 'Quote', p: 'Build a quote from saved line items, send it as a link or PDF, and see when it was opened. Accepted quotes are timestamped and stored.' },
  { h: 'Warranty', p: 'Every completed job gets a warranty record with a serial or QR code. Your customer scans it and sees what is covered, until when, and how to claim.' },
  { h: 'Reminders', p: 'Expiry reminders and claim requests go out on WhatsApp automatically — the same automation we build for clients.' },
];

/** One quote's whole life, left to right: the rail over the demo (plan F step 5). */
const STAGES = ['Enquiry', 'Quote', 'Sent', 'Opened', 'Accepted', 'Installed', 'Warranty', 'Reminder'];

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
        <div className="quote-mock qx demo-quote" aria-hidden="true">
          {/* the lifecycle rail: every stage one quote goes through, all lit in the finished frame */}
          <ol className="qx-rail">
            {STAGES.map((s, i) => (
              <li key={s} className={`is-on${i === STAGES.length - 1 ? ' is-now' : ''}`}><i className="qx-dot" /><span>{s}</span></li>
            ))}
            <i className="qx-fill" />
          </ol>

          <p className="qm-bubble">Hi, can I get a quote for a split AC? <span className="qm-bubble-time">10:42</span></p>

          <div className="qx-stage">
            <div className="qx-card">
              <div className="qm qm-quote qx-front">
                <div className="qm-head"><span className="qm-kicker num">Quote Q-2041</span><span className="stamp stamp-ok qx-status">Accepted</span></div>
                <p className="qx-client">For Priya · Kochi</p>
                <p className="qm-title">Split AC installation</p>
                <ul className="qm-lines num">
                  <li><span>1.5 ton split AC</span><span>₹38,500</span></li>
                  <li><span>Installation and copper kit</span><span>₹4,200</span></li>
                  <li><span>Stabiliser</span><span>₹3,100</span></li>
                </ul>
                <p className="qm-total num"><span>Total</span><span>₹45,800</span></p>
                <p className="qm-meta">Delivered ✓✓ · opened twice · accepted 14 Sep</p>
                <div className="qx-sign">
                  <svg viewBox="0 0 120 36"><path d="M4 26 C 12 4, 22 6, 19 22 S 32 32, 39 15 S 51 7, 55 21 C 58 31, 65 11, 73 18 S 89 27, 99 12 L 116 9" /></svg>
                  <span className="qx-sign-by">Signed by Priya · 14 Sep, 10:58</span>
                </div>
                {/* our seal accepts it (plan D #4): the logo coin, pressed into the paper */}
                <span className="qm-seal"><CoinMark /></span>
              </div>

              <div className="qm qm-warranty qx-back">
                <div className="qm-head"><span className="qm-kicker">Warranty card</span><span className="stamp stamp-ok">Valid</span></div>
                <dl className="qm-facts">
                  <div><dt>Serial</dt><dd className="num">LF-AC-88213</dd></div>
                  <div><dt>Covers</dt><dd>Parts and labour</dd></div>
                  <div><dt>Installed</dt><dd className="num">16 Sep 2025</dd></div>
                  <div><dt>Until</dt><dd className="num">14 Sep 2027</dd></div>
                </dl>
                <div className="qx-check">
                  <span className="qx-qr"><svg viewBox="0 0 7 7" shapeRendering="crispEdges"><path d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z" /></svg><i className="qm-scan" /></span>
                  <span className="qx-tag"><span className="qx-waves"><i /><i /></span><span className="qx-phone" /></span>
                  <span className="qx-check-text">Scan the code or tap the NFC sticker on the AC</span>
                </div>
                <span className="qm-claim">Claim on WhatsApp</span>
              </div>
            </div>
          </div>

          <span className="qm-remind">Warranty to 14 Sep 2027 · reminder set on WhatsApp <b>✓✓</b></span>

          <dl className="qx-stats">
            <div><dt>Quotes this month</dt><dd className="num qx-count">42</dd></div>
            <div><dt>Accepted</dt><dd className="num">74%</dd></div>
            <div><dt>Time to accept</dt><dd className="num">1.8 days</dd></div>
          </dl>
          <p className="qx-note">Example figures</p>
        </div>
        </DemoPlayer>
        <DemoTranscript kind="quote" />
      </div>
    </section>
  );
}
