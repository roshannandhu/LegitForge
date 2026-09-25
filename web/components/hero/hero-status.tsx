'use client';

/** "Open now / Closed now" (PLAN §6.2). Pages are cached, so "now" is only known in the
 *  browser. The line's space is reserved in the server HTML, so filling it never shifts layout. */

import { useEffect, useState } from 'react';
import { isOpenNow, opensAtLabel } from '@/lib/business-hours';
import { SITE } from '@/lib/site';

export function HeroStatus() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => setOpen(isOpenNow()), []);

  return (
    <p className="note">
      <b>Usually replies within {SITE.replyWithin}.</b>{' '}
      <span aria-live="polite">
        {open === null ? '' : open ? 'Open now.' : `Closed now. We'll reply from ${opensAtLabel()}`}
      </span>
    </p>
  );
}
