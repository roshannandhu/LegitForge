/** The Hallmark Strike (PLAN §6.1b): a first-visit moment. A forging press strikes a blank coin,
 *  LEGIT FORGE is stamped into it glowing hot, the coin is tossed, flips in 3D, lands face-up
 *  and flies to the header logo while the veil lifts.
 *
 *  Server-rendered markup and pure CSS keyframes (intro.css): no JS runs the animation, so it
 *  also ends on its own. INTRO_BOOT (lib/boot.ts, inline, before first paint) decides whether it plays:
 *  first visit, motion on, home page, loaded at the top. The skip script below ends it on any
 *  key, click, tap or wheel. The overlay ignores the pointer: the page underneath is live. */

import './intro.css';

const SKIP =
  `(function(){var d=document.documentElement;if(!d.dataset.intro)return;var ev=['keydown','pointerdown','wheel','touchstart'];` +
  `function k(){delete d.dataset.intro;ev.forEach(function(e){removeEventListener(e,k,true)})}` +
  `ev.forEach(function(e){addEventListener(e,k,{capture:true,passive:true})})})()`;

const SPARKS = Array.from({ length: 14 }, (_, i) => ({ a: `${i * (360 / 14) + (i % 3) * 7}deg`, r: `${70 + (i % 4) * 26}px` }));
const RIM = Array.from({ length: 10 }, (_, i) => i);

function CoinFace() {
  return (
    <svg viewBox="0 0 200 200" className="coin-svg">
      <defs>
        <radialGradient id="lf-gold" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFE9A8" /><stop offset=".45" stopColor="#E3B452" /><stop offset="1" stopColor="#A87424" />
        </radialGradient>
        <linearGradient id="lf-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C6B7A" /><stop offset=".5" stopColor="#2E3945" /><stop offset="1" stopColor="#1A222B" />
        </linearGradient>
        <path id="lf-ring" d="M100 100 m-80 0 a80 80 0 1 1 160 0 a80 80 0 1 1 -160 0" />
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#lf-gold)" />
      <circle cx="100" cy="100" r="92" fill="url(#lf-steel)" />
      <circle cx="100" cy="100" r="68" fill="url(#lf-gold)" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#7A5418" strokeWidth="1.5" />
      <g className="coin-text">
        <text className="coin-ring-text"><textPath href="#lf-ring" startOffset="0">LEGIT FORGE · LEGIT FORGE · LEGIT FORGE ·</textPath></text>
        <text x="100" y="96" textAnchor="middle" className="coin-word">LEGIT</text>
        <text x="100" y="124" textAnchor="middle" className="coin-word">FORGE</text>
      </g>
    </svg>
  );
}

export function HallmarkStrike() {
  return (
    <>
      <div className="intro" aria-hidden="true">
        <div className="intro-veil" />
        <div className="intro-smoke">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</div>
        <div className="intro-stage">
          <svg className="intro-press" viewBox="0 0 120 220">
            <defs>
              <linearGradient id="lf-ram" x1="0" x2="1">
                <stop offset="0" stopColor="#2A333D" /><stop offset=".35" stopColor="#B8C2CC" /><stop offset=".6" stopColor="#6E7B88" /><stop offset="1" stopColor="#222A33" />
              </linearGradient>
              <linearGradient id="lf-brass" x1="0" x2="1">
                <stop offset="0" stopColor="#7A5418" /><stop offset=".4" stopColor="#E3B452" /><stop offset="1" stopColor="#8C6420" />
              </linearGradient>
              <pattern id="lf-knurl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="4" fill="#3A4450" /></pattern>
            </defs>
            <rect x="28" y="0" width="64" height="34" rx="7" fill="#1B2129" />
            <rect x="28" y="0" width="64" height="34" rx="7" fill="url(#lf-knurl)" />
            <rect x="50" y="34" width="20" height="14" fill="url(#lf-ram)" />
            <polyline points="60,48 40,55 80,63 40,71 80,79 40,87 80,95 40,103 80,111 60,118" fill="none" stroke="#9AA6B2" strokeWidth="3" strokeLinejoin="round" />
            <rect x="32" y="118" width="56" height="16" rx="3" fill="url(#lf-ram)" />
            <rect x="40" y="134" width="40" height="50" fill="url(#lf-ram)" />
            <rect x="20" y="184" width="80" height="30" rx="4" fill="url(#lf-brass)" />
            <text x="60" y="203" textAnchor="middle" className="press-plate">LEGIT FORGE</text>
            <rect x="34" y="214" width="52" height="6" fill="#1B2129" />
          </svg>
          <div className="intro-anvil" />
          <div className="intro-flash" />
          <div className="intro-ring" />
          <div className="intro-sparks">
            {SPARKS.map((s, i) => <i key={i} style={{ '--a': s.a, '--r': s.r } as React.CSSProperties} />)}
          </div>
          <div className="coin-wrap">
            <div className="coin">
              {RIM.map((i) => <i key={i} className="coin-rim" style={{ '--z': i } as React.CSSProperties} />)}
              <div className="coin-face coin-front"><CoinFace /></div>
              <div className="coin-face coin-back"><CoinFace /></div>
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />
    </>
  );
}
