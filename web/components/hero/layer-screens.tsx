/** The seven live screens of the Teardown (PLAN §6.2c), as their FINAL frames. The flows in
 *  teardown-flows.ts play them from their start states. Sized in container units, so the same
 *  markup works on a glass layer, a phone-row card and the phone's own screen. aria-hidden:
 *  the layer's callout carries the words. */

import type { LayerId } from '@/lib/teardown';

export function LayerScreen({ id }: { id: LayerId }) {
  return (
    <div className={`ls ls-${id}`} aria-hidden="true">
      {id === 'seo' && <Seo />}
      {id === 'web' && <Web />}
      {id === 'wa' && <Wa />}
      {id === 'n8n' && <N8n />}
      {id === 'quote' && <Quote />}
      {id === 'warranty' && <Warranty />}
      {id === 'nfc' && <Nfc />}
    </div>
  );
}

function Seo() {
  return (
    <>
      <p className="ls-search" data-f="search"><i className="ls-mag" /><span data-f="q">ac installation kochi</span></p>
      <ol className="ls-results">
        <li className="ls-res is-top" data-f="top">
          <span className="ls-res-tag" data-f="tag">Top result</span>
          <b>CoolAir Services</b>
          <span>coolair.in · ★ 4.9 (212)</span>
        </li>
        <li className="ls-res" data-f="res"><b>City AC Repairs</b><span>★ 4.1 (38)</span></li>
        <li className="ls-res" data-f="res"><b>FrostFix Kochi</b><span>★ 3.8 (19)</span></li>
      </ol>
      <span className="ls-toast" data-f="toast">Priya taps CoolAir</span>
    </>
  );
}

function Nfc() {
  return (
    <>
      <div className="ls-ac" data-f="ac">
        <span className="ls-ac-grill" />
        <span className="ls-tag" data-f="tag">NFC<i className="ls-wave" data-f="wave" /><i className="ls-wave" data-f="wave" /></span>
      </div>
      <div className="ls-card" data-f="card">
        <p className="ls-title">AC-88213</p>
        <p className="ls-row"><span>Warranty</span><b>Valid to 2027</b></p>
        <p className="ls-row"><span>Next service</span><b>In 30 days</b></p>
        <span className="ls-btn" data-f="btn">Book a service<i className="ls-ripple" data-f="ripple" /></span>
      </div>
    </>
  );
}

function Web() {
  return (
    <>
      <p className="ls-bar"><b>CoolAir</b><span>Services</span></p>
      <div className="ls-hero" data-f="img"><span className="ls-hero-h">Cool rooms, fitted in a day</span></div>
      <p className="ls-line" data-f="line" /><p className="ls-line short" data-f="line" />
      <span className="ls-btn" data-f="btn">Get a quote<i className="ls-ripple" data-f="ripple" /></span>
      <span className="ls-speed" data-f="speed"><b data-f="score">99</b>speed</span>
      <span className="ls-toast" data-f="toast">Request sent ✓</span>
    </>
  );
}

function Wa() {
  return (
    <>
      <p className="ls-chat-head"><i />CoolAir <span>online</span></p>
      <p className="ls-bub out" data-f="m1">Hi Priya, got your request. What size is the room?</p>
      <p className="ls-bub in" data-f="m2">12 × 14 ft</p>
      <p className="ls-typing" data-f="typing"><i /><i /><i /></p>
      <p className="ls-bub out" data-f="m3">A 1.5 ton split AC it is. Your quote is on its way. <b className="ls-ticks" data-f="ticks">✓✓</b></p>
    </>
  );
}

function N8n() {
  const nodes = [['WhatsApp', 'reply in'], ['Sheet', 'row #214'], ['Price rules', '₹45,800'], ['PDF', 'Q-2041.pdf']];
  return (
    <>
      <p className="ls-title">Workflow · new quote</p>
      <ol className="ls-flow">
        {nodes.map(([n, o]) => (
          <li key={n} data-f="node"><span className="ls-node-dot" /><span className="ls-node-name">{n}</span><span className="ls-node-out" data-f="out">{o}</span></li>
        ))}
      </ol>
      <span className="ls-packet" data-f="packet" />
    </>
  );
}

function Quote() {
  return (
    <>
      <p className="ls-title">Quote Q-2041</p>
      <p className="ls-row" data-f="row"><span>Split AC 1.5 t</span><b>₹38,500</b></p>
      <p className="ls-row" data-f="row"><span>Copper kit</span><b>₹4,200</b></p>
      <p className="ls-row" data-f="row"><span>Stabiliser</span><b>₹3,100</b></p>
      <p className="ls-total"><span>Total</span><b data-f="total">₹45,800</b></p>
      <p className="ls-status" data-f="status">Opened twice · accepted</p>
      <span className="ls-stamp" data-f="stamp">Accepted</span>
    </>
  );
}

function Warranty() {
  return (
    <>
      <p className="ls-title">Warranty check</p>
      <div className="ls-qr" data-f="qr"><i className="ls-scan" data-f="scan" /></div>
      <p className="ls-row"><span>Serial</span><b>LF-AC-88213</b></p>
      <p className="ls-row"><span>Until</span><b>14 Sep 2027</b></p>
      <span className="ls-stamp ls-valid" data-f="stamp">Valid</span>
      <span className="ls-remind" data-f="remind">Reminder set ✓✓</span>
    </>
  );
}
