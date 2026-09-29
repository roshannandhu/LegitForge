import { isOwner } from '@/lib/admin/auth';
import { connectForm, githubAccess } from '@/lib/admin/github-app';
import { CopyLink } from './github-add';

/** Admin → Projects → Private repos (lib/admin/github-app.ts): an owner connects GitHub once; then
 *  each team member approves their repos with the link, and "Add from GitHub" can read them. */
export async function PrivateRepos({ who }: { who: string }) {
  const [owner, access] = await Promise.all([isOwner(who), githubAccess().catch(() => null)]);
  const form = !access && owner ? await connectForm(who).catch(() => null) : null;
  return (
    <section className="admin-section" aria-labelledby="gh-private-h">
      <h2 id="gh-private-h" className="type-h3">Private repos</h2>
      {access ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Send this link to each team member. They sign in to GitHub, choose the repos Legit Forge may read
            (read-only), and press Install. Then add those repos above like public ones. They can remove the
            access any time in GitHub → Settings → Applications.
          </p>
          <CopyLink href={access.installUrl} />
          <p className="muted">
            {access.accounts === null ? 'GitHub didn’t list who has approved just now.'
              : access.accounts.length ? <>Approved by: <strong>{access.accounts.join(', ')}</strong>. Anyone else still needs the link.</>
              : 'Nobody has approved yet.'}
          </p>
        </>
      ) : form ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            To add private repos, connect GitHub once. GitHub asks you to create a small Legit Forge app on
            your account (it can only read the repos people choose); press <strong>Create GitHub App</strong> there.
            You then get a link for each team member to approve their repos.
          </p>
          <form action={form.action} method="post">
            <input type="hidden" name="manifest" value={form.manifest} />
            <button type="submit" className="btn btn-primary">Connect GitHub</button>
          </form>
        </>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>Private repos aren’t connected yet. An owner can connect GitHub here.</p>
      )}
    </section>
  );
}
