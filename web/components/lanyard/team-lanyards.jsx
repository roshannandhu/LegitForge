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
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Lightformer } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import { drawBand, drawCardAtlas, loadCardFonts } from '@/lib/card-art';

extend({ MeshLineGeometry, MeshLineMaterial });

const CARD_URL = '/lanyard/card.glb';
const SEG = 0.5;          // rope segment length
const CAMERA_Z = 13.3;    // fov 20 -> 4.69 world units tall = 136px/unit in a 640px slot
const TOP = 0.25;         // anchors sit this far below the canvas top (world units)

export default function TeamLanyards({ people, flipped, onToggleFlip, highlighted, theme, visible, onReady }) {
  const [art, setArt] = useState(null);

  // Paint card atlases + band once fonts are ready, and again when the theme changes.
  // Wait one frame first: next-themes swaps the html class in its own effect, which runs
  // AFTER this child effect, so reading tokens immediately would paint the old theme.
  useEffect(() => {
    let alive = true;
    let raf = 0;
    loadCardFonts().then(() => {
      raf = requestAnimationFrame(() => {
        if (!alive) return;
        const next = { atlases: people.map(drawCardAtlas), band: drawBand() };
        setArt((prev) => {
          prev?.atlases.forEach((t) => t.dispose());
          prev?.band.dispose();
          return next;
        });
      });
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [people, theme]);

  const night = theme === 'dark';

  return (
    <div className="team-canvas" aria-hidden="true">
      {/* R3F's Canvas suspends its PARENT while Rapier's WASM, the GLB and textures load;
          this boundary keeps that suspension inside the scene. */}
      <Suspense fallback={null}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: 20 }}
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      >
        <ambientLight intensity={Math.PI} />
        <CameraAdjuster />
        <Physics gravity={[0, -40, 0]} timeStep={1 / 60} paused={!visible}>
          {art && (
            <Suspense fallback={null}>
              <Bands people={people} art={art} flipped={flipped} onToggleFlip={onToggleFlip} highlighted={highlighted} />
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

/** Adjusts camera distance when the canvas has a narrower aspect ratio so all 3 cards fit nicely */
function CameraAdjuster() {
  const { camera, size } = useThree();
  useFrame(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const targetZ = CAMERA_Z * Math.max(1, 1.45 / Math.max(aspect, 0.45));
    if (Math.abs(camera.position.z - targetZ) > 0.02) {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.1);
      camera.updateProjectionMatrix();
    }
  });
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

/** One band per person, anchored over the centre of its column (columns are equal thirds). */
function Bands({ people, art, flipped, onToggleFlip, highlighted }) {
  const viewport = useThree((s) => s.viewport);
  const n = people.length;
  const span = viewport.width / n;
  const y = viewport.height / 2 - TOP;
  return people.map((p, i) => (
    <Band
      key={p.id}
      anchor={[(i - (n - 1) / 2) * span, y, 0]}
      atlas={art.atlases[i]}
      bandTexture={art.band}
      flipped={!!flipped[p.id]}
      highlighted={highlighted === p.id}
      onToggleFlip={() => onToggleFlip(p.id)}
    />
  ));
}

function Band({ anchor, atlas, bandTexture, flipped, highlighted, onToggleFlip, maxSpeed = 50, minSpeed = 0 }) {
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
