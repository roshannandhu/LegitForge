'use client';

/** Forge status (plan D #13): "The forge is lit" in working hours, "resting" otherwise, with
 *  when it opens. Pages are cached, so "now" is only known in the browser; the line's space
 *  is reserved in the server HTML, so filling it never shifts layout. */

import { useEffect, useState } from 'react';
import { isOpenNow, opensNextLabel } from '@/lib/business-hours';

export function ForgeStatus() {
  const [s, setS] = useState<{ open: boolean; next: string } | null>(null);
  useEffect(() => setS({ open: isOpenNow(), next: opensNextLabel() }), []);
  return (
    <p className="forge-status" data-open={s ? String(s.open) : undefined} aria-live="polite">
      <span className="forge-ember" aria-hidden="true" />
      <span>{s === null ? ' ' : s.open ? 'The forge is lit: we’re working now.' : `The forge is resting. Back at ${s.next}.`}</span>
    </p>
  );
}
