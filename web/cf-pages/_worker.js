/** The Pages front door at legitforge.pages.dev. Pages serves the static files itself
 *  (_routes.json); every other request goes to the site Worker (legitforge-web), which renders
 *  the pages and runs the API, the admin and the media routes. Deploy: README "Deploy". */
export default {
  fetch(request, env) {
    return env.SITE.fetch(request);
  },
};
