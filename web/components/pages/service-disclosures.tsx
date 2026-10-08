'use client';

import { useEffect } from 'react';

/** Native disclosures work without JavaScript. This only makes existing fragment links
 *  reveal a target inside a closed disclosure, including links used after the first load. */
export function ServiceDisclosures() {
  useEffect(() => {
    let frame = 0;
    let lastTarget: HTMLElement | null = null;
    const hashTarget = (hash: string) => {
      try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
    };
    const reveal = (hash = window.location.hash) => {
      const target = hashTarget(hash);
      if (!target?.closest('[data-service-page]')) return;
      for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      }
      lastTarget = target;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        lastTarget = hashTarget(hash);
        lastTarget?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    };
    const onHash = () => reveal();
    const onHydrated = () => {
      const target = hashTarget(window.location.hash);
      // Near-section hydration must not pull a reader back to #price. Only resettle a
      // disclosure target when its preserved server node was replaced during hydration.
      if (target?.closest('details') && target !== lastTarget) reveal();
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
      const link = (event.target instanceof Element ? event.target : null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash) reveal(url.hash);
    };
    reveal();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('lf:hydrated', onHydrated);
    // Open the disclosure before smooth-scroll handlers measure the fragment target.
    document.addEventListener('click', onClick, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('lf:hydrated', onHydrated);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
  return null;
}
