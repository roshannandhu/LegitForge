import type { Metadata } from 'next';
import { adminIdentity } from '@/lib/admin/auth';
import { CoinMark } from '@/components/ui/icons';
import { signOutAction } from './actions';
import { AdminNav } from './ui';
import './admin.css';

/** /admin (PLAN §7.8): Google sign-in (lib/admin/auth.ts). Every page, Server Action and route
 *  checks the session itself (layouts render in parallel with pages, so this one guards
 *  nothing); a visitor who isn't signed in only ever reaches /admin/sign-in. Nothing here is
 *  ever indexed or cached. The public header and footer stay out (components/layout/public-only.tsx):
 *  the admin has its own bar. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const NAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/whatsapp', label: 'WhatsApp' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/company', label: 'Company' },
  { href: '/admin/access', label: 'Access' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await adminIdentity();
  if (!who) return <div className="admin wrap">{children}</div>;
  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to content</a>
      <header className="admin-top">
        <div className="wrap admin-top-row">
          <a className="admin-brand" href="/admin">
            <CoinMark className="admin-brand-mark" />
            <span>Legit Forge</span>
            <span className="admin-badge">Admin</span>
          </a>
          <form action={signOutAction} className="admin-who">
            <span className="admin-email" title={who}>{who}</span>
            <a className="btn btn-ghost btn-sm" href="/">View site</a>
            <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
          </form>
        </div>
        <div className="wrap"><AdminNav items={NAV} /></div>
      </header>
      <div id="admin-main" className="wrap admin-main">{children}</div>
    </div>
  );
}
