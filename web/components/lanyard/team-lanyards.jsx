/* eslint-disable react/no-unknown-property */
'use client';
/* Team lanyards — adapted from React Bits "Lanyard" (JS-CSS variant)
 * Source: https://reactbits.dev/components/lanyard   Registry: https://reactbits.dev/r/Lanyard-JS-CSS.json
 * Needs: three, @react-three/fiber, @react-three/drei, @react-three/rapier, meshline
 *   (the registry entry lists none of these — installed from the source's imports).
 *
 * Changes for Legit Forge (PLAN §6.8):
 *  - One Canvas and one physics world for every card (step 2), each hung over its column.
 *  - Assets load by URL from /public. card.glb had React Bits' logo baked into its 1678px
 *    texture; it now carries a 4×4 neutral texture (2.4MB -> 163KB) and both faces are
 *    painted at runtime from lib/card-art in our fonts and colours, per theme (steps 6, 8).
 *  - The band is our own woven strap, not the React Bits band.
 *  - A tap flips the card, a drag swings it (step 4); a flip controller settles it on the
 *    chosen face (step 5). A name-tag hover makes its card hop.
 *  - Shorter rope (0.5 vs 1) so the card is bigger in our 640px slot.
 *  - Rendering and physics pause while the section is off-screen. Physics starts paused,
 *    so the cards swing in the first time the section appears (step 3).
 *  - No box (plan F step 7): the canvas spans the strip's full width with headroom above and
 *    below, at the same 136px per world unit. Each band hangs over its card's column, measured
 *    from the DOM; the camera follows the strip's scrollLeft, so the 3D cards scroll with it.
 *    Only cards within a column of the view have a band (and a painted atlas), so 50 people
 *    cost what 5 do. The canvas ignores the pointer; events come from the stage element.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Lightformer } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import { drawBand, drawCardAtlas, loadCardFonts, loadCardPhotos } from '@/lib/card-art';

extend({ MeshLineGeometry, MeshLineMaterial });

const CARD_URL = '/lanyard/card.glb';
const SEG = 0.5;          // rope segment length
const PX = 136;           // pixels per world unit (sections.css sizes the 2D cards to match)
const HEAD = 160;         // px of canvas above the strip (sections.css .team-canvas top)
const TOP = 0.25;         // anchors sit this far below the strip's top (world units)
const FOV = 20;
const zFor = (h) => h / PX / 2 / Math.tan((FOV / 2) * Math.PI / 180);   // camera distance for 136px/unit

export default function TeamLanyards({ people, strip, stage, flipped, onToggleFlip, highlighted, theme, visible, onReady }) {
  const [band, setBand] = useState(null);
  const atlases = useRef(new Map());          // person id -> painted texture (this theme)
  const [painted, setPainted] = useState(0);  // bumps when atlases are added
  const [cols, setCols] = useState([]);       // each card column's centre, px from the strip's content start
  const [range, setRange] = useState([0, Math.min(people.length, 6) - 1]);
  // plan D #9: once the cards have dropped in, every card swings the same way together, once
  const [wave, setWave] = useState(0);
  useEffect(() => {
    if (!visible || !band || wave) return;
    const t = setTimeout(() => setWave(1), 1400);
    return () => clearTimeout(t);
  }, [visible, band, wave]);

  // measure the columns, and which of them are in (or one column beyond) the view
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const lis = [...el.querySelectorAll('.lanyard')];
      const box = el.getBoundingClientRect();
      setCols(lis.map((li) => { const r = li.getBoundingClientRect(); return r.left - box.left + el.scrollLeft + r.width / 2; }));
    };
    const inView = () => {
      raf = 0;
      const lis = el.querySelectorAll('.lanyard');
      const w = lis[0]?.offsetWidth || 280;
      const first = Math.max(0, Math.floor(el.scrollLeft / w) - 1);
      const last = Math.min(people.length - 1, Math.ceil((el.scrollLeft + el.clientWidth) / w) + 1);
      setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(inView); };
    measure(); inView();
    const ro = new ResizeObserver(() => { measure(); inView(); });
    ro.observe(el);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [strip, people.length]);

  // the band texture, and a fresh set of atlases, whenever the theme changes. Wait one frame
  // first: next-themes swaps the html class in its own effect, which runs AFTER this one.
  useEffect(() => {
    let alive = true;
    const raf = requestAnimationFrame(() => {
      loadCardFonts().then(() => {
        if (!alive) return;
        atlases.current.forEach((t) => t.dispose());
        atlases.current.clear();
        setBand((prev) => { prev?.dispose(); return drawBand(); });
        setPainted((n) => n + 1);
      });
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [theme]);

  // paint the atlases of the cards near the view, once each (photos load only for those)
  useEffect(() => {
    if (!band) return;
    const need = people.slice(range[0], range[1] + 1).filter((p) => !atlases.current.has(p.id));
    if (!need.length) return;
    let alive = true;
    loadCardPhotos(need).then((photos) => {
      if (!alive) return;
      need.forEach((p, i) => atlases.current.set(p.id, drawCardAtlas(p, photos[i])));
      setPainted((n) => n + 1);
    });
    return () => { alive = false; };
  }, [band, range, people, painted]);

  // new people data (an admin edit): repaint every atlas
  useEffect(() => {
    atlases.current.forEach((t) => t.dispose());
    atlases.current.clear();
    setPainted((n) => n + 1);
  }, [people]);

  useEffect(() => () => { atlases.current.forEach((t) => t.dispose()); }, []);

  const night = theme === 'dark';
  const shown = [];
  for (let i = range[0]; i <= range[1]; i++) {
    const p = people[i];
    if (p && atlases.current.has(p.id) && cols[i] != null) shown.push({ p, i });
  }

  return (
    <div className="team-canvas" aria-hidden="true">
      {/* R3F's Canvas suspends its PARENT while Rapier's WASM, the GLB and textures load;
          this boundary keeps that suspension inside the scene. */}
      <Suspense fallback={null}>
      <Canvas
        camera={{ position: [0, 0, zFor(1000)], fov: FOV }}
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true }}
        eventSource={stage.current ?? undefined}
        eventPrefix="client"
        resize={{ scroll: true, debounce: { scroll: 0, resize: 0 } }}
        onCreated={(state) => {
          state.gl.setClearColor(new THREE.Color(0x000000), 0);
          // events come from the stage (the canvas ignores the pointer), and the canvas sits
          // 160px above it and scrolls with the page: map the pointer from the canvas's real
          // on-screen box, or every tap and drag lands beside the card (flip + drag broke)
          state.setEvents({
            compute: (event, st) => {
              const r = st.gl.domElement.getBoundingClientRect();
              st.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
              st.raycaster.setFromCamera(st.pointer, st.camera);
            },
          });
        }}
      >
        <Follow strip={strip} />
        <ambientLight intensity={Math.PI} />
        <Physics gravity={[0, -40, 0]} timeStep={1 / 60} paused={!visible}>
          {band && shown.length > 0 && (
            <Suspense fallback={null}>
              <Bands shown={shown} cols={cols} atlases={atlases.current} band={band} flipped={flipped} onToggleFlip={onToggleFlip} highlighted={highlighted} wave={wave} />
              <Ready onReady={onReady} />
            </Suspense>
          )}
        </Physics>
        <Environment blur={0.75}>
          {/* warm heat light in Forge Night, neutral daylight in Workshop Day (step 8) */}
          <Lightformer intensity={2} color={night ? '#FFE2B0' : 'white'} position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color={night ? '#FFC24A' : 'white'} position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
      </Suspense>
    </div>
  );
}

