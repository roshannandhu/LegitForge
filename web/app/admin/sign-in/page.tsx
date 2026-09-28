import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminIdentity } from '@/lib/admin/auth';
import { GOOGLE_CLIENT_ID } from '@/lib/admin/google';
import { CoinMark } from '@/components/ui/icons';
import { GoogleSignIn } from './google-sign-in';

export const metadata: Metadata = { title: 'Admin sign-in' };

/** /admin/sign-in: Google's button, for approved accounts only (lib/admin/auth.ts). Every other
 *  admin page sends visitors who aren't signed in here. */
export default async function SignIn() {
  if (await adminIdentity()) redirect('/admin');
  return (
    <div className="admin-signin">
      <span className="admin-signin-seal"><CoinMark /></span>
      <h1 className="type-h3">Admin sign-in</h1>
      <p className="admin-lead">Use an approved Google account.</p>
      <GoogleSignIn clientId={GOOGLE_CLIENT_ID} />
    </div>
  );
}
