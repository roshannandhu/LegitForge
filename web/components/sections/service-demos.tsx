/** The four service demos (PLAN §6.3), each a small working flow.
 *  Built in HTML/SVG, not video: crisp, tiny, and they follow the theme.
 *  The markup IS the final frame: DemoPlayer plays each one from its start state when it
 *  comes into view (components/sections/demos.ts), so no JS and motion off still show the
 *  finished demo. Each is aria-hidden; its step-by-step text (lib/demo-transcripts.ts) sits
 *  beside it, visually hidden, for screen readers and search engines. */

import { CheckIcon, GoogleG } from '@/components/ui/icons';
import type { DemoKind } from '@/lib/content';
import { DemoPlayer } from './demo-player';
import { DemoTranscript } from './demo-transcript';

export function ServiceDemo({ kind }: { kind: DemoKind }) {
  return (
    <>
      <DemoPlayer kind={kind}>
        <div className={`demo demo-${kind}`} aria-hidden="true">
          {kind === 'website' && <WebsiteDemo />}
          {kind === 'app' && <AppDemo />}
          {kind === 'whatsapp' && <WhatsAppDemo />}
          {kind === 'n8n' && <N8nDemo />}
          {kind === 'seo' && <SeoDemo />}
          {kind === 'nfc' && <NfcDemo />}
        </div>
      </DemoPlayer>
      <DemoTranscript kind={kind} />
    </>
  );
}

function Cursor() {
  return (
    <svg className="demo-cursor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3l14 8-6 1.5L10 19z" />
    </svg>
  );
}

/* 1 — a wireframe snaps into a styled page, a visitor clicks, speed reads 99, then the
       page turns dynamic: live content changes on its own */
