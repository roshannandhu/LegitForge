/** html[data-lite] (set before first paint by LITE_BOOT in lib/boot.ts): a weak device. */
export const isLite = () => typeof document !== 'undefined' && 'lite' in document.documentElement.dataset;
/** Touch-first screens scroll natively: Lenis does nothing there but add a per-frame loop. */
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
