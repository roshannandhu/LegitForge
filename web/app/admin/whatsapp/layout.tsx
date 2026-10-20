import { AdminNav } from '../ui';

const TABS = [
  { href: '/admin/whatsapp', label: 'Live', exact: true },
  { href: '/admin/whatsapp/connection', label: 'Connection & QR' },
  { href: '/admin/whatsapp/ai', label: 'AI & API Keys' },
  { href: '/admin/whatsapp/questions', label: 'Open questions' },
  { href: '/admin/whatsapp/answers', label: 'What the bot knows' },
  { href: '/admin/whatsapp/settings', label: 'Settings' },
];

/** Admin → WhatsApp's own tabs (each page still checks the admin itself). */
export default function AdminWhatsAppLayout({ children }: { children: React.ReactNode }) {
  return <><AdminNav label="WhatsApp" className="admin-nav admin-tabs" items={TABS} />{children}</>;
}
