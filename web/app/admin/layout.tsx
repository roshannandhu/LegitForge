import type { Metadata } from 'next';
import { adminIdentity } from '@/lib/admin/auth';
import { signOutAction } from './actions';
import { AdminNav } from './ui';
import './admin.css';

/** /admin (PLAN §7.8): Google sign-in (lib/admin/auth.ts). Every page, Server Action and route
 *  checks the session itself (layouts render in parallel with pages, so this one guards
 *  nothing); a visitor who isn't signed in only ever reaches /admin/sign-in. Nothing here is
 *  ever indexed or cached. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/site', label: 'Site' },
  { href: '/admin/access', label: 'Access' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await adminIdentity();
  if (!who) return <div className="admin wrap">{children}</div>;
  return (
    <div className="admin wrap">
      <div className="admin-bar">
        <AdminNav items={NAV} />
        <form action={signOutAction} className="admin-who">
          <span>Signed in as <strong>{who}</strong></span>
          <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
