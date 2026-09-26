/** Scroll energy (PLAN §23.3): 0 at rest, toward 1 when the visitor scrolls fast. Scrolling
 *  works the bellows. Written by SmoothScroll (from Lenis's velocity), decayed on GSAP's
 *  ticker, read every frame by the ember canvas, and published as --scroll-energy for CSS.
 *  With motion off Lenis is off, so nothing writes it and it stays 0. */
export const energy = { value: 0, target: 0 };

let written = -1;
let rod: HTMLElement | null | undefined;
export function writeEnergyVar() {
  const v = Math.round(energy.value * 100) / 100;          // two decimals: no style churn at rest
  if (v === written) return;
  written = v;
  // on the one element that reads it: a variable on <html> would restyle the whole page every frame
  (rod ??= document.querySelector<HTMLElement>('.heat-rod'))?.style.setProperty('--scroll-energy', String(v));
}
