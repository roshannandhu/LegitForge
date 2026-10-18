'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** While the QR shows: a fresh page every 15 seconds (WhatsApp changes the QR), until linked. */
export function Refresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
