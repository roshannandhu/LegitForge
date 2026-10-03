'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const locate = (a: HTMLAnchorElement) => {
  if (a.closest('header')) return 'header';
  if (a.closest('footer')) return 'footer';
  const section = a.closest('section');
  const id = section?.id;
  if (['contact', 'work', 'team'].includes(id ?? '')) return id!;
  if (section?.classList.contains('hero')) return 'hero';
  if (section?.classList.contains('cta-band')) return 'closing';
  if (id === 'services' || location.pathname.startsWith('/services/')) return 'service';
  return 'other';
};

function track(name: string, props: Record<string, string>) {
  try {
    const body = JSON.stringify({ name, props });
    if (!navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* Navigation and contact always work independently of analytics. */ }
}

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    const redirectDemo = () => {
      if (pathname !== '/') return;
      const hash = location.hash;
      const target = hash === '#live-test' ? '/services/whatsapp-automation' :
        ['#quotation', '#compare', '#app-example'].includes(hash) ? '/services/website-development' : null;
      if (target) location.replace(target + hash);
    };
    redirectDemo();
    window.addEventListener('hashchange', redirectDemo);
    const match = /^\/(services|work)\/([a-z0-9-]+)$/.exec(pathname);
    if (match) track(match[1] === 'services' ? 'service_open' : 'project_open', { slug: match[2] });
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link) return;
      if (link.href.startsWith('https://wa.me/')) track('whatsapp_click', { location: locate(link) });
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', redirectDemo);
    };
  }, [pathname]);
  return null;
}
