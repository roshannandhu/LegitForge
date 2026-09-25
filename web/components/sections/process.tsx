'use client';

/** Process "Hammer" (PLAN §6.6, animation #15). The molten line draws down the timeline
 *  as you scroll; each node glows as it is reached.
 *  Default CSS is the FINISHED frame — line fully drawn, every node reached — so motion-off
 *  visitors and no-JS readers see the whole timeline. The "not reached" look only applies
 *  while GSAP has marked the section as animated. */

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { PROCESS } from '@/lib/content';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function Process() {
  const motionOn = useMotionEnabled();
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
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

    return () => { delete section.dataset.animated; };
  }, { dependencies: [motionOn], revertOnUpdate: true, scope: ref });

  return (
    <section id="process" data-heat="0.9" className="section" ref={ref}>
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">How a project goes, week by week</h2>
          <p className="type-lead">No surprises: what happens, when, and what you get at every step.</p>
        </header>

        <ol className="steps">
          {PROCESS.map((s) => (
            <li key={s.n} className="step">
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
