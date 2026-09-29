'use client';

/** "Add from GitHub" (Admin → Projects): an image and a repo link, nothing else. The server reads
 *  the repo and writes the brief into a new DRAFT project (projectFromGithubAction); this box then
 *  uploads the image as its cover and opens the editor, where the owner checks and publishes.
 *  If the image can't be stored, the draft is discarded, so no half-made project is left. */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { discardDraftAction, projectFromGithubAction } from '../actions';
import { fetchRepoData, parseRepo } from '@/lib/admin/github';
import { measure, type Picked } from './[id]/image-manager';

/** The repo's data read by THIS browser from GitHub's API (it adds the languages), as JSON for the
 *  server; undefined when it can't be (a private repo, or the API is out of requests, as it often
 *  is on a shared mobile network), and the server reads the public repo page instead
 *  (lib/admin/github.ts serverRepoData). A limit is never shown to the owner. */
async function readInBrowser(url: string) {
  const ref = parseRepo(url);
  if (!ref) return undefined;
  try {
    const d = await fetchRepoData(ref, { browser: true });
    return JSON.stringify({ ...d, readme: d.readme.slice(0, 100_000) });
  } catch {
    return undefined;
  }
}

/** A link to send someone (the private-repos approval link), with a Copy button. */
export function CopyLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <p className="gh-link">
      <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(href).then(() => setCopied(true), () => {})}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </p>
  );
}

export function GithubAdd() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'' | 'reading' | 'uploading' | 'opening'>('');
  const [error, setError] = useState('');
  const [offerName, setOfferName] = useState(false);   // GitHub can't be read: "Create from the name only"
  const [link, setLink] = useState('');                // the approval link to send a repo's owner
  const fileRef = useRef<HTMLInputElement>(null);

  const take = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setError('');
    try {
      const p = await measure(file);
      setPicked((old) => { if (old) URL.revokeObjectURL(old.url); return p; });
    } catch {
      setError('That image couldn’t be read. Try a PNG, JPEG or WebP.');
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;                       // a pasted link goes into the field as normal
      e.preventDefault();
      take(new File([file], file.name || `pasted-${Date.now()}.png`, { type: file.type }));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const create = async (fromName = false) => {
    setError(''); setOfferName(false); setLink('');
    if (!picked) { setError('Add the project’s image first: paste a screenshot or choose a file.'); fileRef.current?.focus(); return; }
    if (!url.trim()) { setError('Paste the GitHub link.'); return; }
    setStep('reading');
    const fetched = fromName ? undefined : await readInBrowser(url.trim());
    const made = await projectFromGithubAction(url.trim(), fetched, fromName).catch(() => ({ error: 'Couldn’t reach the server. Try again.', nameOnly: false, link: '' }));
    if ('error' in made) { setError(made.error); setOfferName(!!made.nameOnly); setLink(made.link ?? ''); setStep(''); return; }

    setStep('uploading');
    const f = new FormData();
    f.set('file', picked.file); f.set('alt', made.alt); f.set('projectId', made.id); f.set('kind', 'cover');
    f.set('width', String(picked.width)); f.set('height', String(picked.height)); f.set('color', picked.color);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: f });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `The image upload failed (${res.status}).`);
    } catch (e) {
      await discardDraftAction(made.id).catch(() => {});
      setError(`${(e as Error).message} Nothing was saved; try again.`);
      setStep('');
      return;
    }
    setStep('opening');
    URL.revokeObjectURL(picked.url);
    router.push(`/admin/projects/${made.id}`);
  };

  const busy = step !== '';
  return (
    <section className="admin-section gh-add" aria-labelledby="gh-add-h">
      <h2 id="gh-add-h" className="type-h3">Add from GitHub</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        An image and the repo link: the title, summary, what was built, tech stack, tags and live link are written
        from GitHub. It is saved as a draft for you to check and publish. Results and numbers stay yours to add.
      </p>
      <div className="drop" data-active={picked ? '' : undefined}>
        {picked ? (
          <div className="drop-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={picked.url} alt="" width={picked.width} height={picked.height} />
            <p className="muted" style={{ margin: 0 }}>{picked.width}×{picked.height} · this becomes the cover.
              {' '}<button type="button" className="btn btn-ghost btn-sm" onClick={() => { URL.revokeObjectURL(picked.url); setPicked(null); }} disabled={busy}>Change</button></p>
          </div>
        ) : (
          <p style={{ margin: 0 }}><strong>Paste a screenshot</strong> (Ctrl or Cmd + V) or choose a file. JPEG, PNG or WebP, up to 5 MB.</p>
        )}
        {!picked && (
          <label className="field">
            <span className="sr-only">Choose the project image</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <div className="admin-form">
        <label className="field">
          <span>GitHub link</span>
          <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) create(); } }} disabled={busy} />
        </label>
        <div className="admin-actions">
          <button type="button" className="btn btn-primary" onClick={() => create()} disabled={busy} aria-busy={busy}>
            {step === 'reading' ? 'Reading GitHub…' : step === 'uploading' ? 'Uploading image…' : step === 'opening' ? 'Opening…' : 'Create project'}
          </button>
        </div>
      </div>
      {error && <p className="admin-msg is-error" role="alert">{error}</p>}
      {link && !busy && <CopyLink href={link} />}
      {offerName && !busy && (
        <div className="admin-actions">
          <button type="button" className="btn btn-ghost" onClick={() => create(true)}>Create from the name only</button>
        </div>
      )}
    </section>
  );
}
