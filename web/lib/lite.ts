/** Touch-first screens scroll natively: Lenis does nothing there but add a per-frame loop. */
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
/** The near-observers run: LITE_BOOT's 8 s safety net (show everything) is then not needed. */
export const markNearJs = () => { const d = document.documentElement.dataset; if (!('nearJs' in d)) d.nearJs = ''; };
