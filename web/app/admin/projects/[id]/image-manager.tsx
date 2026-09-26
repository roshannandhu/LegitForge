'use client';

/** Paste to upload (PLAN §7.8): a screenshot lives on the clipboard, not in a folder, so
 *  Ctrl/Cmd+V anywhere on the page picks it up. Picking a file works too. The browser
 *  measures the image and its dominant colour; the server insists on the alt text. */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Picked = { file: File; url: string; width: number; height: number; color: string };

async function measure(file: File): Promise<Picked> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, 24, 24);
  const d = ctx.getImageData(0, 0, 24, 24).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const hex = (v: number) => Math.round(v / Math.max(n, 1)).toString(16).padStart(2, '0');
  const picked = { file, url: URL.createObjectURL(file), width: bmp.width, height: bmp.height, color: `#${hex(r)}${hex(g)}${hex(b)}` };
  bmp.close();
  return picked;
}

/** projectId: a project image. memberId: a team member's photo (one per person, no kind). */
export function ImageManager({ projectId, memberId, altHint = '' }: { projectId?: string; memberId?: string; altHint?: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [alt, setAlt] = useState(altHint);
  const [kind, setKind] = useState('gallery');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const altRef = useRef<HTMLTextAreaElement>(null);

  const take = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setMsg({});
    try {
      const p = await measure(file);
      setPicked((old) => { if (old) URL.revokeObjectURL(old.url); return p; });
      requestAnimationFrame(() => altRef.current?.focus());
    } catch {
      setMsg({ error: 'That image couldn’t be read. Try a PNG, JPEG or WebP.' });
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;                       // plain text pastes into fields as normal
      e.preventDefault();
      take(new File([file], file.name || `pasted-${Date.now()}.png`, { type: file.type }));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const upload = async () => {
    if (!picked) return;
    if (alt.trim().length < 8) { setMsg({ error: 'Describe the image first (at least 8 characters).' }); altRef.current?.focus(); return; }
    setBusy(true); setMsg({});
    const f = new FormData();
    f.set('file', picked.file); f.set('alt', alt.trim()); if (projectId) f.set('projectId', projectId); if (memberId) f.set('memberId', memberId); f.set('kind', kind);
    f.set('width', String(picked.width)); f.set('height', String(picked.height)); f.set('color', picked.color);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: f });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMsg({ error: body.error ?? `Upload failed (${res.status}).` }); return; }
      URL.revokeObjectURL(picked.url);
      setPicked(null); setAlt(altHint); setKind('gallery');
      setMsg({ ok: 'Uploaded.' });
      router.refresh();
    } catch {
      setMsg({ error: 'Upload failed. Check the connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drop" data-active={picked ? '' : undefined}>
      <p style={{ margin: 0 }}><strong>Paste a screenshot anywhere on this page</strong> (Ctrl or Cmd + V), or choose a file. JPEG, PNG or WebP, up to 5 MB.</p>
      <label className="field">
        <span className="sr-only">Choose an image</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {picked && (
        <div className="drop-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={picked.url} alt="" width={picked.width} height={picked.height} />
          <div className="admin-form">
            <p className="muted" style={{ margin: 0 }}>{picked.width}×{picked.height} · <span className="swatch" style={{ background: picked.color }} />{picked.color}</p>
            <label className="field">
              <span>Describe the image <small>(required: read out to people who can’t see it)</small></span>
              <textarea ref={altRef} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={250} required
                placeholder="The bakery's home page on a phone, showing today's cakes and a WhatsApp button" />
            </label>
            {!memberId && <label className="field"><span>Use as</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="gallery">Gallery</option><option value="cover">Cover</option>
                <option value="before">Before</option><option value="after">After</option>
              </select>
            </label>}
            <div className="admin-actions">
              <button type="button" className="btn btn-primary" onClick={upload} disabled={busy} aria-busy={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { URL.revokeObjectURL(picked.url); setPicked(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {msg.error && <p className="admin-msg is-error" role="alert">{msg.error}</p>}
      {msg.ok && <p className="admin-msg is-ok" role="status">{msg.ok}</p>}
    </div>
  );
}
