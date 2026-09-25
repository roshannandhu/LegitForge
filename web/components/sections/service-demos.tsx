/** The four service demos, as their finished frames (PLAN §6.3).
 *  Built in HTML/SVG, not video: crisp, tiny, and they follow the theme.
 *  Each is aria-hidden; the section supplies one visually hidden sentence per demo. */

import { CheckIcon } from '@/components/ui/icons';
import type { DemoKind } from '@/lib/content';

export function ServiceDemo({ kind }: { kind: DemoKind }) {
  return (
    <div className={`demo demo-${kind}`} aria-hidden="true">
      {kind === 'website' && <WebsiteDemo />}
      {kind === 'app' && <AppDemo />}
      {kind === 'whatsapp' && <WhatsAppDemo />}
      {kind === 'n8n' && <N8nDemo />}
    </div>
  );
}

/* 1 — wireframe snapped into a styled page; speed ring at 99 */
function WebsiteDemo() {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i /><span className="browser-url">yourbusiness.com</span></div>
      <div className="browser-page">
        <div className="bp-nav"><span className="bp-logo" /><span /><span /><span /></div>
        <div className="bp-hero">
          <div className="bp-copy">
            <span className="bp-h" /><span className="bp-h short" />
            <span className="bp-t" /><span className="bp-t" /><span className="bp-btn" />
          </div>
          <div className="bp-img" />
        </div>
        <div className="bp-cards"><span /><span /><span /></div>
      </div>
      <div className="speed-ring">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} className="ring-track" />
          <circle cx="32" cy="32" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * 0.01} />
        </svg>
        <span className="ring-num num">99</span>
        <span className="ring-label">Speed</span>
      </div>
    </div>
  );
}

/* 2 — dashboard: chart drawn, three totals, a new booking row */
function AppDemo() {
  return (
    <div className="dash">
      <aside className="dash-side"><i /><i /><i /><i /></aside>
      <div className="dash-main">
        <div className="dash-stats">
          <div><span className="k">Bookings</span><span className="v num">128</span></div>
          <div><span className="k">Revenue</span><span className="v num">4.2L</span></div>
          <div><span className="k">Repeat</span><span className="v num">61%</span></div>
        </div>
        <div className="dash-chart">
          <svg viewBox="0 0 300 90" preserveAspectRatio="none">
            <path className="chart-area" d="M0 72 L40 64 L80 68 L120 48 L160 52 L200 30 L240 36 L300 14 L300 90 L0 90 Z" />
            <path className="chart-line" d="M0 72 L40 64 L80 68 L120 48 L160 52 L200 30 L240 36 L300 14" />
          </svg>
        </div>
        <div className="dash-table">
          <div className="row new"><span>New</span><span>Table for 4</span><span className="num">7:30 pm</span></div>
          <div className="row"><span /><span>Table for 2</span><span className="num">7:00 pm</span></div>
          <div className="row"><span /><span>Table for 6</span><span className="num">6:45 pm</span></div>
        </div>
      </div>
    </div>
  );
}

/* 3 — WhatsApp conversation ending in a confirmed order */
function WhatsAppDemo() {
  return (
    <div className="wa-phone">
      <div className="wa-head"><span className="wa-avatar" /><span className="wa-name">Your shop</span><span className="wa-status">online</span></div>
      <div className="wa-thread">
        <p className="msg in">Do you deliver near the station?</p>
        <p className="msg out">Yes — delivery near the station is free on orders over 500. What would you like?</p>
        <div className="wa-quick"><span className="tapped">Order now</span><span>See menu</span><span>Talk to a person</span></div>
        <p className="msg in">Order now</p>
        <p className="msg out confirm"><CheckIcon className="confirm-icon" /> Order confirmed. It reaches you by 7:40 pm.</p>
      </div>
    </div>
  );
}

/* 4 — five nodes, every one checked */
function N8nDemo() {
  const nodes = ['Form', 'Sheet', 'AI', 'WhatsApp', 'Team alert'];
  return (
    <div className="flow">
      <svg className="flow-wire" viewBox="0 0 500 2" preserveAspectRatio="none"><path d="M0 1 H500" /></svg>
      <ol className="flow-nodes">
        {nodes.map((n) => (
          <li key={n} className="flow-node"><span className="flow-check"><CheckIcon /></span><span className="flow-name">{n}</span></li>
        ))}
      </ol>
    </div>
  );
}
