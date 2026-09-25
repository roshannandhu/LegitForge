'use client';

/** Team "Two people. Both of us build." (PLAN §6.8) — three layers, one state:
 *
 *  1. Server HTML: 2D ID cards hanging from CSS straps. Real text (crawlable), correct with
 *     no JS, and what everyone sees until the section scrolls near.
 *  2. FlipCard (React Bits): phones, tablets, touch screens and motion-off. Tap to flip,
 *     drag with momentum on a mouse, tilt + glare. Loaded only when the section is near.
 *  3. 3D lanyards (React Bits Lanyard, R3F + Rapier): mouse users on ≥1024px screens with
 *     WebGL2 and motion on. Drag to swing, tap to flip. Loaded only when near, then
 *     cross-faded over the 2D cards once its first frame is drawn.
 *
 *  The name tags are the accessible interface in every layer: names as text and
 *  "Flip [name]'s card" buttons with aria-pressed. Card visuals are aria-hidden. */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useTheme } from 'next-themes';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { AnvilMark } from '@/components/ui/icons';
import type { CardPerson } from '@/lib/card-art';
import type { TEAM } from '@/lib/content';
import { SITE } from '@/lib/site';

// Card 003 is yours: two cards look sparse, and a hiring ad from a two-person studio
// reads as premature. It looks like a team card, so people flip it (§6.8).
const VISITOR: CardPerson = {
  id: 'you', idCode: 'LF-003', name: 'You', role: 'Client', initials: '?', skills: [], shipped: '', favorite: '', visitor: true,
};

/** 3D only where it earns its weight (§6.8 tiers). A fine pointer is required because
 *  touch-drag fights page scrolling; everything else gets FlipCard. */
function canRun3d() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (!matchMedia('(pointer: fine)').matches || innerWidth < 1024) return false;
  if ((nav.hardwareConcurrency ?? 4) < 4) return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return false;
  gl.getExtension('WEBGL_lose_context')?.loseContext();   // free the test context
  return true;
}

/** Typed boundary for the two vendored JS components: exactly the props this page passes. */
interface FlipCardProps {
  className?: string;
  presentational?: boolean;
  reduceMotion?: boolean;
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  front?: React.ReactNode;
  back?: React.ReactNode;
  draggable?: boolean;
  tiltMax?: number;
  glareOpacity?: number;
  hoverScale?: number;
  perspective?: number;
  stiffness?: number;
  damping?: number;
  radius?: number;
  background?: string;
  color?: string;
  shadowOpacity?: number;
}
interface SceneProps {
  people: CardPerson[];
  flipped: Record<string, boolean>;
  onToggleFlip: (id: string) => void;
  highlighted: string | null;
  theme?: string;
  visible: boolean;
  onReady: () => void;
}

