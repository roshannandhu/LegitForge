/** The seven live screens of the Teardown (PLAN §6.2c), as their FINAL frames. The flows in
 *  teardown-flows.ts play them from their start states. Sized in container units, so the same
 *  markup works on a glass layer, a phone-row card and the phone's own screen. aria-hidden:
 *  the layer's callout carries the words. */

import type { LayerId } from '@/lib/teardown';
import { GoogleG } from '@/components/ui/icons';

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

/* SEO: the Google results page on her phone (dark mode, as the glass is): the query, the tabs,
   the Maps pack with its pins, and three local listings; CoolAir on top, a Call button. */
function Seo() {
  const res = [['CoolAir Services', '4.9', '212', 'Open now'], ['City AC Repairs', '4.1', '38', 'Closes 7 pm'], ['FrostFix Kochi', '3.8', '19', 'Opens 10 am']];
  return (
    <>
      <p className="ls-search" data-f="search"><GoogleG className="ls-mag" /><span data-f="q">ac installation kochi</span></p>
      <p className="ls-tabs"><b>All</b><span>Maps</span><span>Images</span><span>News</span></p>
      <div className="ls-map" aria-hidden="true">
        <i className="ls-road" /><i className="ls-road r2" /><i className="ls-water" />
        <i className="ls-pin" data-f="pin" /><i className="ls-pin p2" data-f="pin" /><i className="ls-pin you" data-f="pin" />
      </div>
      <ol className="ls-results">
        {res.map(([name, rate, n, note], i) => (
          <li key={name} className={`ls-res${i === 0 ? ' is-top' : ''}`} data-f={i === 0 ? 'top' : 'res'}>
            {i === 0 && <span className="ls-res-tag" data-f="tag">#1 on Maps</span>}
            <b>{name}</b>
            <span>{rate} <i className="ls-stars">★★★★★</i> ({n})</span>
            <span className={i === 0 ? 'ls-open' : undefined}>{note}</span>
            <i className="ls-call" data-f={i === 0 ? 'call' : undefined} />
          </li>
        ))}
      </ol>
      <span className="ls-toast" data-f="toast">Priya taps Call</span>
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

/* n8n: the canvas as in the editor, top to bottom: the form trigger, the sheet, the AI step and a
   Switch that sends an order to a WhatsApp reply (the question branch waits). One SVG in a
   100 × 150 box: nodes, curved wires, ticks and the travelling item. */
const N8N_NODES: [string, string, number, number, string, string][] = [
  // label, output, x, y (node centre), colour, glyph (24 × 24)
  ['Form', 'new enquiry', 50, 14, '#FF6D5A', 'M7 4h8l3 3v13H7zM10 10h5M10 13h5M10 16h3'],
  ['Sheets', 'row #214', 50, 46, '#1FA463', 'M6 5h12v14H6zM6 10h12M6 14.5h12M11 5v14'],
  ['AI Agent', 'intent: order', 50, 78, '#FFFFFF', 'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z'],
  ['Switch', '→ order', 50, 106, '#3B8BD9', 'M5 12h5l4-5h5M14 17h5M10 12l4 5'],
  ['WhatsApp', 'reply sent', 24, 136, '#25D366', 'M5 19l1.2-3.4A7.3 7.3 0 1 1 9 18.3z'],
  ['Team', 'waiting', 76, 136, '#8B5CF6', 'M7 16v-5a5 5 0 0 1 10 0v5l1.5 2h-13z'],
];
const N8N_WIRES = ['M50 21 C50 30 50 30 50 39', 'M50 53 C50 62 50 62 50 71', 'M50 85 C50 92 50 92 50 99', 'M50 113 C50 122 24 120 24 129', 'M50 113 C50 122 76 120 76 129'];

function N8n() {
  return (
    <>
      <p className="ls-title">New enquiry → reply <span className="ls-active">Active</span></p>
      <svg className="ls-n8n" viewBox="0 0 100 150" aria-hidden="true">
        {N8N_WIRES.map((d, i) => <path key={i} d={d} className="ls-wire" />)}
        {N8N_WIRES.slice(0, 4).map((d, i) => <path key={i} d={d} className="ls-wire ran" data-f="wire" />)}
        {N8N_NODES.map(([label, out, x, y, color, glyph], i) => (
          <g key={label} data-f="node" transform={`translate(${x} ${y})`}>
            <rect x="-7" y="-7" width="14" height="14" rx={i === 0 ? 7 : 3} className={`ls-tile${i === 2 ? ' dark' : ''}`} />
            <path d={glyph} transform="translate(-4.2 -4.2) scale(.35)" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {i < 5 && <circle cx="7" cy="-7" r="2.4" className="ls-tick" data-f="tick" />}
            <text x={x === 50 ? 10 : 0} y={x === 50 ? 1.6 : 13} textAnchor={x === 50 ? 'start' : 'middle'} className="ls-n8n-name">{label}</text>
            <text x={x === 50 ? 10 : 0} y={x === 50 ? 7 : 18.5} textAnchor={x === 50 ? 'start' : 'middle'} className="ls-n8n-out" data-f="out">{out}</text>
          </g>
        ))}
        <circle r="2.6" className="ls-item" data-f="item" />
      </svg>
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
