'use client';

/** Compare slider "Static or dynamic?" (PLAN §6.4, animation #13).
 *  A native range input covers the frame, so mouse, touch, keyboard and screen readers
 *  all work with no custom drag code. Arrow keys 1%, Page Up/Down 10%, Home/End jump. */

import { useState } from 'react';
import { waLink } from '@/lib/site';

export function Compare() {
  const [pos, setPos] = useState(50);

  return (
    <section id="compare" data-heat="0.55" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Static or dynamic? Drag to compare.</h2>
        </header>

        <div className="compare-labels">
          <p><strong>Static:</strong> fast, simple, lower cost. Best when content changes a few times a month.</p>
          <p><strong>Dynamic:</strong> logins, bookings, dashboards. Best when content changes daily or per customer.</p>
        </div>

        <div className="compare" style={{ '--pos': pos } as React.CSSProperties}>
          <CafeSite dynamic />
          <div className="compare-static"><CafeSite /></div>
          <span className="compare-divider" aria-hidden="true" />
          <span className="compare-handle" aria-hidden="true"><i /><i /></span>
          <input
            type="range" min={0} max={100} value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Compare the static and dynamic versions of the same café website"
            aria-valuetext={`${pos}% static version shown`}
          />
        </div>

        <p className="compare-note">
          Not sure? <a className="text-link" href={waLink('Hi Legit Forge, should my site be static or dynamic?')}>Ask us on WhatsApp</a>.
          If a static site is enough, we’ll tell you.
        </p>
      </div>
    </section>
  );
}

/** The same café website twice. The dynamic one adds live data and a login. */
function CafeSite({ dynamic = false }: { dynamic?: boolean }) {
  return (
    <div className={`cafe ${dynamic ? 'cafe-dynamic' : 'cafe-static'}`} aria-hidden="true">
      <div className="cafe-nav">
        <span className="cafe-brand">Corner Café</span>
        <span className="cafe-links"><span>Menu</span><span>Visit</span></span>
        {dynamic ? <span className="cafe-account">Sign in</span> : <span className="cafe-call">Call us</span>}
      </div>

      <div className="cafe-body">
        <div className="cafe-menu">
          <p className="cafe-h">Today’s menu</p>
          <ul className="num">
            <li><span>Filter coffee</span><span>₹60</span></li>
            <li><span>Masala dosa</span><span>₹120</span></li>
            <li><span>Banana bread</span><span>₹90</span></li>
          </ul>
          {dynamic && <span className="cafe-order">Order ahead</span>}
        </div>

        <div className="cafe-side">
          {dynamic ? (
            <>
              <div className="cafe-live"><span className="live-dot" />3 tables free now</div>
              <div className="cafe-status"><span className="num">Order #214</span><span>Being prepared · ready 10:42</span></div>
            </>
          ) : (
            <>
              <div className="cafe-hours"><span>Open</span><span className="num">7 am – 10 pm</span></div>
              <div className="cafe-map" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
