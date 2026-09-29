# Legit Forge website: agent guide

The full plan is ../PLAN.md. Read the relevant section before building anything.
PLAN §1.6 (clean-UI rules) and §4.8 (three-viewport contract) are mandatory review gates.

## Stack
- Next.js 16 (App Router, TypeScript) on Cloudflare Workers via @opennextjs/cloudflare
- Tailwind CSS v4; tokens live in app/globals.css — never hard-code hex in components
- GSAP + ScrollTrigger for page motion, loaded after hydration: use `useGsap`/`loadGsap` from
  lib/gsap.ts. A static `import ... from 'gsap'` in a component puts 44 KB back in the first load.
  No WebGL in the hero (PLAN §6.2a, §6.2c)
- Team section only, both lazy-loaded when #team is near: React Three Fiber + Rapier
  (components/lanyard, every screen with WebGL2 + motion, phones included; touch taps flip,
  never drag) and `motion` inside the vendored FlipCard
  (components/react-bits). Nothing else may import them.
- Fonts: Anybody self-hosted subset (see Performance; it replaced Archivo on 2026-09-29), Big Shoulders Stencil via next/font/google.
- Palette "Tempered Steel" (2026-09-29, the owner's pick over the common cream-and-orange look): night is
  pure black with gold (the coin's) and a black label; day is steel white with black ink and a gold label.
  Keep lib/theme-colors.ts PAGE_BG, lib/og.tsx T and forge-canvas's first colours in step with globals.css.
- Theme: lib/boot.ts THEME_BOOT puts the dark/light class on <html> in <head>, before first paint.
  next-themes' own script runs in <body>, so without it a dark device painted light for a few frames.
- Hero (the Teardown, PLAN §6.2c, seven layers: SEO, web, WhatsApp, n8n, quote, warranty, NFC): data lib/teardown.ts · component components/hero/teardown.tsx ·
  live screens components/hero/layer-screens.tsx · their flows components/hero/teardown-flows.ts
- First-visit intro (the Hallmark Strike, PLAN §6.1b): components/intro, pure CSS. lib/boot.ts
  decides it before first paint. Clear localStorage `lf-intro-seen` to see it again.
- Logo: the coin seal (LEGIT FORGE on the rim and across the centre, no symbol), CoinMark in components/ui/icons.tsx (also app/icon.svg and mark() in lib/card-art.ts;
  keep all three in step). Its gold and steel are fixed hex in both themes, like a real coin: the
  one allowed exception to the token rule.
- SEO files: app/robots.ts, app/sitemap.ts, app/llms.txt/route.ts (llmstxt.org summary: services,
  published work and posts), app/icon.svg + app/apple-icon.tsx (the seal), app/not-found.tsx
  (noindex, no canonical). Every inner page has breadcrumbs (Breadcrumbs / PageHead in
  components/pages/page-head.tsx).
  People's pages are at the site root, from their name (legitforge.pages.dev/roshanraj:
  lib/team.ts handleFor/withPaths → Member.path, app/[member], components/team/member-profile.tsx);
  /team/<slug> 308-redirects there, and is the page itself only when the name gives no free
  handle. Link to a person with m.path, never `/team/${slug}`. A new top-level route or public/
  folder goes in RESERVED (lib/team.ts), or a person's name could take its address.
  Titles, descriptions, keywords, JSON-LD (Person, the studio's employee list) and llms.txt are
  built from Admin → Team and Company by lib/team-seo.ts: never hard-code a name. Legal-page CSS lives in globals.css: the root 404 imports it.
- Share images: lib/og.tsx draws every card (1200 × 630, next/og); each route has an
  opengraph-image.tsx and twitter-image.tsx, except case studies: an uploaded cover, else /og/work/<slug>. They must stay static (generateStaticParams +
  dynamicParams = false): the font files in assets/og are read at build time, never on Workers.
- Admin (PLAN §7.8): app/admin (pages, Server Actions in actions.ts), lib/admin (auth, D1 queries),
  app/api/admin/upload (R2), app/media (serves R2 images). Setup: README "Admin".
  Sign-in is Google only (lib/admin/auth.ts; no Cloudflare Access): /admin/sign-in renders
  Google's button, POST /api/admin/session verifies the ID token (Google's keys, the client ID in
  lib/admin/google.ts, email_verified, the nonce from its GET) and sets the HMAC-signed
  __Host-lf_admin cookie (ADMIN_SESSION_KEY secret). Allowed: owners in the ADMIN_EMAILS secret
  plus D1 admin_emails (Admin → Access). Every request re-checks the cookie AND the allow-list.
  Each Google token signs in once (D1 admin_sign_ins, keyed by nonce; also the sign-in log), and
  "Sign out everywhere" (D1 admin_security) refuses older sessions. Only owners manage Access.
  /admin/* sends an ENFORCED CSP (next.config.ts adminCsp) and X-Frame-Options: DENY. The dev
  bypass exists only under `next dev` (NODE_ENV check): laptop builds embed .env.local values.
  Deploy: .github/workflows/deploy-cloudflare.yml runs scripts/cf-setup.mjs (D1, R2, site URL),
  the migrations, `npm run deploy`, marks the data tags changed for the new build ("Live data on
  the new pages"), the Pages deploy, then cf-setup.mjs --post (HASH_SALT, ADMIN_SESSION_KEY, once).
  "Add from GitHub" (app/admin/projects/github-add.tsx + projectFromGithubAction): image + repo link →
  draft project; the brief is lib/admin/github.ts repoBrief (GitHub data only, no AI; numbers are
  never invented). The ADMIN'S BROWSER reads public repos (fetchRepoData, browser: true) and sends
  the data; the server checks it (repoDataFrom) and writes the brief (briefFrom). When the browser
  can't (API out of requests: a phone's mobile network shares one IP), the server reads GitHub
  itself (serverRepoData): the API only with GITHUB_TOKEN, else the public repo PAGE (fetchRepoPage:
  its embedded react-app JSON + the raw README), which the API's 60/hour limit doesn't cover. The
  owner must never see a rate-limit message (their rule): an unreadable or private repo offers
  "Create from the name only" (BriefError.nameOnly). If GitHub reshapes the page, fetchRepoPage
  throws and that offer appears; re-probe sidebarAbout / codeViewLayoutRoute.
  Private repos: a GitHub App (lib/admin/github-app.ts, D1 github_app, migration 0009). An owner
  creates it with GitHub's manifest flow (Admin → Projects → Private repos → form POST to
  github.com/settings/apps/new, the one form-action exception in adminCsp; GitHub returns to
  /admin/github with a code and our HMAC-signed state). Its private key is AES-GCM sealed with
  ADMIN_SESSION_KEY in D1, never in a file or the chat. Team members install it and pick repos;
  privateRepoAccess mints a one-hour token for just that repo. The cloud sandbox's proxy blocks
  api.github.com: test with a fixture server via GITHUB_API_BASE (only `next dev` with ADMIN_DEV_BYPASS).
- Projects on public pages come from lib/work.ts: published D1 rows, else nothing (sections hide,
  /work shows an empty state). The placeholders in content.ts/pages.ts show only in a build made
  with SHOW_PLACEHOLDERS=1 (local design work; `SHOW_PLACEHOLDERS=1 npm run check` covers the
  work and 3D team tests). Public pages never print [bracketed] text (lib/placeholder.ts: isPh,
  priceText; empty SITE fields are left out); `npm run check` ONLY=seo fails if any shows. Never import PROJECTS/CASE_STUDIES in a page again; use getProjects().
  People the same way: lib/team.ts getTeam() (tag 'team'), never TEAM/MEMBER_DETAILS in a page.
  Client components get toCards(team) only, so bios stay on the server.
- Company details (email, WhatsApp number and greeting, social links, legal name, city, GSTIN)
  live in D1 `company` (one row, Admin → Company, owners only; lib/company.ts, tag 'company').
  Server components: `await getCompany()`; client components: `useCompany()`
  (components/company-context.tsx, provided by the root layout). Build links with waLink(company)
  and shownEmail(company) from lib/site.ts. SITE holds only fixed facts (name, url, hours):
  never add contact fields back to it.

## Commands
- npm run dev              local development (port 3000)
- npm run build            production build
- npx tsc --noEmit         typecheck
- npm run check            headless-Chrome gate: §4.8 audit at 375/768/1440 + the team layers.
                           BASE=http://localhost:3300 for a `next start` build. Screenshots: .check/
- Hero review: /?qa=0.2 (tear down) /?qa=0.36 website /?qa=0.47 WhatsApp /?qa=0.58 n8n
                           /?qa=0.7 quote /?qa=0.81 warranty /?qa=0.99 (snapped back); ?lead=web|wa|n8n|quote|warranty
- npm run db:migrate:local apply migrations/ to the local D1 (needed once before dev/preview)
- npm run preview          the real Worker (worker.ts + bindings) at http://localhost:8787
- npm run cf-typegen       regenerate cloudflare-env.d.ts after changing wrangler.jsonc

## Rules that are easy to break
- Animate only transform, opacity, filter, clip-path and CSS custom properties.
  Never width/height/margin, and never backdrop-filter on animated elements.
- The hero's no-JS / motion-off frame is the finished exploded stack. Each layer's position, tilt
  and scale are CSS variables (--x --y --tilt --s) with server-rendered slot values; GSAP animates
  the same variables, so if you move a slot in lib/teardown.ts, both stay in step.
- Service demos (DemoPlayer): DEMOS[kind] is the intro (builds the finished frame once), then
  FLOWS[kind] keeps the demo working forever as a repeat:-1 timeline: no reset, no fade (plan F).
  Each cycle ends where the next begins; rotating text uses txt() (keeps React's text node) and
  never adds or removes nodes. DemoPlayer snapshots text and classes and restores them, with
  flow.revert(), when motion goes off. Pauses off screen. `npm run check` fails a demo that
  stops changing or fades its box out. Hidden step text: lib/demo-transcripts.ts, keep it true.
- Punch-ins (components/motion/punch-in.tsx): marks with [data-punch] inside a PunchIn are struck
  in once on view; without JS or motion they are simply there.
- "Now" (open/closed, reply-by, forge status) is computed in the browser only: lib/business-hours.ts.
- Live screens (layer-screens.tsx) are FINAL frames; flows play them from start states. Hide
  things until their turn with set(), never a short from() (it snaps back to visible).
- Screen UIs are sized in cqw: the container is the glass / phone screen, never the .ls itself.
- The hero never pins and has no scroll animation (the owner's call): its one timeline plays on
  a clock (teardown.tsx `driver`: tear down, 4.2 s per layer, snap back, hold, loop), only while
  on screen and the tab is visible; a chip seeks the loop to its layer. Every screen shows the
  whole 780 × 760 drawing (phones: callout type sized in screen px). FIT_NOW sets the stage
  scale before first paint; keep its formula in step with fitFor() in lib/teardown.ts.
- Services named in the hero (the callouts) must stay real text in the served HTML.
- Theme: follows the device (next-themes "system"). The lever's choice lasts only while browsing
  (THEME_BOOT: 30 min, renewed per page view, dropped on reload / new visit). The lever swaps
  class + color-scheme itself in one step (one full restyle; no disableTransitionOnChange), holds
  GSAP and the embers during the swap, and on lite devices fades a PAGE_BG veil (opacity only)
  instead of the View Transition circle. Only leaf components may call useTheme (a section that
  reads it re-renders whole on every switch).
- Inline <head> scripts live in lib/boot.ts. A string exported from a 'use client' file reaches
  a Server Component as a client reference, not text.
- Every Server Action and admin route calls requireAdmin()/adminIdentity() itself: actions are
  public POST endpoints. Route handlers use revalidateTag('projects', { expire: 0 }); only
  actions may call updateTag.
- lib/work.ts never reads D1 during `next build`: the dev bindings would bake local test data
  into production pages. But the build must still TAG the pages: getProjects/getTeam/
  getTestimonials go through atBuild (lib/build-cache.ts) at build, or updateTag() never
  re-renders the prerendered home, /work and /team (the admin's edits never showed).
- No page may set `dynamicParams = false`: every page carries a data tag (the root layout reads
  'company'), and once a tag expires (each deploy, each admin save) Next 16 answers such a page
  with 404 (NoFallbackError). Use `dynamicParams = true` + notFound(). `npm run check` fails on
  it. OG image routes are the exception (they read no data, so nothing expires them).
- Never add `export const runtime = 'edge'` (OpenNext uses the Node.js runtime).
- Two Cloudflare-only fixes, keep both: wrangler.jsonc "keep_names": false (esbuild's __name() inside
  next-themes' inline script threw on every page), and worker.ts running HTML through
  lib/doctype-first.ts (cached pages came out with Next's <script noModule> before <!DOCTYPE html>:
  quirks mode). Neither shows under `next start`; test with `npx wrangler dev` after a build.
- Share images use Anybody too: assets/og/Anybody-Wide-*.ttf, cut by scripts/og-fonts.py from
  app/fonts/anybody-latin.woff2 (rerun both scripts when copy gains a character).
- The Worker runs on Workers Free (3 MB compressed limit, ~2.4 MB now). A client component's
  `import()` of browser-only code (three.js, Rapier, FlipCard) sits inside
  `if (!process.env.NEXT_RUNTIME)` (team.tsx), or the server bundle takes it too (+1.1 MB).
  Measure: `npx opennextjs-cloudflare build && npx wrangler deploy --dry-run --outdir <tmp>`.
- The public address is legitforge.pages.dev: the Pages project in cf-pages/ serves the static
  folders in cf-pages/_routes.json and forwards the rest to the Worker (service binding SITE).
  A new top-level folder in public/ belongs in that exclude list, or every file in it costs a
  Worker request.
- Binding types: cf-typegen runs with --include-runtime=false. Wrangler's full runtime types
  redeclare fetch, Response and DOM Element and break the browser code. The binding types
  come from cloudflare-bindings.d.ts instead; add a line there for any new binding kind.
- Never edit an applied migration; add migrations/000N_*.sql.
- D1 enforces foreign keys: clear what points at a row before deleting it (lib/admin/db.ts
  deleteProject clears favourites and credits). Image R2 keys are content hashes and can be
  shared by two rows: delete the object only when no row still uses it. One cover per project.
- A lead is stored before anything else happens to it. Alerts (n8n) run in ctx.waitUntil
  after the response, so an outage there never loses a lead.
- Copy lives in lib/content.ts (home) and lib/pages.ts (inner pages: services, case studies,
  member bios); pages pass it to client components as props.
  Importing content.ts into a 'use client' file ships all of it to the browser.
- Inner pages: app/pages.css + components/pages (PageHead with breadcrumbs, CtaBand, JsonLd).
  Blocks use .page-block on a .wrap: set padding-top only, or you erase .wrap's side padding.
- Home #work is the React Bits AccordionGallery (JS-CSS, vendored: components/react-bits/
  accordion-gallery.jsx, keep its `LF:` additions if you swap in the official file) wired in
  components/work/work-gallery.tsx: expandRatio 0.52, trigger "hover", all panels equal until
  pointed at (defaultIndex -1, the owner's rule). Mouse: hover extends, leaving the row makes them
  equal again, one click opens the project. Touch: first tap opens, a tap on the open panel opens
  the project. The open panel shows a brief description only (client, title, 2-line summary).
  Projects are chosen in Admin → Projects (★ "Show on the home page", admin order; none starred
  → all published: lib/work.ts getHomeProjects). Panels keep data-project-card + .project-cover.
  More than 5 (MANY in work-gallery.tsx): the same panels in one sideways-scrolling row
  (.ag-scroll/.ag-viewport, fixed strip and open widths) that drifts left to right while on
  screen (pauses on hover, keyboard focus, touch and the ← → buttons; rests at the end, glides
  back), with a progress bar and arrows under it. Motion off: no drift.
- Team: any number of people (Admin → Team: add, reorder, remove). One full-bleed strip scrolls
  sideways in every layer. The 3D canvas is full width with headroom (sections.css
  .team-canvas, HEAD in team-lanyards.jsx: keep them equal), its camera follows the strip's
  scrollLeft, and only cards within a column of the view get a band and an atlas.
- Team cards: public/lanyard/card.glb is the React Bits card with its branded texture
  stripped; the art is drawn at runtime by lib/card-art.ts. Don't ship React Bits' lanyard.png.

## Performance on budget phones (measure at 360px with 4-6x CPU throttling before and after)
- Never remove or simplify an animation, the intro, the embers or the Anybody font for speed
  (the owner's rule). Improve how the same thing is built and drawn instead.
- Lite mode: html[data-lite] (LITE_BOOT in lib/boot.ts) for <=3 GB RAM, <=4 cores,
  Data Saver or 2G. Same site; only the order of work changes (data-near rules below, GSAP after
  idle). `?lite=1` / `?lite=0` force it. `npm run check` forces it off; `LITE=1 npm run check` audits it.
- Never write per-frame CSS variables on <html> (the whole page restyles): put them on the element
  that reads them (--scroll-energy lives on .heat-rod).
- Lenis only on fine-pointer screens, imported on demand; use lib/lenis-store.ts, never lenis/react.
- No container queries in the hero: live screens size in --cq (1 % of their screen width).
- No backdrop-filter on phones; no permanent will-change on unpinned layers.
- useGsap setups run one per task (lib/gsap.ts queue). Frames a setup requests (ScrollTrigger's
  full-page refresh after a pin) are held and run one per frame once the queue is empty, so
  pins share one refresh. DemoPlayer builds its timelines only when near the screen.
- The embers canvas starts one frame after first paint (forge-canvas.tsx): reading sizes and
  colours during hydration forced a full restyle. lib/business-hours.ts reuses one formatter.
- Lite phones keep hero cards 3–7 (≤767px) and every demo (≤479px) out of the first layout until
  a plain IntersectionObserver sets data-near (teardown.tsx, demo-player.tsx; placeholder heights
  in sections.css: re-measure them if a demo's phone height changes). Safety nets: motion off, and
  data-lite-all 8 s after load if no observer ran (lib/boot.ts).
- Heat is scoped: each [data-heat] section computes --heat-color/--heat-ink from its own
  --heat (globals.css, attr(data-heat type(<number>)); heat-director.tsx sets it inline where
  typed attr() is missing). Only .site-header/.site-footer/.phone-menu get the current value
  (one IntersectionObserver, written when it changes); heat.value eases for the embers. Never
  write --heat on <html> again: that restyled all ~2,400 elements at every section boundary.
  A new strip between sections that uses heat colours needs its own data-heat.
- Below-the-fold client sections (Compare, LiveTest, Team, Quench) are wrapped in
  HydrateWhenNear (components/motion/hydrate-when-near.tsx): server HTML from the first paint,
  React takes over within 600px. Page-wide observers must re-observe on `lf:hydrated`.
  Don't wrap sections that pin (Process) or anything above the fold.
- Anybody is self-hosted (next/font/local, app/fonts/anybody-latin.woff2, one 51 KB subset, both
  axes: weight and width 50–150 %). It arrives in time for the first layout, which spares a
  full re-layout on swap. New Latin character in copy → scripts/subset-font.py (check names it).
- content-visibility was measured and rejected: it moved layout into scrolling on this page.
- Team section rebuild (server markup + attached flip/drag) was measured and skipped: the whole
  section costs ~240 ms on a lite phone; HydrateWhenNear defers its hydration instead.

## Before saying a task is done
- npm run build and npm run check pass (check covers 375, 768 and 1440, both themes, motion on and off).
- No horizontal overflow at any width; no spacing value outside the 4px scale.
