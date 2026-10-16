/** The Pages front door at legitforge.pages.dev. Pages serves the static files itself
 *  (_routes.json); every other request goes to the site Worker (legitforge-web), which renders
 *  the pages and runs the API, the admin and the media routes. Deploy: README "Deploy".
 *
 *  Workers Free gives each request 10 ms of CPU. A freshly started site Worker (after a deploy,
 *  or a new location) can run past that on its first request, which fails with "Worker exceeded
 *  CPU time limit" and shows the visitor Error 1101. A read (GET/HEAD) is tried once more: the
 *  second try lands on a warm Worker. Writes are never repeated. */
export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.SITE.fetch(request);
    try {
      const first = await env.SITE.fetch(request.clone());
      if (first.status < 500) return first;
    } catch { /* cold Worker over its CPU limit: try again below */ }
    return env.SITE.fetch(request);
  },
};
