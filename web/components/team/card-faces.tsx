/** The 2D ID card faces (PLAN §6.8), shared by the team section's static and FlipCard
 *  layers and the member portfolio header (§7.3). No hooks: renders on the server too. */

import { CoinMark } from '@/components/ui/icons';
import type { CardPerson } from '@/lib/card-art';

/* ------------------------------------------------ card faces (2D layers) */
export function CardFront({ p }: { p: CardPerson }) {
  return (
    <div className="id-face-inner">
      <div className="id-top"><CoinMark className="id-mark" /><span className="id-code num">{p.idCode}</span></div>
      <div className={`id-photo${p.visitor ? ' id-photo-empty' : ''}`}>
        {p.photo ? <img src={p.photo} alt="" loading="lazy" decoding="async" /> : <span>{p.initials}</span>}
      </div>
      <p className="id-name">{p.name}</p>
      <p className="id-role">{p.role}</p>
      {p.building && <p className="id-now"><span className="id-now-dot" aria-hidden="true" /><span className="sr-only">Currently building: </span>{p.building}</p>}
      <span className="id-seal">Legit</span>
    </div>
  );
}

export function CardBack({ p }: { p: CardPerson }) {
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
