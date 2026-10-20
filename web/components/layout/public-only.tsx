'use client';

import { usePathname } from 'next/navigation';

/** The public site's chrome (header, footer, embers, smooth scrolling): never in the admin, which
 *  has its own bar (app/admin/layout.tsx). Like ChatBubble and Analytics. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith('/admin') ? null : children;
}
