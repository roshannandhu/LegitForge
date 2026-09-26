/** Inline icons: 1.5px stroke, currentColor, sized by the caller (PLAN §4.5). */

import { useId } from 'react';

type P = React.SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The logo: the LEGIT FORGE coin struck in the intro (§6.1b), reduced for 24–40 px. A gold rim,
 *  a steel ring with a reeded edge where the ring text sits on the big coin, and the anvil
 *  stamped into the gold centre. Same colours in both themes, like a real coin. */
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
      </defs>
      <circle cx="16" cy="16" r="15.6" fill={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="14.3" fill={`url(#${id}s)`} />
      <circle cx="16" cy="16" r="12.4" fill="none" stroke="#C9D2DB" strokeOpacity=".55" strokeWidth="1.3" strokeDasharray=".9 1.05" />
      <circle cx="16" cy="16" r="10.6" fill={`url(#${id}g)`} stroke="#7A5418" strokeWidth=".5" />
      <g fill="#6E4A12" transform="translate(16 16.6) scale(.56) translate(-15 -13.75)">
        <path d="M20 1.5l1.1 2.6 2.6 1.1-2.6 1.1L20 8.9l-1.1-2.6-2.6-1.1 2.6-1.1z" />
        <path d="M1 13.2 7 11.4h22V16h-6.2l-1.6 5.4h4.3V26H7.5v-4.6h4.3L10.2 16H7.3z" />
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
