/** Inline icons: 1.5px stroke, currentColor, sized by the caller (PLAN §4.5). */

type P = React.SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Anvil with one spark above it — the logo mark (§4.6). Filled, not stroked. */
export function AnvilMark(props: P) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M20 1.5l1.1 2.6 2.6 1.1-2.6 1.1L20 8.9l-1.1-2.6-2.6-1.1 2.6-1.1z" />
      <path fill="currentColor" d="M1 13.2 7 11.4h22V16h-6.2l-1.6 5.4h4.3V26H7.5v-4.6h4.3L10.2 16H7.3z" />
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
