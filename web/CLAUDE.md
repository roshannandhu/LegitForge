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
  (components/lanyard, fine pointer ≥1024px) and `motion` inside the vendored FlipCard
  (components/react-bits). Nothing else may import them.
- Hero (the Teardown, PLAN §6.2c): data lib/teardown.ts · component components/hero/teardown.tsx ·
  live screens components/hero/layer-screens.tsx · their flows components/hero/teardown-flows.ts
- First-visit intro (the Hallmark Strike, PLAN §6.1b): components/intro, pure CSS. lib/boot.ts
  decides it before first paint. Clear localStorage `lf-intro-seen` to see it again.
- Logo: the coin seal (LEGIT FORGE on the rim and across the centre, no symbol), CoinMark in components/ui/icons.tsx (also app/icon.svg and mark() in lib/card-art.ts;
  keep all three in step). Its gold and steel are fixed hex in both themes, like a real coin: the
  one allowed exception to the token rule.
- Share images: lib/og.tsx draws every card (1200 × 630, next/og); each route has an
  opengraph-image.tsx and twitter-image.tsx, except case studies: an uploaded cover, else /og/work/<slug>. They must stay static (generateStaticParams +
  dynamicParams = false): the font files in assets/og are read at build time, never on Workers.
- Admin (PLAN §7.8): app/admin (pages, Server Actions in actions.ts), lib/admin (auth, D1 queries),
  app/api/admin/upload (R2), app/media (serves R2 images). Setup: README "Admin".
- Projects on public pages come from lib/work.ts: published D1 rows, else the placeholders in
  content.ts/pages.ts. Never import PROJECTS/CASE_STUDIES in a page again; use getProjects().
  People the same way: lib/team.ts getTeam() (tag 'team'), never TEAM/MEMBER_DETAILS in a page.
  Client components get toCards(team) only, so bios stay on the server.

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
- Service demos (DemoPlayer) loop while on screen and pause off screen; each loop rebuilds its
  timeline from the finished frame. Their hidden step text is lib/demo-transcripts.ts: keep it
  true when a demo changes.
- Punch-ins (components/motion/punch-in.tsx): marks with [data-punch] inside a PunchIn are struck
  in once on view; without JS or motion they are simply there.
- "Now" (open/closed, reply-by, forge status) is computed in the browser only: lib/business-hours.ts.
- Live screens (layer-screens.tsx) are FINAL frames; flows play them from start states. Hide
  things until their turn with set(), never a short from() (it snaps back to visible).
- Screen UIs are sized in cqw: the container is the glass / phone screen, never the .ls itself.
- Tablets and laptops pin the hero; phones never pin (swipe row). FIT_NOW sets the stage scale
  before first paint; keep its formula in step with the resize effect in teardown.tsx.
- Services named in the hero (the callouts) must stay real text in the served HTML.
- Inline <head> scripts live in lib/boot.ts. A string exported from a 'use client' file reaches
  a Server Component as a client reference, not text.
- Every Server Action and admin route calls requireAdmin()/adminIdentity() itself: actions are
  public POST endpoints. Route handlers use revalidateTag('projects', { expire: 0 }); only
  actions may call updateTag.
- lib/work.ts never reads D1 during `next build`: the dev bindings would bake local test data
  into production pages.
- Never add `export const runtime = 'edge'` (OpenNext uses the Node.js runtime).
- Binding types: cf-typegen runs with --include-runtime=false. Wrangler's full runtime types
  redeclare fetch, Response and DOM Element and break the browser code. The binding types
  come from cloudflare-bindings.d.ts instead; add a line there for any new binding kind.
- Never edit an applied migration; add migrations/000N_*.sql.
- A lead is stored before anything else happens to it. Alerts (n8n) run in ctx.waitUntil
  after the response, so an outage there never loses a lead.
- Copy lives in lib/content.ts (home) and lib/pages.ts (inner pages: services, case studies,
  member bios); pages pass it to client components as props.
  Importing content.ts into a 'use client' file ships all of it to the browser.
- Inner pages: app/pages.css + components/pages (PageHead with breadcrumbs, CtaBand, JsonLd).
  Blocks use .page-block on a .wrap: set padding-top only, or you erase .wrap's side padding.
- Team cards: public/lanyard/card.glb is the React Bits card with its branded texture
  stripped; the art is drawn at runtime by lib/card-art.ts. Don't ship React Bits' lanyard.png.

## Before saying a task is done
- npm run build and npm run check pass (check covers 375, 768 and 1440, both themes, motion on and off).
- No horizontal overflow at any width; no spacing value outside the 4px scale.
