/** On Cloudflare, a page Next re-renders after a data change (ISR, the 'projects'/'team'/'company'
 *  tags) comes out with Next's `<script noModule>` polyfill tag BEFORE `<!DOCTYPE html>`, and a
 *  page that doesn't start with its doctype renders in quirks mode (Lighthouse: "Page lacks the
 *  HTML doctype"). `next start` on the same build doesn't, so worker.ts runs every HTML response
 *  through this: whatever precedes the doctype moves to just after `<head>`. The same bytes in
 *  another order, so Content-Length stays right; a response that already starts with its doctype
 *  passes through untouched, chunk for chunk. */

const DOCTYPE = [...'<!doctype'].map((c) => c.charCodeAt(0));
const HEAD = [...'<head'].map((c) => c.charCodeAt(0));
const lower = (b: number) => (b >= 65 && b <= 90 ? b + 32 : b);

/** Where an ASCII pattern (lower case) starts in bytes, case-insensitively, or -1. */
function find(bytes: Uint8Array, pattern: number[], from = 0) {
  outer: for (let i = from; i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) if (lower(bytes[i + j]) !== pattern[j]) continue outer;
    return i;
  }
  return -1;
}

const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

export function doctypeFirst(res: Response): Response {
  if (!res.body || !res.headers.get('content-type')?.startsWith('text/html') || res.headers.get('content-encoding')) return res;
  let pending = new Uint8Array(0), done = false;
  const body = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, out) {
      if (done) { out.enqueue(chunk); return; }
      pending = join(pending, chunk);
      const d = find(pending, DOCTYPE);
      const h = d > 0 ? find(pending, HEAD, d) : -1;
      const end = h < 0 ? -1 : pending.indexOf(62 /* > */, h);
      // already right; or 64 KB without a doctype and its <head>: not a page to fix, send as is
      if (d === 0 || (end < 0 && pending.length > 65_536)) { done = true; out.enqueue(pending); return; }
      if (end < 0) return;                                                                 // wait for more
      done = true;
      out.enqueue(join(pending.subarray(d, end + 1), pending.subarray(0, d), pending.subarray(end + 1)));
    },
    flush(out) { if (!done && pending.length) out.enqueue(pending); },
  }));
  return new Response(body, res);
}
