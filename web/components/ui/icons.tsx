/** Inline icons: 1.5px stroke, currentColor, sized by the caller (PLAN §4.5). */

import { useId } from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The logo: the LEGIT FORGE coin struck in the intro (§6.1b), as a seal. Letters only, no
 *  symbol: LEGIT FORGE runs round the steel ring and is stamped across the gold centre, as
 *  on the intro coin. Same colours in both themes, like a
 *  real coin. Keep in step with app/icon.svg and mark() in lib/card-art.ts. */
export function CoinMark(props: P) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <defs>
        <radialGradient id={`${id}g`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFE9A8" /><stop offset=".45" stopColor="#E3B452" /><stop offset="1" stopColor="#A87424" />
        </radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C6B7A" /><stop offset=".5" stopColor="#2E3945" /><stop offset="1" stopColor="#1A222B" />
        </linearGradient>
        <path id={`${id}r`} d="M16 16m-12.4 0a12.4 12.4 0 1 1 24.8 0a12.4 12.4 0 1 1-24.8 0" />
      </defs>
      <circle cx="16" cy="16" r="15.6" fill={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="14.3" fill={`url(#${id}s)`} />
      <text fill="#E6ECF1" fontSize="2.7" fontWeight="800" dominantBaseline="central" style={{ fontFamily: 'var(--font-archivo), system-ui, sans-serif' }}>
        <textPath href={`#${id}r`} textLength="77" lengthAdjust="spacing">LEGIT FORGE · LEGIT FORGE · </textPath>
      </text>
      <circle cx="16" cy="16" r="10.6" fill={`url(#${id}g)`} stroke="#7A5418" strokeWidth=".5" />
      <g fill="#6E4A12" fontSize="5.1" fontWeight="800" textAnchor="middle" style={{ fontFamily: 'var(--font-archivo), system-ui, sans-serif', fontStretch: '112%' }}>
        <text x="16" y="15.3">LEGIT</text>
        <text x="16" y="20.9">FORGE</text>
      </g>
    </svg>
  );
}

export function ChatIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4Z" />
      <path d="M9.2 8.8c.2 1.9 1.9 4.4 4.4 5.3l1.1-1.1 1.8.8-.4 1.6c-3.4.2-7.3-3.6-7.4-7.1l1.6-.4.8 1.8Z" />
    </svg>
  );
}

export function MenuIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} strokeWidth={2} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ExternalIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
