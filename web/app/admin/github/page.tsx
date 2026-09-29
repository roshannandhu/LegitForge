import { isOwner, requireAdmin } from '@/lib/admin/auth';
import { GithubConnect } from './github-connect';

/** Where GitHub sends an owner back after "Create GitHub App" (the manifest's redirect_url):
 *  ?code=…&state=…. GithubConnect finishes the handshake (connectGithubAppAction). */
export default async function AdminGithub({ searchParams }: { searchParams: Promise<{ code?: string; state?: string }> }) {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const { code = '', state = '' } = await searchParams;
  return (
    <>
      <h1 className="type-h2">Connecting GitHub</h1>
      {(await isOwner(who))
        ? <GithubConnect code={code} state={state} />
        : <p className="admin-empty">Only the owners can connect GitHub.</p>}
    </>
  );
}
