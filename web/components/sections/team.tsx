'use client';

/** Team "Two people. Both of us build." (PLAN §6.8) — three layers, one state:
 *
 *  1. Server HTML: 2D ID cards hanging from CSS straps. Real text (crawlable), correct with
 *     no JS, and what everyone sees until the section scrolls near.
 *  2. FlipCard (React Bits): motion off, Data Saver, no WebGL2 or fewer than 4 cores. Tap to
 *     flip, drag with momentum on a mouse, tilt + glare. Loaded only when the section is near.
 *  3. 3D lanyards (React Bits Lanyard, R3F + Rapier): every screen with WebGL2 and motion on,
 *     phones too (the owner's call: the same ID cards as on a laptop). Tap to flip; a mouse
 *     also drags them to swing (a finger scrolls instead). Loaded only when near, then
 *     cross-faded over the 2D cards once its first frame is drawn.
 *
 *  The name tags are the accessible interface in every layer: names as text and
 *  "Flip [name]'s card" buttons with aria-pressed. Card visuals are aria-hidden.
 *
 *  Any number of people (plan F step 7): every layer lives in one borderless, full-bleed
 *  strip that scrolls sideways (snap, touch, trackpad, shift-wheel, arrow buttons, keyboard
 *  focus). The 3D canvas spans the whole width and extends above and below the cards, so a
 *  swinging card never meets an edge; its camera follows the strip's scroll. */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useTheme } from 'next-themes';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { CardBack, CardFront } from '@/components/team/card-faces';
import type { CardPerson } from '@/lib/card-art';
import type { Card } from '@/lib/team';
import { SITE, capacityLine } from '@/lib/site';

/** 3D wherever the device can draw it (§6.8 tiers; phones included since 27 Sep). Touch
 *  gets tap-to-flip only (team-lanyards.jsx), so swipes still scroll the page and the row. */
function canRun3d() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
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
  strip: React.RefObject<HTMLUListElement | null>;
  stage: React.RefObject<HTMLDivElement | null>;
  flipped: Record<string, boolean>;
  onToggleFlip: (id: string) => void;
  highlighted: string | null;
  theme?: string;
  visible: boolean;
  onReady: () => void;
}

/** The 3D scene is the only part of the section that needs the theme: reading it here, not in
 *  Team, keeps a theme switch from re-rendering every card (a long task on a 2 GB phone). */
function ThemedScene({ Scene, ...props }: Omit<SceneProps, 'theme'> & { Scene: ComponentType<SceneProps> }) {
  const { resolvedTheme } = useTheme();
  return <Scene {...props} theme={resolvedTheme} />;
}

/** `head={false}` on /team, where the page header already carries this heading and lead. */
export function Team({ team, head = true }: { team: Card[]; head?: boolean }) {
  // stable identity: the 3D scene repaints its textures when this changes. Only the real team:
  // the "Card 003 is yours / Client" card was removed (the owner's call, 28 Sep).
  const people = useMemo<CardPerson[]>(() => team.map((m) => ({
    id: m.slug, idCode: m.idCode, name: m.name, role: m.role, initials: m.initials,
    skills: m.skills, shipped: m.shipped, favorite: m.favorite, photo: m.photo, building: m.building,
  })), [team]);
  const pathOf = useMemo(() => new Map(team.map((m) => [m.slug, m.path])), [team]);
  const motionOn = useMotionEnabled();
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });   // at the strip's ends? (hides the arrows)

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
    // Always true in the browser. On the server NEXT_RUNTIME is a build-time constant, so the
    // server bundle leaves out three.js, Rapier and FlipCard (~1.1 MB gzip): the Worker then
    // fits the Workers Free 3 MB limit.
    if (!process.env.NEXT_RUNTIME) {
      if (use3d && !Scene) {
        import('@/components/lanyard/team-lanyards').then((m) => alive && setScene(() => m.default as unknown as ComponentType<SceneProps>));
      }
      if (!use3d && !Flip) {
        import('@/components/react-bits/flip-card').then((m) => alive && setFlip(() => m.default as unknown as ComponentType<FlipCardProps>));
      }
    }
    return () => { alive = false; };
  }, [near, use3d, Scene, Flip]);

  useEffect(() => { if (!use3d) setSceneReady(false); }, [use3d]);

  // the arrows appear only when the strip overflows, and dim at its ends
  useEffect(() => {
    const el = stripRef.current!;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      setEdges((e) => {
        const n = { start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 };
        return n.start === e.start && n.end === e.end ? e : n;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [people.length]);

  const page = (dir: -1 | 1) => {
    const el = stripRef.current!;
    const col = el.querySelector<HTMLElement>('.lanyard')?.offsetWidth ?? 300;
    const step = Math.max(col, Math.floor(el.clientWidth / col - 1) * col);
    el.scrollBy({ left: dir * step, behavior: motionOn ? 'smooth' : 'auto' });
  };

  const mode = use3d && Scene ? '3d' : !use3d && Flip ? 'flip' : 'static';

  return (
    <section id="team" data-heat="0.7" className="section team-section" ref={sectionRef}>
      <div className="wrap">
        {head && (
          <header className="section-head">
            <h2 className="type-h2">Two people. Both of us build.</h2>
            <p className="type-lead">
              No account managers, no juniors, no handoffs. The person who answers your first WhatsApp
              message is the person writing your code.{capacityLine()}
            </p>
          </header>
        )}
        <div className="team-bar" data-overflow={edges.start && edges.end ? undefined : ''}>
          <p className="team-count num">{String(people.length).padStart(2, '0')} people · scroll for every card</p>
          <div className="team-arrows">
            <button type="button" className="strip-btn" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous cards">←</button>
            <button type="button" className="strip-btn" onClick={() => page(1)} disabled={edges.end} aria-label="Next cards">→</button>
          </div>
        </div>
      </div>

      <div className="team-stage" ref={stageRef} data-mode={mode} data-3d-ready={mode === '3d' && sceneReady ? 'true' : undefined}>
          <ul className="lanyards" ref={stripRef} aria-label="Team cards">
            {people.map((p) => (
              <li key={p.id} className="lanyard">
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
                      glareOpacity={0.06}
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
                  <p className="name-tag-name">{p.name}</p>
                  <p className="name-tag-role">{p.role}</p>
                  <div className="name-tag-actions">
                    <button type="button" className="flip-btn" aria-pressed={!!flipped[p.id]} onClick={() => toggle(p.id)}>
                      Flip {p.name}’s card
                    </button>
                    <a className="text-link" href={pathOf.get(p.id) ?? `/team/${p.id}`}>Open {p.name}’s portfolio</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {mode === '3d' && Scene && (
            <ThemedScene
              Scene={Scene}
              people={people}
              strip={stripRef}
              stage={stageRef}
              flipped={flipped}
              onToggleFlip={toggle}
              highlighted={highlighted}
              visible={visible}
              onReady={onReady}
            />
          )}
      </div>
    </section>
  );
}
