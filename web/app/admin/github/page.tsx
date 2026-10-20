import { isOwner, requireAdmin } from '@/lib/admin/auth';
import { GithubConnect } from './github-connect';

/** Where GitHub sends an owner back after "Create GitHub App" (the manifest's redirect_url):
 *  ?code=…&state=…. GithubConnect finishes the handshake (connectGithubAppAction). */
export default async function AdminGithub({ searchParams }: { searchParams: Promise<{ code?: string; state?: string }> }) {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const { code = '', state = '' } = await searchParams;
  return (await isOwner(who))
    ? <GithubConnect code={code} state={state} />          // its own h1: it says when the link failed
    : (
      <>
        <h1 className="type-h2">Connecting GitHub</h1>
        <p className="admin-empty">Only the owners can connect GitHub.</p>
      </>
    );
}
