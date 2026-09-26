/** The page's Lenis instance, when there is one (laptops with motion on). A tiny store in place
 *  of lenis/react, so Lenis itself loads only where it runs and never in the first-load JS. */
import { useSyncExternalStore } from 'react';
import type Lenis from 'lenis';

let current: Lenis | null = null;
const subs = new Set<() => void>();

export const lenisStore = {
  get: () => current,
  set(l: Lenis | null) { current = l; subs.forEach((f) => f()); },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};

export const useLenis = () => useSyncExternalStore(lenisStore.subscribe, lenisStore.get, () => null);
