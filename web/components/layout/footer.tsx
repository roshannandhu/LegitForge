import { CoinMark } from '@/components/ui/icons';
import { MotionSwitch } from './motion-switch';
import { ForgeStatus } from './forge-status';
import { SITE, activeSocial, legalLine, shownEmail, waLink, type Company } from '@/lib/site';

/** Footer (PLAN §6.12). Only links that resolve; only the social accounts switched on in
 *  Admin → Company (the root layout passes the details in). */
export function Footer({ company: c }: { company: Company }) {
  const social = activeSocial(c);
  const email = shownEmail(c);
  const legal = legalLine(c);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <a className="logo" href="/" aria-label={`${SITE.name}, home`}>
            <CoinMark className="logo-mark" />
            <span className="logo-word">Legit Forge</span>
          </a>
          <p>Websites, apps, quotation and warranty systems, WhatsApp automation and n8n workflows — built by two people{c.city ? ` in ${c.city}` : ''}.</p>
          <ForgeStatus />
        </div>

        <div>
          <h2 className="footer-h">Contact</h2>
          <ul className="footer-list">
            <li><a href={waLink(c)}>Chat on WhatsApp</a></li>
            {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
            {social.map((s) => (
              <li key={s.key}><a href={s.url} rel="me noopener" target="_blank">{s.label}</a></li>
            ))}
            <li>{SITE.hours.label}</li>
          </ul>
        </div>

        <div>
          <h2 className="footer-h">Site</h2>
          <ul className="footer-list">
            <li><a href="/services">Services</a></li>
            <li><a href="/work">Work</a></li>
            <li><a href="/team">Team</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/#pricing">Pricing</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>

        <div>
          <h2 className="footer-h">Legal</h2>
          <ul className="footer-list">
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
          </ul>
        </div>
      </div>

      <div className="wrap footer-base">
        {legal && <p className="footer-legal">{legal}</p>}
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