export function Team({ team }: { team: typeof TEAM }) {
  // stable identity: the 3D scene repaints its textures when this changes
  const people = useMemo<CardPerson[]>(() => [
    ...team.map((m) => ({
      id: m.slug, idCode: m.idCode, name: m.name, role: m.role, initials: m.initials,
      skills: m.skills, shipped: m.shipped, favorite: m.favorite, photo: m.photo,
    })),
    VISITOR,
  ], [team]);
  const motionOn = useMotionEnabled();
  const { resolvedTheme } = useTheme();
  const sectionRef = useRef<HTMLElement>(null);

  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [near, setNear] = useState(false);          // within 800px: start loading
  const [visible, setVisible] = useState(false);    // on screen: render + simulate
  const [capable, setCapable] = useState(false);
  const [fine, setFine] = useState(false);
  const [Flip, setFlip] = useState<ComponentType<FlipCardProps> | null>(null);
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const toggle = useCallback((id: string) => setFlipped((f) => ({ ...f, [id]: !f[id] })), []);
  const setFace = (id: string, v: boolean) => setFlipped((f) => (!!f[id] === v ? f : { ...f, [id]: v }));
  const onReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    setCapable(canRun3d());
    setFine(matchMedia('(pointer: fine)').matches);
    const el = sectionRef.current!;
    const nearIO = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); nearIO.disconnect(); }
    }, { rootMargin: '800px 0px' });
    const visIO = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    nearIO.observe(el);
    visIO.observe(el);
    return () => { nearIO.disconnect(); visIO.disconnect(); };
  }, []);

  const use3d = near && capable && motionOn;

  // load whichever layer is needed, once; keep both cached if motion is toggled
  useEffect(() => {
    if (!near) return;
    let alive = true;
    if (use3d && !Scene) {
      import('@/components/lanyard/team-lanyards').then((m) => alive && setScene(() => m.default as unknown as ComponentType<SceneProps>));
    }
    if (!use3d && !Flip) {
      import('@/components/react-bits/flip-card').then((m) => alive && setFlip(() => m.default as unknown as ComponentType<FlipCardProps>));
    }
    return () => { alive = false; };
  }, [near, use3d, Scene, Flip]);

  useEffect(() => { if (!use3d) setSceneReady(false); }, [use3d]);

  const mode = use3d && Scene ? '3d' : !use3d && Flip ? 'flip' : 'static';

  return (
    <section id="team" data-heat="0.7" className="section" ref={sectionRef}>
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Two people. Both of us build.</h2>
          <p className="type-lead">
            No account managers, no juniors, no handoffs. The person who answers your first WhatsApp
            message is the person writing your code. We take {SITE.projectsAtATime} projects at a time,
            which is why we can tell you exactly what you’ll get and when.
          </p>
        </header>

        <div className="team-stage" data-mode={mode} data-3d-ready={mode === '3d' && sceneReady ? 'true' : undefined}>
          <ul className="lanyards">
            {people.map((p) => (
              <li key={p.id} className={`lanyard${p.visitor ? ' lanyard-you' : ''}`}>
                <div className="card-slot">
                  <span className="strap" aria-hidden="true" />
                  {mode === 'flip' && Flip ? (
                    <Flip
                      className="id-card team-flip"
                      presentational
                      reduceMotion={!motionOn}
                      flipped={!!flipped[p.id]}
                      onFlipChange={(v: boolean) => setFace(p.id, v)}
                      front={<CardFront p={p} />}
                      back={<CardBack p={p} />}
                      draggable={fine}
                      tiltMax={8}
                      glareOpacity={0.18}
                      hoverScale={1.02}
                      perspective={1100}
                      stiffness={170}
                      damping={20}
                      radius={16}
                      background="var(--surface)"
                      color="var(--text)"
                      shadowOpacity={0.3}
                    />
                  ) : (
                    <div className="id-card id-static" data-flipped={!!flipped[p.id]} aria-hidden="true" onClick={() => toggle(p.id)}>
                      <div className="id-face id-front"><CardFront p={p} /></div>
                      <div className="id-face id-back"><CardBack p={p} /></div>
                    </div>
                  )}
                </div>

                <div
                  className="name-tag"
                  onPointerEnter={() => setHighlighted(p.id)}
                  onPointerLeave={() => setHighlighted(null)}
                  onFocus={() => setHighlighted(p.id)}
                  onBlur={() => setHighlighted(null)}
                >
                  {p.visitor ? (
                    <>
                      <p className="name-tag-name">Card 003 is yours</p>
                      <p className="name-tag-role">Every project starts as a blank card.</p>
                      <div className="name-tag-actions">
                        <button type="button" className="flip-btn" aria-pressed={!!flipped[p.id]} onClick={() => toggle(p.id)}>
                          Flip card 003
                        </button>
                        <a className="text-link" href="#contact">Tell us what you’re building</a>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="name-tag-name">{p.name}</p>
                      <p className="name-tag-role">{p.role}</p>
                      <button type="button" className="flip-btn" aria-pressed={!!flipped[p.id]} onClick={() => toggle(p.id)}>
                        Flip {p.name}’s card
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {mode === '3d' && Scene && (
            <Scene
              people={people}
              flipped={flipped}
              onToggleFlip={toggle}
              highlighted={highlighted}
              theme={resolvedTheme}
              visible={visible}
              onReady={onReady}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------ card faces (2D layers) */
function CardFront({ p }: { p: CardPerson }) {
  return (
    <div className="id-face-inner">
      <div className="id-top"><AnvilMark className="id-mark" /><span className="id-code num">{p.idCode}</span></div>
      <div className={`id-photo${p.visitor ? ' id-photo-empty' : ''}`}>
        {p.photo ? <img src={p.photo} alt="" loading="lazy" decoding="async" /> : <span>{p.initials}</span>}
      </div>
      <p className="id-name">{p.name}</p>
      <p className="id-role">{p.role}</p>
      <span className="id-seal">Legit</span>
    </div>
  );
}

function CardBack({ p }: { p: CardPerson }) {
  if (p.visitor) {
    return (
      <div className="id-face-inner id-back-inner id-back-you">
        <p className="id-you-line">Every project starts as a blank card.</p>
        <p className="id-you-sub">Tell us what you’re building.</p>
      </div>
    );
  }
  return (
    <div className="id-face-inner id-back-inner">
      <p className="id-back-h">Skills</p>
      <ul className="id-skills">{p.skills.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="id-stat"><span>Projects shipped</span><strong className="num">{p.shipped}</strong></p>
      <p className="id-stat"><span>Favourite build</span><strong>{p.favorite}</strong></p>
    </div>
  );
}