/** Keeps 136px per unit at any canvas height, and slides the camera with the strip's scroll. */
function Follow({ strip }) {
  const camera = useThree((s) => s.camera);
  const h = useThree((s) => s.size.height);
  useEffect(() => { camera.position.z = zFor(h); camera.updateProjectionMatrix(); }, [camera, h]);
  useFrame(() => { camera.position.x = (strip.current?.scrollLeft ?? 0) / PX; });
  return null;
}

/** Tells the page the first frame with cards is on screen, so it can cross-fade the 2D cards out. */
function Ready({ onReady }) {
  useEffect(() => {
    let b;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => onReady?.()); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [onReady]);
  return null;
}

/** One band per card near the view, anchored over the centre of its column. The strip's
 *  content starts at the canvas's left edge, so column px map straight to world x (the camera
 *  adds the scroll). */
function Bands({ shown, cols, atlases, band, flipped, onToggleFlip, highlighted, wave }) {
  const size = useThree((s) => s.size);
  const y = size.height / 2 / PX - HEAD / PX - TOP;
  return shown.map(({ p, i }) => (
    <Band
      key={p.id}
      anchor={[(cols[i] - size.width / 2) / PX, y, 0]}
      atlas={atlases.get(p.id)}
      bandTexture={band}
      flipped={!!flipped[p.id]}
      highlighted={highlighted === p.id}
      onToggleFlip={() => onToggleFlip(p.id)}
      wave={wave}
    />
  ));
}