function WebsiteDemo() {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i /><span className="browser-url">yourbusiness.com</span><span className="demo-tag">Dynamic</span></div>
      <div className="browser-page">
        <div className="bp-nav"><span className="bp-logo" /><span /><span /><span /></div>
        <div className="bp-hero">
          <div className="bp-copy">
            <span className="bp-h" /><span className="bp-h short" />
            <span className="bp-t" /><span className="bp-t" /><span className="bp-btn"><i className="demo-ripple" /></span>
          </div>
          <div className="bp-img"><span className="bp-badge">2 tables free</span></div>
        </div>
        <div className="bp-cards"><span /><span /><span /></div>
      </div>
      <Cursor />
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

/* 2 — dashboard: the chart draws, totals count up, a booking arrives from WhatsApp */
function AppDemo() {
  return (
    <div className="dash">
      <aside className="dash-side"><i /><i /><i /><i /></aside>
      <div className="dash-main">
        <div className="dash-stats">
          <div><span className="k">Bookings</span><span className="v num" data-count="128">128</span></div>
          <div><span className="k">Revenue</span><span className="v num" data-count="4.2" data-suffix="L" data-dp="1">4.2L</span></div>
          <div><span className="k">Repeat</span><span className="v num" data-count="61" data-suffix="%">61%</span></div>
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
        <span className="dash-toast"><CheckIcon className="inline-icon" /> Booking from WhatsApp</span>
      </div>
    </div>
  );
}

/* 5 — SEO: a local search, the business climbs to the top result, clicks and calls add up */
function SeoDemo() {
  return (
    <div className="serp">
      <div className="serp-bar"><GoogleG className="serp-g" /><span className="serp-q">ac installation kochi</span></div>
      <ol className="serp-list">
        <li className="serp-item is-you">
          <span className="serp-rank num">1</span>
          <span className="serp-body"><span className="serp-url">coolair.in</span><b className="serp-title">CoolAir: AC installation in Kochi, fitted in a day</b><span className="serp-meta">★ 4.9 · 212 reviews · Open now</span></span>
          <span className="serp-top">Top result</span>
        </li>
        <li className="serp-item"><span className="serp-rank num">2</span><span className="serp-body"><span className="serp-url">cityacrepairs.com</span><b className="serp-title">City AC Repairs</b><span className="serp-meta">★ 4.1 · 38 reviews</span></span></li>
        <li className="serp-item"><span className="serp-rank num">3</span><span className="serp-body"><span className="serp-url">frostfix.in</span><b className="serp-title">FrostFix Kochi</b><span className="serp-meta">★ 3.8 · 19 reviews</span></span></li>
      </ol>
      <div className="serp-stats">
        <span><b className="num serp-clicks">148</b> clicks this week</span>
        <span><b className="num serp-calls">23</b> calls from Google</span>
      </div>
    </div>
  );
}

/* 6 — NFC: a phone meets a card, waves ripple, the page opens: contact, review, warranty */
function NfcDemo() {
  return (
    <div className="nfc">
      <div className="nfc-card">
        <span className="nfc-brand">CoolAir</span>
        <span className="nfc-mark" />
        <span className="nfc-waves"><i /><i /><i /></span>
      </div>
      <div className="nfc-phone">
        <p className="nfc-kicker">Tapped · no app needed</p>
        <p className="nfc-h">Leave a review</p>
        <p className="nfc-stars">★★★★★</p>
        <p className="nfc-sub">CoolAir Services · Google</p>
        <span className="nfc-btn">Post review</span>
      </div>
    </div>
  );
}

/* 3 — WhatsApp: a question, the bot types and answers, a button is tapped, the order is
       confirmed and read */
function WhatsAppDemo() {
  return (
    <div className="wa-phone">
      <div className="wa-head"><span className="wa-avatar" /><span className="wa-name">Your shop</span><span className="wa-status">online</span></div>
      <div className="wa-thread">
        <p className="msg in">Do you deliver near the station?</p>
        <p className="wa-typing"><i /><i /><i /></p>
        <p className="msg out">Yes — delivery near the station is free on orders over 500. What would you like?</p>
        <div className="wa-quick"><span className="tapped">Order now</span><span>See menu</span><span>Talk to a person</span></div>
        <p className="msg in">Order now</p>
        <p className="wa-typing"><i /><i /><i /></p>
        <p className="msg out confirm"><CheckIcon className="confirm-icon" /> Order confirmed. It reaches you by 7:40 pm. <span className="wa-ticks read">✓✓</span></p>
      </div>
    </div>
  );
}

/* 4 — n8n: the editor as the owner sees it. One entry travels the workflow; every node lights
       up and says what it did, the output panel shows the item, and the run counter ticks. */
const N8N_ICONS: Record<string, React.ReactNode> = {
  Form: <path d="M6 4h9l3 3v13H6zM9 10h6M9 13h6M9 16h4" />,
  Sheet: <path d="M5 5h14v14H5zM5 10h14M5 15h14M10 5v14" />,
  AI: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />,
  WhatsApp: <path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3zM9.5 9.5c0 3 2 5 5 5l1-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2z" />,
  'Team alert': <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
};

function N8nDemo() {
  const nodes = [['Form', 'new entry'], ['Sheet', 'row #214'], ['AI', 'intent: order'], ['WhatsApp', 'sent ✓✓'], ['Team alert', 'team pinged']];
  return (
    <div className="n8n">
      <div className="n8n-top">
        <span className="n8n-title">New enquiry → reply</span>
        <span className="n8n-active"><i />Active</span>
        <span className="n8n-runs">Executions <b className="num n8n-count">1,284</b></span>
      </div>
      <div className="flow">
        <svg className="flow-wire" viewBox="0 0 500 2" preserveAspectRatio="none"><path d="M0 1 H500" /></svg>
        <span className="flow-packet" />
        <ol className="flow-nodes">
          {nodes.map(([n, out]) => (
            <li key={n} className="flow-node">
              <span className="flow-check">
                <svg viewBox="0 0 24 24" className="flow-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{N8N_ICONS[n]}</svg>
                <span className="flow-ok"><CheckIcon /></span>
              </span>
              <span className="flow-name">{n}</span>
              <span className="flow-out num">{out}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="n8n-log"><span>Output</span><code className="n8n-json">{'{ "name": "Anu", "intent": "order", "row": 214 }'}</code></p>
    </div>
  );
}
