/** Inline <head> scripts that run before first paint. Kept out of 'use client' modules:
 *  a string exported from one reaches a Server Component as a client reference, not text. */

export const REDUCED = '(prefers-reduced-motion: reduce)';

/** html[data-motion]: off when the device asks for reduced motion or the visitor turned
 *  "Animations" off in the footer (PLAN §5.5), so there is never a flash. */
export const MOTION_BOOT_SCRIPT =
  `try{var m=localStorage.getItem('lf-motion');var r=matchMedia('${REDUCED}').matches;` +
  `document.documentElement.dataset.motion=(m==='off'||r)?'off':'on'}catch(e){}`;

/** html[data-intro]: the Hallmark Strike (PLAN §6.1b) plays on a first visit to the home
 *  page with motion on, loaded at the top and not for review links. It clears itself. */
export const INTRO_BOOT =
  `try{var d=document.documentElement;if(d.dataset.motion==='on'&&location.pathname==='/'&&!location.hash` +
  `&&!/[?&](qa|lead)=/.test(location.search)&&!localStorage.getItem('lf-intro-seen')){` +
  `localStorage.setItem('lf-intro-seen','1');d.dataset.intro='1';` +
  `setTimeout(function(){delete d.dataset.intro},2300)}}catch(e){}`;
