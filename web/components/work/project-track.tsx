'use client';

/** Projects motion (PLAN §6.7, animations #16–18) as an effect beside server-rendered cards.
 *  - Cooling (C4 forge line): each cover enters heat-tinted and cools to full colour.
 *  - Stamps: LIVE / IN USE punch in once, with a 2 px shake of the card.
 *  - Pinned sideways track on desktop, only when the cards overflow the row (§6.7 edge case:
 *    too few projects -> no pin). Keyboard focus in a card jumps the page to show it.
 *  Phones: stamps only, when a card is 60 % on screen (page and row); no cooling.
 *  Motion off: nothing runs; stamps sit still in place. */

import { useRef } from 'react';
import { useLenis } from 'lenis/react';
import { useGsap, type Gs } from '@/lib/gsap';
import { useMotionEnabled } from '@/components/motion/motion-provider';

function stampIn(gsap: Gs['gsap'], card: HTMLElement, stamp: Element) {
  gsap.timeline()
    .fromTo(stamp, { autoAlpha: 0, scale: 1.4, rotate: -12 },
      { autoAlpha: 1, scale: 1, rotate: -6, duration: 0.45, ease: 'back.out(2)' })
    .to(card, { x: '+=2', duration: 0.04, yoyo: true, repeat: 3, ease: 'none' }, '-=0.12');
}

export function ProjectTrack() {
  const marker = useRef<HTMLSpanElement>(null);
  const motionOn = useMotionEnabled();
  const lenis = useLenis();

  useGsap(({ gsap, ScrollTrigger }) => {
    const section = marker.current?.closest('section');
    const track = section?.querySelector<HTMLElement>('.projects');
    if (!motionOn || !section || !track) return;
    const cards = [...track.querySelectorAll<HTMLElement>('[data-project-card]')];
    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      const distance = () => track.scrollWidth - track.clientWidth;
      const pinned = distance() > 8;
      const move = pinned
        ? gsap.to(track, {
            x: () => -distance(), ease: 'none',                 // 'none' is required for containerAnimation
            scrollTrigger: { trigger: section, start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true },
          })
        : undefined;
      if (move) section.dataset.pinnedTrack = '';

      cards.forEach((card) => {
        gsap.fromTo(card, { '--card-heat': 1 }, {
          '--card-heat': 0, ease: 'none',
          scrollTrigger: move
            ? { trigger: card, containerAnimation: move, start: 'left 100%', end: 'left 72%', scrub: true }   // the last card stops near 70 %
            : { trigger: card, start: 'top 95%', end: 'top 45%', scrub: true },
        });
        const stamp = card.querySelector('[data-stamp]');
        if (!stamp) return;
        gsap.set(stamp, { autoAlpha: 0 });
        ScrollTrigger.create({
          trigger: card, once: true,
          ...(move ? { containerAnimation: move, start: 'left 80%' } : { start: 'top 60%' }),
          onEnter: () => stampIn(gsap, card, stamp),
        });
      });

      // keyboard in pinned mode: focus inside a card scrolls the page to where it is in view
      const onFocus = (e: FocusEvent) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-project-card]');
        const st = move?.scrollTrigger;
        if (!card || !st) return;
        const progress = Math.min(1, card.offsetLeft / Math.max(1, distance()));
        const y = st.start + progress * (st.end - st.start);
        if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      };
      track.addEventListener('focusin', onFocus);
      return () => { track.removeEventListener('focusin', onFocus); delete section.dataset.pinnedTrack; };
    });

    mm.add('(max-width: 1023px)', () => {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const card = en.target as HTMLElement;
          const stamp = card.querySelector('[data-stamp]');
          if (stamp) stampIn(gsap, card, stamp);
          io.unobserve(card);
        });
      }, { threshold: 0.6 });   // viewport root: counts both page scroll and the row's clipping
      cards.forEach((card) => {
        const stamp = card.querySelector('[data-stamp]');
        if (!stamp) return;
        gsap.set(stamp, { autoAlpha: 0 });
        io.observe(card);
      });
      return () => io.disconnect();
    });
  }, { dependencies: [motionOn, lenis] });

  return <span ref={marker} hidden />;
}
