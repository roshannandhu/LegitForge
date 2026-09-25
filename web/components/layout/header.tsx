'use client';

/** Header (PLAN §6.0). WhatsApp is always one tap away; visitors always know where they are.
 *  - transparent at the top, solid past 80px
 *  - slides away scrolling down, returns scrolling up — never while focus is inside it
 *  - 2px heat rod shows scroll progress (#3): scaleX, never width
 *  - phone menu: full screen, focus trapped, Esc closes, scroll locked */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';
import { ForgeLever } from './forge-lever';
import { AnvilMark, ChatIcon, CloseIcon, MenuIcon } from '@/components/ui/icons';
import { useGsap } from '@/lib/gsap';
import { SITE, waLink } from '@/lib/site';

// Blog replaces Pricing here once /blog exists (§7.4); a nav link must never 404.
const NAV = [
  { href: '/#services', label: 'Services' },
  { href: '/#work', label: 'Work' },
  { href: '/#team', label: 'Team' },
  { href: '/#process', label: 'Process' },
  { href: '/#pricing', label: 'Pricing' },
];

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const rodRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const lenis = useLenis();
  const wa = waLink();

  useGsap(({ ScrollTrigger }) => {
    const header = headerRef.current!;
    ScrollTrigger.create({
      start: 80,
      end: 'max',
      onToggle: (self) => { header.dataset.solid = String(self.isActive); },
      onUpdate: (self) => {
        if (header.contains(document.activeElement) || menuOpenRef.current) return;
        header.dataset.hidden = String(self.direction === 1 && self.scroll() > 200);
      },
    });
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => rodRef.current?.style.setProperty('--progress', self.progress.toFixed(3)),
    });
  });

  const close = useCallback(() => {
    setOpen(false);
    menuBtnRef.current?.focus();
  }, []);

  // scroll lock + focus trap + Esc while the phone menu is open
  useEffect(() => {
    menuOpenRef.current = open;
    const root = document.documentElement;
    if (!open) {
      root.classList.remove('menu-open');
      lenis?.start();
      return;
    }
    root.classList.add('menu-open');
    lenis?.stop();
    headerRef.current!.dataset.hidden = 'false';

    const panel = panelRef.current!;
    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, lenis, close]);

  return (
    <>
    <header ref={headerRef} className="site-header" data-solid="false" data-hidden="false">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="wrap header-row">
        <a className="logo" href="/" aria-label={`${SITE.name}, home`}>
          <AnvilMark className="logo-mark" />
          <span className="logo-word">Legit Forge</span>
        </a>

        <nav className="nav-desktop" aria-label="Main">
          <ul>
            {NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}
          </ul>
        </nav>

        <div className="header-actions">
          <ForgeLever />
          <a className="btn btn-primary btn-sm header-cta" href={wa}
             {...(wa.startsWith('http') && { target: '_blank', rel: 'noopener' })}>
            <ChatIcon className="btn-icon" />
            <span className="cta-long">Chat on WhatsApp</span>
            <span className="cta-short" aria-hidden="true">Chat</span>
          </a>
          <button
            ref={menuBtnRef}
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="phone-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => (open ? close() : setOpen(true))}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      <span ref={rodRef} className="heat-rod" aria-hidden="true" />
    </header>

    {/* Sibling, not child: the solid header's backdrop-filter would otherwise become
        the containing block for this fixed panel and collapse it to the header's height. */}
      <div id="phone-menu" ref={panelRef} className="phone-menu" hidden={!open}>
        <nav aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}><a href={n.href} onClick={() => setOpen(false)}>{n.label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="menu-theme"><ForgeLever /><span aria-hidden="true">Dark mode</span></div>
        <a className="btn btn-primary phone-menu-cta" href={wa} onClick={() => setOpen(false)}>
          <ChatIcon className="btn-icon" /> Chat on WhatsApp
        </a>
      </div>
    </>
  );
}
