'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectGithubAppAction } from '../actions';

/** Finishes connecting the private-repos app: this browser swaps GitHub's one-time code for the
 *  app's details first (its own connection usually has unauthenticated API requests left; the
 *  server's shared IPs often don't), then the server checks and stores them. */
export function GithubConnect({ code, state }: { code: string; state: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;                  // the code works once: never twice (Strict Mode)
    started.current = true;
    (async () => {
      let fetched: string | undefined;
      if (/^[\w-]{1,100}$/.test(code)) {
        try {
          const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, { method: 'POST' });
          if (res.ok) fetched = await res.text();
        } catch { /* the server tries */ }
      }
      const r = await connectGithubAppAction(code, state, fetched).catch(() => ({ error: 'Couldn’t reach the server. Go back to Projects and press Connect GitHub again.' }));
      if ('error' in r) setError(r.error);
      else router.replace('/admin/projects#gh-private-h');
    })();
  }, [code, state, router]);

  return error ? (
    <>
      <h1 className="type-h2">GitHub is not connected</h1>
      <div className="admin-empty admin-stack">
        <p className="admin-msg is-error" role="alert">{error}</p>
        <a className="btn btn-ghost btn-sm" href="/admin/projects#gh-private-h">Back to Projects</a>
      </div>
    </>
  ) : (
    <>
      <h1 className="type-h2">Connecting GitHub</h1>
      <p className="admin-lead">Finishing with GitHub…</p>
    </>
  );
}
