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

/* 4 — n8n: the real editor canvas. App nodes joined by curved wires; one item at a time travels
       them, each node it reaches gets its green tick, and after the AI step a Switch sends an
       order to a WhatsApp reply and a question to the team (demos.ts alternates the two).
       Two wire layouts, one per shape of box: wide 640 × 300, tall (phones) 300 × 560. */
type N8nNode = { id: string; name: string; out: string; x: number; y: number; px: number; py: number; glyph: React.ReactNode };
const N8N_NODES: N8nNode[] = [
  { id: 'form', name: 'Form submitted', out: 'new entry', x: 60, y: 150, px: 150, py: 40,
    glyph: <path d="M7 4h8l3 3v13H7zM10 10h5M10 13h5M10 16h3" /> },
  { id: 'sheet', name: 'Google Sheets', out: 'row #214', x: 185, y: 150, px: 150, py: 140,
    glyph: <path d="M6 5h12v14H6zM6 10h12M6 14.5h12M11 5v14" /> },
  { id: 'ai', name: 'AI Agent', out: 'intent: order', x: 310, y: 150, px: 150, py: 240,
    glyph: <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM17.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /> },
  { id: 'switch', name: 'Switch', out: '→ order', x: 435, y: 150, px: 150, py: 340,
    glyph: <path d="M5 12h5l4-5h5M14 17h5M10 12l4 5M16 4l3 3-3 3M16 14l3 3-3 3" /> },
  { id: 'wa', name: 'WhatsApp reply', out: 'sent ✓✓', x: 570, y: 80, px: 75, py: 470,
    glyph: <path d="M5 19l1.2-3.4A7.3 7.3 0 1 1 9 18.3zM9.6 9.6c0 2.8 2 4.8 4.8 4.8l1-1.4-1.9-1-1 1c-.9 0-2.3-1.4-2.3-2.3l1-1-1-1.9z" /> },
  { id: 'team', name: 'Team alert', out: 'waiting', x: 570, y: 220, px: 225, py: 470,
    glyph: <path d="M7 16v-5a5 5 0 0 1 10 0v5l1.5 2h-13zM10.3 20a1.9 1.9 0 0 0 3.4 0" /> },
];
// the wires, in data-w order: form→sheet, sheet→ai, ai→switch, switch→wa (order), switch→team (question)
const N8N_WIDE = ['M88 150 C120 150 125 150 157 150', 'M213 150 C245 150 250 150 282 150', 'M338 150 C370 150 375 150 407 150',
  'M463 150 C505 150 500 80 542 80', 'M463 150 C505 150 500 220 542 220'];
const N8N_TALL = ['M150 68 C150 90 150 90 150 112', 'M150 168 C150 190 150 190 150 212', 'M150 268 C150 290 150 290 150 312',
  'M150 368 C150 410 75 400 75 442', 'M150 368 C150 410 225 400 225 442'];
const N8N_LABEL_WIDE: [number, number][] = [[122, 140], [247, 140], [372, 140], [505, 96], [505, 214]];
const N8N_LABEL_TALL: [number, number][] = [[142, 94], [142, 194], [142, 294], [96, 440], [204, 440]];
const RAN = [true, true, true, true, false];                    // the finished frame: an order went to WhatsApp

function N8nWires({ paths, labels, vb, cls }: { paths: string[]; labels: [number, number][]; vb: string; cls: string }) {
  const tall = cls.includes('tall');
  return (
    <svg className={`n8c-wires ${cls}`} viewBox={vb} preserveAspectRatio="none">
      {paths.map((d, i) => <path key={i} d={d} data-w={i} className={RAN[i] ? 'ran' : undefined} />)}
      {labels.map(([x, y], i) => (
        <text key={i} x={x} y={y} data-w={i} className={`n8c-count${RAN[i] ? ' ran' : ''}`} textAnchor={tall ? (i === 4 ? 'start' : 'end') : 'middle'}>1 item</text>
      ))}
      {/* the Switch's two output handles, named as n8n names them */}
      <text x={tall ? 138 : 470} y={tall ? 388 : 140} className="n8c-port" textAnchor={tall ? 'end' : 'start'}>order</text>
      <text x={tall ? 162 : 470} y={tall ? 388 : 168} className="n8c-port" textAnchor="start">question</text>
    </svg>
  );
}

function N8nDemo() {
  return (
    <div className="n8c">
      <N8nWires paths={N8N_WIDE} labels={N8N_LABEL_WIDE} vb="0 0 640 300" cls="n8c-wide" />
      <N8nWires paths={N8N_TALL} labels={N8N_LABEL_TALL} vb="0 0 300 560" cls="n8c-tall" />
      {N8N_NODES.map((n) => (
        <div key={n.id} className={`n8c-node n8c-${n.id}${n.id === 'team' ? '' : ' done'}`}
          style={{ '--x': `${(n.x / 640) * 100}%`, '--y': `${(n.y / 300) * 100}%`, '--px': `${(n.px / 300) * 100}%`, '--py': `${(n.py / 560) * 100}%` } as React.CSSProperties}>
          <span className="n8c-tile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{n.glyph}</svg>
            {n.id === 'form' && <i className="n8c-bolt" />}
            <span className="n8c-ok"><CheckIcon /></span>
          </span>
          <span className="n8c-name">{n.name}</span>
          <span className="n8c-out num">{n.out}</span>
        </div>
      ))}
      <span className="n8c-dot" />
      <div className="n8c-bar"><span className="n8c-toggle"><i /></span>Active<span className="n8c-sep" />Executions <b className="num n8c-runs">1,284</b></div>
    </div>
  );
}
