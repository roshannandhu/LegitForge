'use client';

/** Team "The smiths" (PLAN §6.8) — the 2D tier: ID cards hanging from CSS straps, tap to flip.
 *  3D physics lanyards arrive in R3 on fine-pointer desktops only; this layer stays as the
 *  fallback everywhere else.
 *  Accessibility: card visuals are aria-hidden; the name tags underneath are the real
 *  interface (names as text, "Flip [name]'s card" buttons with aria-pressed). */

import { useState } from 'react';
import { AnvilMark } from '@/components/ui/icons';
import { TEAM } from '@/lib/content';
import { SITE } from '@/lib/site';

export function Team() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setFlipped((f) => ({ ...f, [id]: !f[id] }));

  return (
    <section id="team" data-heat="0.7" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Two people. Both of us build.</h2>
          <p className="type-lead">
            No account managers, no juniors, no handoffs. The person who answers your first WhatsApp
            message is the person writing your code. We take {SITE.projectsAtATime} projects at a time,
            which is why we can tell you exactly what you’ll get and when.
          </p>
        </header>

        <ul className="lanyards">
          {TEAM.map((m, i) => (
            <li key={m.slug} className="lanyard" style={{ '--drop': i === 0 ? '-24px' : '0px' } as React.CSSProperties}>
              <span className="strap" aria-hidden="true" />
              <div className="id-card" data-flipped={!!flipped[m.slug]} aria-hidden="true" onClick={() => toggle(m.slug)}>
                <div className="id-face id-front">
                  <div className="id-top"><AnvilMark className="id-mark" /><span className="id-code num">{m.idCode}</span></div>
                  <div className="id-photo"><span>{m.initials}</span></div>
                  <p className="id-name">{m.name}</p>
                  <p className="id-role">{m.role}</p>
                  <span className="id-seal">Legit</span>
                </div>
                <div className="id-face id-back">
                  <p className="id-back-h">Skills</p>
                  <ul className="id-skills">{m.skills.map((s) => <li key={s}>{s}</li>)}</ul>
                  <p className="id-stat"><span>Projects shipped</span><strong className="num">{m.shipped}</strong></p>
                  <p className="id-stat"><span>Favourite build</span><strong>{m.favorite}</strong></p>
                </div>
              </div>
              <div className="name-tag">
                <p className="name-tag-name">{m.name}</p>
                <p className="name-tag-role">{m.role}</p>
                <button type="button" className="flip-btn" aria-pressed={!!flipped[m.slug]} onClick={() => toggle(m.slug)}>
                  Flip {m.name}’s card
                </button>
              </div>
            </li>
          ))}

          {/* Card 003 is yours: two cards look sparse, and a hiring ad from a two-person
              studio reads as premature. It looks like a team card, so people flip it (§6.8). */}
          <li className="lanyard lanyard-you" style={{ '--drop': '-12px' } as React.CSSProperties}>
            <span className="strap" aria-hidden="true" />
            <div className="id-card" data-flipped={!!flipped.you} aria-hidden="true" onClick={() => toggle('you')}>
              <div className="id-face id-front">
                <div className="id-top"><AnvilMark className="id-mark" /><span className="id-code num">LF-003</span></div>
                <div className="id-photo id-photo-empty"><span>?</span></div>
                <p className="id-name">You</p>
                <p className="id-role">Client</p>
                <span className="id-seal">Legit</span>
              </div>
              <div className="id-face id-back id-back-you">
                <p className="id-you-line">Every project starts as a blank card.</p>
                <p className="id-you-sub">Tell us what you’re building.</p>
              </div>
            </div>
            <div className="name-tag">
              <p className="name-tag-name">Card 003 is yours</p>
              <p className="name-tag-role">Every project starts as a blank card.</p>
              <div className="name-tag-actions">
                <button type="button" className="flip-btn" aria-pressed={!!flipped.you} onClick={() => toggle('you')}>
                  Flip card 003
                </button>
                <a className="text-link" href="#contact">Tell us what you’re building</a>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
