/** Inline icons: 1.5px stroke, currentColor, sized by the caller (PLAN §4.5). */

import { useId } from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The logo: the very coin struck in the loading intro (§6.1b), one drawing for both. The
 *  intro renders this same component on both faces of its flipping coin, so the logo is
 *  exactly the coin that lands in the header. Letters only, no symbol: LEGIT FORGE runs
 *  three times round the steel ring and is stamped across the gold centre. Same colours in
 *  both themes, like a real coin. Keep app/icon.svg and mark() in lib/card-art.ts in step.
 *  `textClassName` lets the intro animate the stamped letters. */
export function CoinMark({ textClassName, ...props }: P & { textClassName?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" {...props}>
      <defs>
        <radialGradient id={`${id}g`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#FFE9A8" /><stop offset=".45" stopColor="#E3B452" /><stop offset="1" stopColor="#A87424" />
        </radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5C6B7A" /><stop offset=".5" stopColor="#2E3945" /><stop offset="1" stopColor="#1A222B" />
        </linearGradient>
        <path id={`${id}r`} d="M100 100 m-80 0 a80 80 0 1 1 160 0 a80 80 0 1 1 -160 0" />
      </defs>
      <circle cx="100" cy="100" r="98" fill={`url(#${id}g)`} />
      <circle cx="100" cy="100" r="92" fill={`url(#${id}s)`} />
      <circle cx="100" cy="100" r="68" fill={`url(#${id}g)`} />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#7A5418" strokeWidth="1.5" />
      <g className={textClassName}>
        <text fill="#C9D2DB" fontSize="15" fontWeight="700" letterSpacing="1.8"
          style={{ fontFamily: 'var(--font-stencil), var(--font-sans), system-ui, sans-serif' }}>
          <textPath href={`#${id}r`} startOffset="0">LEGIT FORGE · LEGIT FORGE · LEGIT FORGE ·</textPath>
        </text>
        <g fill="#6E4A12" stroke="#FFE9A8" strokeWidth=".8" paintOrder="stroke" fontSize="25" fontWeight="800" letterSpacing="1" textAnchor="middle"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif', fontStretch: '112%' }}>
          <text x="100" y="96">LEGIT</text>
          <text x="100" y="124">FORGE</text>
        </g>
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

/** Google's "G", for the search mock-ups (SEO demo and the hero's SEO layer). Its four brand
 *  colours are fixed in both themes, like the coin: they are Google's, not ours. */
export function GoogleG(props: P) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" /><path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.2z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
