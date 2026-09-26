import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminNav } from './ui';
import './admin.css';

/** /admin (PLAN §7.8): behind Cloudflare Access, verified again by requireAdmin(). Anyone
 *  else gets the 404 page, and nothing here is ever indexed or cached. */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/site', label: 'Site' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await requireAdmin();
  return (
    <div className="admin wrap">
      <div className="admin-bar">
        <AdminNav items={NAV} />
        <p className="admin-who">Signed in as <strong>{who}</strong></p>
      </div>
      {children}
    </div>
  );
}
