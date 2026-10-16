/** The Pages front door at legitforge.pages.dev. Pages serves the static files itself
 *  (_routes.json); every other request goes to the site Worker (legitforge-web), which renders
 *  the pages and runs the API, the admin and the media routes. Deploy: README "Deploy".
 *
 *  Workers Free gives each request 10 ms of CPU, and rendering a page costs the site Worker
 *  30–70 ms; Cloudflare cancels some of those ("Worker exceeded CPU time limit", Error 1101 for
 *  the visitor). So, at no CPU cost to the site Worker:
 *  - public pages are kept in this location's cache for a few minutes (uploaded images, whose
 *    addresses change when they do, for a day). The key carries the build id, so a deploy never
 *    serves pages that point at the previous build's files. Admin, API, signed-in requests and
 *    Next's in-app navigation data are never cached. Admin edits show within FRESH seconds.
 *  - a read that fails or stalls (10 s) is tried once more; a warm Worker answers. If that fails
 *    too, the last good copy of the page (kept a day) is served instead of an error. Writes go once. */

const BUILD = '__BUILD_ID__';                  // replaced by scripts/prepare-pages.mjs
const FRESH = 300;                             // seconds a saved page is served without the Worker
const IMMUTABLE = 86_400;                      // uploaded images (/media/<content hash>)
const BACKUP = 86_400;                         // the last good copy, used only when the Worker fails
const STALL = 10_000;

const cacheable = (request, url) =>
  request.method === 'GET'
  && !/^\/(admin|api)(\/|$)/.test(url.pathname)
  && !url.searchParams.has('_rsc') && !request.headers.has('rsc') && !request.headers.has('next-router-prefetch')
  && !(request.headers.get('cookie') ?? '').includes('lf_admin');
const storable = (response) => response.status === 200 && !response.headers.has('set-cookie')
  && !/no-store|private/.test(response.headers.get('cache-control') ?? '')
  && /^(text\/html|text\/plain|application\/xml|text\/xml|image\/)/.test(response.headers.get('content-type') ?? '');

const served = (hit) => {
  const out = new Response(hit.body, hit);
  out.headers.set('cache-control', hit.headers.get('x-lf-cache-control') ?? 'no-cache');
  out.headers.delete('x-lf-cache-control');
  return out;
};

async function site(request, env, backup) {
  const once = async () => {
    let timer;
    try {
      return await Promise.race([
        env.SITE.fetch(request.clone()),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('stalled')), STALL); }),
      ]);
    } finally { clearTimeout(timer); }
  };
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { last = await once(); if (last.status < 500) return last; } catch (e) { last = e; }   // over its CPU limit, or stalled
  }
  const saved = backup && await caches.default.match(backup);
  if (saved) return served(saved);
  if (last instanceof Response) return last;
  throw last;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.SITE.fetch(request);
    const url = new URL(request.url);
    if (!cacheable(request, url)) return site(request, env);

    const keyFor = (kind) => {
      const k = new URL(url);
      k.searchParams.set('__build', BUILD);
      if (kind) k.searchParams.set('__copy', kind);
      return new Request(k.toString());
    };
    const key = keyFor(''), backup = keyFor('backup');
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return served(hit);

    const response = await site(request, env, backup);
    if (storable(response)) {
      const save = (k, seconds) => {
        const copy = new Response(response.clone().body, response);
        copy.headers.set('x-lf-cache-control', response.headers.get('cache-control') ?? 'no-cache');
        copy.headers.set('cache-control', `public, max-age=${seconds}`);
        return cache.put(k, copy);
      };
      ctx.waitUntil(Promise.all([
        save(key, url.pathname.startsWith('/media/') ? IMMUTABLE : FRESH), save(backup, BACKUP),
      ]).catch(() => {}));
    }
    return response;
  },
};
