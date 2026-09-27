'use client';
/* AccordionGallery — React Bits (JS-CSS variant) API:
 *   <AccordionGallery items={[{ image, label, link }]} defaultIndex={2} expandRatio={0.52} trigger="hover" />
 * Registry: npx shadcn@latest add @react-bits/AccordionGallery-JS-CSS
 *
 * reactbits.dev is unreachable from the build sandbox, so this is a clean reimplementation
 * of that API (plan F step 6). Swap in the official file on a machine that can reach it;
 * keep the `LF:` additions below, the home page relies on them:
 *  - item.content     a React node shown over the open panel (title, result, stamp, links)
 *  - item.alt         the image's alt text; item.initials: a blueprint panel when there is no image
 *  - item.cardProps   extra attributes on the panel (data-project-card for the page transition)
 *  - reduceMotion     no transitions (the footer "Animations" switch)
 *  - defaultIndex -1  nothing open until pointed at; leaving the row closes it again
 *  - item.sublabel    a second line under the collapsed card's name (the client)
 *  - item.linkLabel   the accessible name of the panel's link (the panel link is focusable)
 *  - a mouse click always follows the link (hover already opened the panel); touch: the first
 *    tap opens a panel, a tap on the open panel follows its link
 *
 * Behaviour: panels share one row; the open one takes `expandRatio` of the width. `hover`
 * opens on mouse hover, `click` on click; touch and keyboard always work: the first tap or
 * focus opens a panel, the next tap follows its link. Phones (< 768px) stack the panels as a
 * vertical accordion. The box never changes size, so opening a panel never moves the page. */
import { useRef, useState } from 'react';
import './accordion-gallery.css';

export default function AccordionGallery({
  items = [],
  defaultIndex = 0,
  expandRatio = 0.5,
  trigger = 'hover',
  reduceMotion = false,
  className = '',
}) {
  const n = items.length;
  const pointer = useRef('');                                    // LF: the last press's pointer type
  const [active, setActive] = useState(defaultIndex < 0 ? -1 : Math.min(defaultIndex, Math.max(n - 1, 0)));
  // the open panel's share of the free space: grow g with the rest at 1 gives g / (g + n - 1) = ratio
  const grow = n > 1 ? (expandRatio * (n - 1)) / (1 - expandRatio) : 1;

  return (
    <ul
      className={`ag${reduceMotion ? ' ag-still' : ''}${className ? ' ' + className : ''}`}
      style={{ '--ag-n': n, '--ag-grow': grow }}
      data-any-open={active >= 0 ? '' : undefined}
      onPointerLeave={(e) => { if (defaultIndex < 0 && trigger === 'hover' && e.pointerType === 'mouse') setActive(-1); }}
    >
      {items.map((it, i) => {
        const open = i === active;
        return (
          <li
            key={it.link ?? i}
            className="ag-item"
            data-open={open ? '' : undefined}
            {...it.cardProps}
            onPointerEnter={(e) => { if (trigger === 'hover' && e.pointerType === 'mouse') setActive(i); }}
            onFocus={(e) => { if (e.target.matches(':focus-visible')) setActive(i); }}   // keyboard only: a tap's focus would open it before its click
          >
            <div className="ag-media project-cover">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded covers, already sized
                <img className="ag-img" src={it.image} alt={it.alt ?? ''} loading="lazy" decoding="async" />
              ) : (
                <span className="ag-blueprint" aria-hidden="true"><span>{it.initials ?? it.label?.slice(0, 2)}</span></span>
              )}
            </div>
            <span className="ag-shade" aria-hidden="true" />
            <span className="ag-label" aria-hidden="true">{it.label}{it.sublabel && <small>{it.sublabel}</small>}</span>
            <a
              className="ag-link"
              href={it.link}
              aria-label={it.linkLabel ?? it.label}
              onPointerDown={(e) => { pointer.current = e.pointerType; }}
              onClick={(e) => {
                // LF: a mouse click opens the project; a first tap (touch or pen) opens the panel,
                // a tap on the open panel follows its link. Keyboard: focus opened it, Enter follows.
                if (!open && pointer.current !== 'mouse') { e.preventDefault(); setActive(i); }
                pointer.current = '';
              }}
            />
            <div className="ag-content">{it.content ?? <span className="ag-title">{it.label}</span>}</div>
          </li>
        );
      })}
    </ul>
  );
}
