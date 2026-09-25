/** Each Teardown layer's working flow (PLAN §6.2c), about 2.2 s, from its start state to the
 *  final frame the markup already shows (layer-screens.tsx). Hidden-until-their-turn elements
 *  use set(), never a short from(): a from() would snap straight back to visible. Text that
 *  changes during a flow is restored by its last call. */

import type { gsap as Gsap } from 'gsap';
import type { LayerId } from '@/lib/teardown';

type G = typeof Gsap;
type TL = ReturnType<G['timeline']>;
const f = (root: Element, key: string) => [...root.querySelectorAll<HTMLElement>(`[data-f="${key}"]`)];

function count(tl: TL, el: HTMLElement | undefined, at: number, dur: number, show: (v: number) => string) {
  if (!el) return;
  const final = el.textContent ?? '';
  const end = Number(final.replace(/[^\d.]/g, ''));
  const o = { v: 0 };
  tl.call(() => { el.textContent = show(0); }, [], at - 0.001)
    .to(o, { v: end, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = show(o.v); } }, at)
    .call(() => { el.textContent = final; }, [], at + dur);
}

const FLOWS: Record<LayerId, (r: Element, gsap: G) => TL> = {
  web(r, gsap) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.set([...f(r, 'speed'), ...f(r, 'toast')], { opacity: 0 }, 0)
      .from(f(r, 'img'), { opacity: 0, y: 10, duration: 0.35 }, 0)
      .from(f(r, 'line'), { scaleX: 0, transformOrigin: 'left center', duration: 0.3, stagger: 0.08 }, 0.15)
      .from(f(r, 'btn'), { opacity: 0, y: 6, duration: 0.3 }, 0.35)
      .fromTo(f(r, 'ripple'), { scale: 0, opacity: 0.8 }, { scale: 2.6, opacity: 0, duration: 0.4, immediateRender: false }, 0.8)
      .to(f(r, 'btn'), { scale: 0.93, duration: 0.07, yoyo: true, repeat: 1 }, 0.8)
      .to(f(r, 'speed'), { opacity: 1, duration: 0.25 }, 1.0);
    count(tl, f(r, 'score')[0], 1.0, 0.7, (v) => String(Math.round(v)));
    tl.to(f(r, 'toast'), { opacity: 1, duration: 0.3 }, 1.75)
      .from(f(r, 'toast'), { y: 10, duration: 0.3 }, 1.75);
    return tl;
  },
  wa(r, gsap) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    const [m1, m2, m3] = [f(r, 'm1'), f(r, 'm2'), f(r, 'm3')];
    const ticks = f(r, 'ticks')[0], typing = f(r, 'typing')[0];
    tl.set([...m1, ...m2, ...m3], { opacity: 0, y: 8 }, 0)
      .call(() => ticks?.classList.remove('read'), [], 0)
      .to(m1, { opacity: 1, y: 0, duration: 0.3 }, 0.1)
      .to(m2, { opacity: 1, y: 0, duration: 0.3 }, 0.7);
    if (typing) {
      tl.set(typing, { display: 'flex' }, 1.05)
        .fromTo(typing.children, { opacity: 0.25 }, { opacity: 1, duration: 0.15, stagger: 0.08, repeat: 2, yoyo: true, immediateRender: false }, 1.05)
        .set(typing, { display: 'none' }, 1.6);
    }
    tl.to(m3, { opacity: 1, y: 0, duration: 0.3 }, 1.6)
      .call(() => ticks?.classList.add('read'), [], 2.1);
    return tl;
  },
  n8n(r, gsap) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    const nodes = f(r, 'node'), outs = f(r, 'out'), packet = f(r, 'packet')[0];
    tl.set(nodes, { opacity: 0.35 }, 0).set(outs, { opacity: 0, x: -4 }, 0);
    if (packet) tl.set(packet, { opacity: 1, y: 0 }, 0);
    nodes.forEach((n, i) => {
      const at = 0.15 + i * 0.45;
      if (packet && i) tl.to(packet, { y: () => n.offsetTop - nodes[0].offsetTop, duration: 0.3, ease: 'power1.inOut' }, at - 0.3);
      tl.to(n, { opacity: 1, duration: 0.15 }, at).to(outs[i], { opacity: 1, x: 0, duration: 0.25 }, at + 0.05);
    });
    if (packet) tl.to(packet, { opacity: 0, duration: 0.2 }, 1.95);
    return tl;
  },
  quote(r, gsap) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    const status = f(r, 'status')[0];
    const finalStatus = status?.textContent ?? '';
    tl.set(f(r, 'stamp'), { opacity: 0 }, 0)
      .from(f(r, 'row'), { opacity: 0, x: -8, duration: 0.25, stagger: 0.15 }, 0.05);
    count(tl, f(r, 'total')[0], 0.4, 0.7, (v) => `₹${Math.round(v).toLocaleString('en-IN')}`);
    tl.call(() => { if (status) status.textContent = 'Sent as a link'; }, [], 1.15)
      .call(() => { if (status) status.textContent = 'Opened twice'; }, [], 1.45)
      .call(() => { if (status) status.textContent = finalStatus; }, [], 1.75)
      .fromTo(f(r, 'stamp'), { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power4.in', immediateRender: false }, 1.75);
    return tl;
  },
  warranty(r, gsap) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.set([...f(r, 'stamp'), ...f(r, 'remind')], { opacity: 0 }, 0)
      .from(f(r, 'qr'), { opacity: 0, scale: 0.8, duration: 0.3 }, 0.05)
      .fromTo(f(r, 'scan'), { yPercent: 0, opacity: 1 }, { yPercent: 2400, duration: 0.7, ease: 'power1.inOut', immediateRender: false }, 0.4)
      .set(f(r, 'scan'), { opacity: 0 }, 1.1)
      .fromTo(f(r, 'stamp'), { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power4.in', immediateRender: false }, 1.15)
      .to(f(r, 'remind'), { opacity: 1, duration: 0.3 }, 1.6)
      .from(f(r, 'remind'), { y: 8, duration: 0.3 }, 1.6);
    return tl;
  },
};

export const buildFlow = (id: LayerId, root: Element, gsap: G) => FLOWS[id](root, gsap);
