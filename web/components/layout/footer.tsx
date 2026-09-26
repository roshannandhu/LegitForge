import { CoinMark } from '@/components/ui/icons';
import { MotionSwitch } from './motion-switch';
import { SITE, waLink } from '@/lib/site';

/** Footer (PLAN §6.12). Only links that resolve; only social accounts we keep active. */
export function Footer() {
  const social = Object.entries(SITE.social).filter(([, url]) => url);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <a className="logo" href="/" aria-label={`${SITE.name}, home`}>
            <CoinMark className="logo-mark" />
            <span className="logo-word">Legit Forge</span>
          </a>
          <p>Websites, apps, quotation and warranty systems, WhatsApp automation and n8n workflows — built by two people in {SITE.city}.</p>
        </div>

        <div>
          <h2 className="footer-h">Contact</h2>
          <ul className="footer-list">
            <li><a href={waLink()}>Chat on WhatsApp</a></li>
            <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
            <li>{SITE.hours.label}</li>
          </ul>
        </div>

        <div>
          <h2 className="footer-h">Site</h2>
          <ul className="footer-list">
            <li><a href="/services">Services</a></li>
            <li><a href="/work">Work</a></li>
            <li><a href="/team">Team</a></li>
            <li><a href="/#pricing">Pricing</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>

        <div>
          <h2 className="footer-h">Legal</h2>
          <ul className="footer-list">
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
            {social.map(([name, url]) => (
              <li key={name}><a href={url} rel="me noopener" target="_blank">{name[0].toUpperCase() + name.slice(1)}</a></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wrap footer-base">
        <p className="footer-legal">{SITE.legalName}, {SITE.taxId}, {SITE.city}, {SITE.country}</p>
        <p className="footer-speed">
          This site runs on Cloudflare.{' '}
          <a href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(SITE.url)}`} target="_blank" rel="noopener">
            Test its speed
          </a>
        </p>
        <MotionSwitch />
        <p className="footer-copy">© {year} {SITE.name}</p>
      </div>
    </footer>
  );
}
