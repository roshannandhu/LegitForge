/** The Teardown hero's markup (PLAN §6.2c) as a Server Component: the finished exploded stack,
 *  exact with no JS. TeardownMotion (teardown.tsx, client) attaches the motion to it, so the
 *  ~350 nodes here are never hydrated: a large share of a budget phone's load time. */

import Image from 'next/image';
import { CALLOUTS, CALLOUT_W, DEFAULT_LEAD, DESIGN, ISO_SCALE, LAYERS, PHONE, SCREEN, SLOTS } from '@/lib/teardown';
import { LayerScreen } from './layer-screens';
import TeardownMotion from './teardown';

const STAGE_VARS = {
  '--dw': `${DESIGN.w}px`, '--dh': `${DESIGN.h}px`,
  '--phone-w': `${PHONE.w}px`, '--phone-x': `${PHONE.cx}px`, '--phone-y': `${PHONE.cy}px`,
  '--scr-w': `${SCREEN.w}px`, '--scr-h': `${SCREEN.h}px`,
  '--iso-s': ISO_SCALE,
} as unknown as React.CSSProperties;

/** Sets --fit during parsing (tablet and up), so the stage never visibly rescales at hydration.
 *  Keep in step with the resize effect in teardown.tsx. */
const FIT_NOW = `(function(s){if(matchMedia('(max-width: 767px)').matches)return;var b=s.parentElement.getBoundingClientRect();` +
  `if(b.width)s.style.setProperty('--fit',Math.min((b.width-28)/${DESIGN.w},b.height/${DESIGN.h},1.25).toFixed(3))})` +
  `(document.currentScript.previousElementSibling)`;

const WORD = 'Legit Forge';

export default function Teardown() {
  return (
    <div className="stage-fit td">
      {/* suppressHydrationWarning: FIT_NOW adds --fit to this style before React hydrates */}
      <div className="stage td-stage" style={STAGE_VARS} suppressHydrationWarning>
        {/* leader lines and callouts: the technical-drawing layer (tablet and up) */}
        <svg className="td-leaders" viewBox={`0 0 ${DESIGN.w} ${DESIGN.h}`} aria-hidden="true">
          {SLOTS.map((s, i) => (
            <path key={i} d={`M${CALLOUTS[i].x + CALLOUT_W + 8} ${CALLOUTS[i].y + 11} L${s.x - 96} ${s.y}`} />
          ))}
        </svg>
        <ol className="td-callouts" style={{ '--cw': `${CALLOUT_W}px` } as React.CSSProperties}>
          {LAYERS.map((l, i) => (
            <li key={l.id} style={{ '--cx': `${CALLOUTS[i].x}px`, '--cy': `${CALLOUTS[i].y}px` } as React.CSSProperties}>
              <span className="num">{l.num}</span> <strong>{l.name}</strong> <em>{l.spec}</em>
            </li>
          ))}
        </ol>

        <div className="td-phone">
          <Image src="/hero/phone@2x.avif" alt="" width={1200} height={1653} priority sizes="(max-width: 767px) 62vw, 30vw" />
          <div className="td-screen" data-state="final" data-lead={DEFAULT_LEAD} aria-hidden="true">
            <p className="td-word">{[...WORD].map((c, i) => <span key={i}>{c === ' ' ? ' ' : c}</span>)}</p>
            {LAYERS.map((l) => <div key={l.id} className="td-final" data-for={l.id}><LayerScreen id={l.id} /></div>)}
          </div>
        </div>

        <ul className="td-layers" aria-label="What happens inside the phone">
          {LAYERS.map((l, i) => (
            <li
              key={l.id}
              className="td-layer"
              data-layer={l.id}
              style={{ '--sx': SLOTS[i].x, '--sy': SLOTS[i].y, zIndex: 10 - i } as React.CSSProperties}
            >
              <div className="td-glass"><LayerScreen id={l.id} /></div>
              <p className="td-cap"><span className="num">{l.num}</span> {l.name}</p>
            </li>
          ))}
        </ul>
        <span className="td-pulse" aria-hidden="true" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIT_NOW }} />
      <TeardownMotion />
    </div>
  );
}
