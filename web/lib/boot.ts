/** Inline <head> scripts that run before first paint. Kept out of 'use client' modules:
 *  a string exported from one reaches a Server Component as a client reference, not text. */

export const REDUCED = '(prefers-reduced-motion: reduce)';

/** html[data-motion]: off when the device asks for reduced motion or the visitor turned
 *  "Animations" off in the footer (PLAN §5.5), so there is never a flash. */
export const MOTION_BOOT_SCRIPT =
  `try{var m=localStorage.getItem('lf-motion');var r=matchMedia('${REDUCED}').matches;` +
  `document.documentElement.dataset.motion=(m==='off'||r)?'off':'on'}catch(e){}`;

/** html[data-lite]: a weak device (≤ 3 GB RAM, ≤ 4 cores, Data Saver or a 2G connection) gets
 *  the same site with the costly extras off: no intro, a still ember frame, instant heat
 *  changes, no infinite decorative loops, off-screen sections skipped by the renderer. Decided
 *  before first paint. `?lite=1` / `?lite=0` force it (remembered) for testing. */
export const LITE_BOOT =
  `try{var d=document.documentElement,n=navigator,c=n.connection||{},q=/[?&]lite=([01])/.exec(location.search);` +
  `if(q)localStorage.setItem('lf-lite',q[1]);var f=localStorage.getItem('lf-lite');` +
  `var weak=(n.deviceMemory&&n.deviceMemory<=3)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4)||c.saveData||/2g/.test(c.effectiveType||'');` +
  `if(f==='1'||(f!=='0'&&weak))d.dataset.lite=''}catch(e){}`;

/** html[data-intro]: the Hallmark Strike (PLAN §6.1b) plays on a first visit to the home
 *  page with motion on, loaded at the top and not for review links. It clears itself. */
export const INTRO_BOOT =
  `try{var d=document.documentElement;if(d.dataset.motion==='on'&&!('lite' in d.dataset)&&location.pathname==='/'&&!location.hash` +
  `&&!/[?&](qa|lead)=/.test(location.search)&&!localStorage.getItem('lf-intro-seen')){` +
  `localStorage.setItem('lf-intro-seen','1');d.dataset.intro='1';` +
  `setTimeout(function(){delete d.dataset.intro},2300)}}catch(e){}`;

/** The Cleave as a page transition (PLAN §23.1): a project card opening its case study.
 *  Cross-document View Transitions, so the links stay plain <a> and nothing ships to the
 *  bundle; a browser without them simply navigates. Only card → case study animates (type
 *  "cleave", styled in app/globals.css); every other navigation skips the transition.
 *  Old page: the clicked card's cover is named project-cover, to morph into the case-study
 *  cover, and the header is named so it stays put instead of splitting with the page. New page: the transition runs only with motion on. */
export const CLEAVE_BOOT =
  `try{var CS=/^\\/work\\/[^/]+\\/?$/,card=null;` +
  `addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');card=a&&a.closest('[data-project-card]')},true);` +
  `addEventListener('pageswap',function(e){var v=e.viewTransition;if(!v)return;` +
  `var to=e.activation&&e.activation.entry&&new URL(e.activation.entry.url);` +
  `if(document.documentElement.dataset.motion==='on'&&card&&to&&to.origin===location.origin&&CS.test(to.pathname)){` +
  `var c=card.querySelector('.project-cover'),h=document.querySelector('.site-header');if(c)c.style.viewTransitionName='project-cover';if(h)h.style.viewTransitionName='site-header'}else v.skipTransition()});` +
  `addEventListener('pagereveal',function(e){var v=e.viewTransition;if(!v)return;` +
  `if(document.documentElement.dataset.motion==='on'&&CS.test(location.pathname))v.types.add('cleave');else v.skipTransition()})` +
  `}catch(e){}`;
