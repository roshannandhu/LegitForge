'use client';

/** The member page's 2D ID card (PLAN §7.3): flips on click or with its button.
 *  The button is the accessible control; the card itself is decoration. */

import { useState } from 'react';
import { CardBack, CardFront } from './card-faces';
import type { CardPerson } from '@/lib/card-art';

export function MemberCard({ p }: { p: CardPerson }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="member-card">
      <div className="id-card id-static" data-flipped={flipped} aria-hidden="true" onClick={() => setFlipped((f) => !f)}>
        <div className="id-face id-front"><CardFront p={p} /></div>
        <div className="id-face id-back"><CardBack p={p} /></div>
      </div>
      <button type="button" className="flip-btn" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}>
        Flip {p.name}’s card
      </button>
    </div>
  );
}