function Band({ anchor, atlas, bandTexture, flipped, highlighted, onToggleFlip, wave, maxSpeed = 50, minSpeed = 0 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef();
  const vec = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(CARD_URL, false); // false: no Draco, so no decoder fetched from a CDN
  // bodies start laid out sideways from the anchor; when physics un-pauses they swing down
  const [start] = useState(() => anchor);
  const [curve] = useState(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
  );
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);
  const down = useRef(null);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], SEG]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.5, 0]]);

  // keep the anchor over its column when the canvas resizes
  useEffect(() => {
    fixed.current?.setTranslation({ x: anchor[0], y: anchor[1], z: anchor[2] }, true);
    [j1, j2, j3, card].forEach((r) => r.current?.wakeUp());
  }, [anchor[0], anchor[1], anchor[2]]);

  // one kick when the face changes, so a flip feels snappy; the controller below settles it
  const firstFlip = useRef(true);
  useEffect(() => {
    if (firstFlip.current) { firstFlip.current = false; return; }
    const c = card.current;
    if (!c) return;
    const ang = c.angvel();
    c.setAngvel({ x: ang.x, y: ang.y + (flipped ? 6 : -6), z: ang.z }, true);
  }, [flipped]);

  // the shared hello: one sideways push, the same for every card
  useEffect(() => {
    if (!wave || !card.current) return;
    const v = card.current.linvel();
    card.current.setLinvel({ x: v.x + 4.5, y: v.y + 1, z: v.z }, true);
  }, [wave]);

  // a name tag was hovered or focused: that card hops
  useEffect(() => {
    if (!highlighted || !card.current) return;
    const v = card.current.linvel();
    card.current.setLinvel({ x: v.x, y: v.y + 3, z: v.z }, true);
  }, [highlighted]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? 'grabbing' : 'grab';
    return () => void (document.body.style.cursor = 'auto');
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z });
    }
    if (!fixed.current) return;
    [j1, j2].forEach((ref) => {
      if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
      const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
      // Capped at 1. React Bits passes delta × speed straight through; on any slow frame
      // (a hitch, a tab switch, a weak GPU) that exceeds 2 and the smoothing diverges,
      // flinging the band off-screen. A factor ≤ 1 can never overshoot.
      ref.current.lerped.lerp(ref.current.translation(), Math.min(1, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))));
    });
    curve.points[0].copy(j3.current.translation());
    curve.points[1].copy(j2.current.lerped);
    curve.points[2].copy(j1.current.lerped);
    curve.points[3].copy(fixed.current.translation());
    band.current.geometry.setPoints(curve.getPoints(32));

    // flip controller (§6.8 step 5): React Bits nudges the card toward its front; we nudge it
    // toward the chosen face — 0 for the front, π for the back — at the same strength.
    const target = flipped ? Math.PI : 0;
    const q = card.current.rotation();
    const yaw = 2 * Math.atan2(q.y, q.w);
    const error = Math.atan2(Math.sin(yaw - target), Math.cos(yaw - target));
    const ang = card.current.angvel();
    card.current.setAngvel({ x: ang.x, y: ang.y - error * 0.25, z: ang.z }, false);
  });

  curve.curveType = 'chordal';

  return (
    <>
      <RigidBody ref={fixed} {...segmentProps} type="fixed" position={start} />
      <RigidBody position={[start[0] + SEG, start[1], 0]} ref={j1} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={[start[0] + SEG * 2, start[1], 0]} ref={j2} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={[start[0] + SEG * 3, start[1], 0]} ref={j3} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={[start[0] + SEG * 4, start[1], 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
        <CuboidCollider args={[0.8, 1.125, 0.01]} />
        <group
          scale={2.25}
          position={[0, -1.2, -0.05]}
          onPointerOver={() => hover(true)}
          onPointerOut={() => hover(false)}
          onPointerDown={(e) => {
            // events come from the whole stage: a press on a name tag, button or link is theirs, not the card's
            if (e.nativeEvent.target?.closest?.('.name-tag, button, a')) return;
            e.target.setPointerCapture(e.pointerId);
            down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
            drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
          }}
          onPointerUp={(e) => {
            e.target.releasePointerCapture(e.pointerId);
            drag(false);
            const d = down.current;
            down.current = null;
            // a tap, not a drag: flip (step 4)
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 300) onToggleFlip();
          }}
        >
          <mesh geometry={nodes.card.geometry}>
            {/* satin, not mirror: a glossier card catches the studio light and washes out its face */}
            <meshPhysicalMaterial map={atlas} map-anisotropy={16} clearcoat={0.6} clearcoatRoughness={0.35} roughness={0.8} metalness={0.3} />
          </mesh>
          <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
          <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
        </group>
      </RigidBody>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={[1000, 1000]} useMap map={bandTexture} repeat={[-4, 1]} lineWidth={1} />
      </mesh>
    </>
  );
}

useGLTF.preload(CARD_URL, false);
