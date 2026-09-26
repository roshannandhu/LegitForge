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
- Hero (the Teardown, PLAN §6.2c, seven layers: SEO, web, WhatsApp, n8n, quote, warranty, NFC): data lib/teardown.ts · component components/hero/teardown.tsx ·
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
- Home #work is the Accordion Gallery (components/react-bits/accordion-gallery.jsx, a
  reimplementation of the React Bits API: reactbits.dev is blocked from the sandbox; swap in
  `npx shadcn@latest add @react-bits/AccordionGallery-JS-CSS` and keep its `LF:` props). Panels
  keep data-project-card + .project-cover for the Cleave transition. Its flex-grow transition is
  the one allowed layout animation: the box has a fixed height, so nothing else moves.
- Team: any number of people (Admin → Team: add, reorder, remove). One full-bleed strip scrolls
  sideways in every layer. The 3D canvas is full width with headroom (sections.css
  .team-canvas, HEAD in team-lanyards.jsx: keep them equal), its camera follows the strip's
  scrollLeft, and only cards within a column of the view get a band and an atlas.
- Team cards: public/lanyard/card.glb is the React Bits card with its branded texture
  stripped; the art is drawn at runtime by lib/card-art.ts. Don't ship React Bits' lanyard.png.

## Performance on budget phones (measure at 360px with 4-6x CPU throttling before and after)
- Lite mode: html[data-lite] (LITE_BOOT in lib/boot.ts, lib/lite.ts isLite) for <=3 GB RAM, <=4 cores,
  Data Saver or 2G: no intro, still embers, instant --heat, no infinite loops, system font.
  `?lite=1` / `?lite=0` force it. `npm run check` forces it off; `LITE=1 npm run check` audits it.
- Never write per-frame CSS variables on <html> (the whole page restyles): put them on the element
  that reads them (--scroll-energy lives on .heat-rod).
- Lenis only on fine-pointer screens, imported on demand; use lib/lenis-store.ts, never lenis/react.
- No container queries in the hero: live screens size in --cq (1 % of their screen width).
- No backdrop-filter on phones; no permanent will-change on unpinned layers.
- useGsap setups run one per task (lib/gsap.ts queue). DemoPlayer and the phone hero flows build
  their timelines only when near the screen.
- Lite phones keep hero cards 3–7 (≤767px) and every demo (≤479px) out of the first layout until
  a plain IntersectionObserver sets data-near (teardown.tsx, demo-player.tsx; placeholder heights
  in sections.css: re-measure them if a demo's phone height changes). Safety nets: motion off, and
  data-lite-all 8 s after load if no observer ran (lib/boot.ts).
- --heat on <html> changes in one step (heat-director.tsx); only heat.value eases, for the embers.
- content-visibility was measured and rejected: it moved layout into scrolling on this page.
- Team section rebuild (server markup + attached flip/drag) was measured and skipped: the whole
  section costs ~240 ms on a lite phone, less than its risk to the flip and drag.

## Before saying a task is done
- npm run build and npm run check pass (check covers 375, 768 and 1440, both themes, motion on and off).
- No horizontal overflow at any width; no spacing value outside the 4px scale.
