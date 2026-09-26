'use client';

/** The home #work gallery: every project is a card of the same size showing its screenshot.
 *  Point at one (mouse) and it turns over to its details on the back; move away and it turns
 *  back, so the row always returns to equal cards. Touch and keyboard: the front is one big
 *  button (tap or Enter turns it; the back has its links and a "turn back" button).
 *
 *  CSS 3D (sections.css "work flip"): transform only. The front keeps data-project-card and
 *  .project-cover, so the Cleave page transition still morphs the cover into the case study.
 *  Motion off: the card swaps sides without the turn. No JS: hover and focus still turn it. */

import { useState } from 'react';

export interface GalleryItem {
  image?: string;
  alt?: string;
  initials?: string;
  label: string;
  client?: string;
  stamp?: 'live' | 'in-use' | 'none';
  link: string;
  content?: React.ReactNode;
  cardProps?: Record<string, string>;
}

export function WorkGallery({ items }: { items: GalleryItem[] }) {
  const [flipped, setFlipped] = useState<number | null>(null);
  return (
    <ul className="fg" style={{ '--fg-n': items.length } as React.CSSProperties}>
      {items.map((it, i) => {
        const on = flipped === i;
        return (
          <li key={it.link} className="fg-card" data-flipped={on ? '' : undefined} {...it.cardProps}
            style={{ '--i': i } as React.CSSProperties}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse' && on) setFlipped(null); }}>
            <div className="fg-inner">
              <div className="fg-face fg-front">
                <div className="fg-media project-cover">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded covers, already sized
                    <img src={it.image} alt={it.alt ?? ''} loading="lazy" decoding="async" />
                  ) : (
                    <span className="fg-blueprint" aria-hidden="true"><span>{it.initials ?? it.label.slice(0, 2)}</span></span>
                  )}
                </div>
                <div className="fg-bar">
                  <span className="fg-name">{it.label}</span>
                  {it.client && <span className="fg-client">{it.client}</span>}
                  {it.stamp && it.stamp !== 'none' && <span className="fg-live">{it.stamp === 'live' ? 'Live' : 'In use'}</span>}
                </div>
                <button type="button" className="fg-turn" aria-expanded={on} onClick={() => setFlipped(on ? null : i)}>
                  <span className="sr-only">Show the details of {it.label}</span>
                  <span className="fg-hint" aria-hidden="true">Details ↻</span>
                </button>
              </div>
              <div className="fg-face fg-back">
                {it.content}
                <button type="button" className="fg-back-btn" onClick={() => setFlipped(null)} aria-label={`Show the screenshot of ${it.label}`}>↺</button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
