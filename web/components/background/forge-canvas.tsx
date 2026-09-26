'use client';

/** Ember background for Forge Night (PLAN §5.6.4, animation #1).
 *  One fixed canvas behind everything. Count and speed follow `heat.value`; scroll energy
 *  (§23.3) works the bellows: scroll fast and more, faster, brighter sparks fly.
 *  Stops in Workshop Day, in hidden tabs, and when motion is off (one still frame). Weak
 *  devices get the still frame too; phones draw at 30 fps (sparks don't need 60). */

import { useEffect, useRef } from 'react';
import { heat } from '@/components/motion/heat-director';
import { energy } from '@/components/motion/energy';
import { useMotionEnabled } from '@/components/motion/motion-provider';
import { isLite } from '@/lib/lite';

type Ember = { x: number; y: number; vx: number; vy: number; age: number; ttl: number; r: number };

export function ForgeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const motionOn = useMotionEnabled();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const root = document.documentElement;
    const small = matchMedia('(max-width: 767px)').matches;
    const finePointer = matchMedia('(pointer: fine)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    const cap = small ? 60 : window.innerWidth < 1024 ? 100 : 160;
    const embers: Ember[] = [];
    const pointer = { x: -9999, y: -9999 };
    let colors = { lo: '#C8321E', hi: '#FFC24A' };
    let w = 0, h = 0, raf = 0, last = performance.now();

    const readColors = () => {
      const s = getComputedStyle(root);
      colors = { lo: s.getPropertyValue('--heat-lo').trim(), hi: s.getPropertyValue('--heat-hi').trim() };
    };
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (y = h + 8) => embers.push({
      x: Math.random() * w, y, vx: (Math.random() - 0.5) * 14, vy: -(24 + Math.random() * 46),
      age: 0, ttl: 2.5 + Math.random() * 3.5, r: 0.6 + Math.random() * 1.8,
    });
    const paint = (e: Ember, t: number) => {
      const k = e.age / e.ttl;
      ctx.globalAlpha = (1 - k) * (0.35 + 0.65 * t);
      ctx.fillStyle = k < 0.35 ? colors.hi : colors.lo;          // hot when young, cooler as it rises
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    };

    const frame = (now: number) => {
      if (small && now - last < 30) { raf = requestAnimationFrame(frame); return; }   // phones: 30 fps
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const en = energy.value;
      const t = Math.min(1, heat.value + en * 0.45);            // the bellows heat the forge
      const speed = 1 + en * 1.6;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const target = Math.round(cap * (0.25 + 0.75 * t) * (t < 0.1 ? 0.1 : 1));
      if (embers.length < target && Math.random() < 0.6 + en * 0.4) spawn();
      if (en > 0.3 && embers.length < target) spawn();            // a second spark per frame at speed
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.age += dt;
        const dx = e.x - pointer.x, dy = e.y - pointer.y;
        if (dx * dx + dy * dy < 14400) { e.vx += dx * 0.25 * dt; e.vy += dy * 0.25 * dt; }
        e.x += e.vx * dt * (0.6 + t);
        e.y += e.vy * dt * (0.6 + t) * speed;
        if (e.age >= e.ttl || e.y < -10) { embers.splice(i, 1); continue; }
        paint(e, t);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    };

    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const drawStill = () => {
      ctx.clearRect(0, 0, w, h);
      embers.length = 0;
      for (let i = 0; i < 40; i++) spawn(Math.random() * h);
      embers.forEach((e) => { e.age = Math.random() * e.ttl * 0.8; paint(e, 0.4); });
      ctx.globalAlpha = 1;
    };
    const sync = () => {
      readColors();
      stop();
      if (!root.classList.contains('dark') || document.hidden) { ctx.clearRect(0, 0, w, h); return; }
      if (!motionOn || isLite()) { drawStill(); return; }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onPointer = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; };

    resize();
    sync();
    const themeObserver = new MutationObserver(sync);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      stop();
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [motionOn]);

  return <canvas ref={ref} aria-hidden="true" className="forge-canvas" />;
}
