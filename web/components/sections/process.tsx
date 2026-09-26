'use client';

/** Process "Hammer" (PLAN §6.6, animation #15). The molten line draws down the timeline
 *  as you scroll; each node glows as it is reached.
 *  Tablets and laptops with motion on get the C2 sticky stack (§23.2): each step is a card
 *  pinned by CSS alone (position: sticky); the next one slides over it while GSAP settles the
 *  one beneath to 0.94 and dims it. Phones and motion off keep the timeline.
 *  Default CSS is the FINISHED frame — line fully drawn, every node reached — so motion-off
 *  visitors and no-JS readers see the whole timeline. The "not reached" look only applies
 *  while GSAP has marked the section as animated. */

import { useRef } from 'react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { useGsap } from '@/lib/gsap';
import type { PROCESS } from '@/lib/content';

/** What you get at each step, as a small object that drops onto the card when it pins
 *  (plan D #7): the scope document, the design link, the weekly preview, the keys. */
const OBJECTS = [
  <svg key="doc" viewBox="0 0 24 24"><path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21z" /><path d="M14 2.5V7h4M9 12h6M9 15h6M9 18h4" /></svg>,
  <svg key="link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1" /><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1" /></svg>,
  <svg key="preview" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="15" rx="2" /><path d="M2.5 8h19" /><path d="M8 13.5s1.6-2.5 4-2.5 4 2.5 4 2.5-1.6 2.5-4 2.5-4-2.5-4-2.5z" /></svg>,
  <svg key="key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4.5" /><path d="M11.2 11.8 20 3M16 7l2.5 2.5M18.5 4.5 21 7" /></svg>,
];

/** Keep in step with the .steps stack rules in sections.css. */
const STACK = '(min-width: 768px) and (min-height: 640px)';
const STACK_TOP = 96;       // under the 72 px header
const STACK_STEP = 16;      // each card peeks out this far below the one before
const STACK_GAP = 24;       // .steps gap in the stack

export function Process({ steps }: { steps: typeof PROCESS }) {
  const motionOn = useMotionEnabled();
  const ref = useRef<HTMLElement>(null);

  useGsap(({ gsap, ScrollTrigger }) => {
    if (!motionOn) return;
    const section = ref.current!;
    const list = section.querySelector<HTMLElement>('.steps')!;
    section.dataset.animated = 'true';

    // transform only: the line scales from 0 to 1 along Y (§5.1 — never animate height)
    gsap.fromTo(list, { '--line': 0 }, {
      '--line': 1, ease: 'none',
      scrollTrigger: { trigger: list, start: 'top 70%', end: 'bottom 60%', scrub: true },
    });

    gsap.utils.toArray<HTMLElement>('.step').forEach((step) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 62%',
        end: 'max',                                   // stays reached until you scroll back above it
        toggleClass: { targets: step, className: 'is-reached' },
      });
    });

    // C2: the card beneath settles back as the next one slides over it (CSS does the pinning)
    const mm = gsap.matchMedia();
    mm.add(STACK, () => {
      const cards = gsap.utils.toArray<HTMLElement>('.step', section);
      cards.slice(0, -1).forEach((card, i) => {
        gsap.to(card, {
          scale: 0.94, filter: 'brightness(.72)', ease: 'none',
          scrollTrigger: {
            trigger: cards[i + 1],
            // from the moment this card is pinned and the next one touches it, to the next one pinning
            start: () => `top ${STACK_TOP + i * STACK_STEP + card.offsetHeight + STACK_GAP}px`,
            end: `top ${STACK_TOP + (i + 1) * STACK_STEP}px`,
            scrub: true, invalidateOnRefresh: true,
          },
        });
      });
    });

    return () => { mm.revert(); delete section.dataset.animated; };
  }, { dependencies: [motionOn], scope: ref });

  return (
    <section id="process" data-heat="0.9" className="section" ref={ref}>
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">How a project goes, week by week</h2>
          <p className="type-lead">No surprises: what happens, when, and what you get at every step.</p>
        </header>

        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.n} className="step" style={{ '--i': i } as React.CSSProperties}>
              <span className="step-node" aria-hidden="true"><span className="num">{s.n}</span></span>
              <div className="step-body">
                <div className="step-title">
                  <h3 className="type-h3">{s.step}</h3>
                  <span className="step-when num">{s.when}</span>
                </div>
                <p className="step-what">{s.what}</p>
              </div>
              <p className="step-get">
                <span className="step-obj" aria-hidden="true">{OBJECTS[i] ?? OBJECTS[0]}</span>
                <span><span className="type-label">You get</span>{s.get}</span>
              </p>
            </li>
          ))}
        </ol>
        <p className="steps-note">Typical for a five-page website. Bigger projects get their own plan.</p>
      </div>
    </section>
  );
}
