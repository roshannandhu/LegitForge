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
              <p className="step-get"><span className="type-label">You get</span>{s.get}</p>
            </li>
          ))}
        </ol>
        <p className="steps-note">Typical for a five-page website. Bigger projects get their own plan.</p>
      </div>
    </section>
  );
}
