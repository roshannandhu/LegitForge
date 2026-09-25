# Legit Forge website: agent guide

The full plan is ../PLAN.md. Read the relevant section before building anything.
PLAN §1.6 (clean-UI rules) and §4.8 (three-viewport contract) are mandatory review gates.

## Stack
- Next.js 16 (App Router, TypeScript) on Cloudflare Workers via @opennextjs/cloudflare
- Tailwind CSS v4; tokens live in app/globals.css — never hard-code hex in components
- GSAP + ScrollTrigger for page motion, loaded after hydration: use `useGsap`/`loadGsap` from
  lib/gsap.ts. A static `import ... from 'gsap'` in a component puts 44 KB back in the first load.
  No WebGL in the hero (PLAN §6.2a)
- Team section only, both lazy-loaded when #team is near: React Three Fiber + Rapier
  (components/lanyard, fine pointer ≥1024px) and `motion` inside the vendored FlipCard
  (components/react-bits). Nothing else may import them.
- Hero data: lib/hero-layout.ts · markup+motion: components/hero/machine.tsx

## Commands
- npm run dev              local development (port 3000)
- npm run build            production build
- npx tsc --noEmit         typecheck
- npm run check            headless-Chrome gate: §4.8 audit at 375/768/1440 + the team layers.
                           BASE=http://localhost:3300 for a `next start` build. Screenshots: .check/
- Hero review: /?qa=0.22 (act 1) /?qa=0.45 (act 2) /?qa=0.72 (act 3) /?qa=0.97 (act 4)
- npm run db:migrate:local apply migrations/ to the local D1 (needed once before dev/preview)
- npm run preview          the real Worker (worker.ts + bindings) at http://localhost:8787
- npm run cf-typegen       regenerate cloudflare-env.d.ts after changing wrangler.jsonc

## Rules that are easy to break
- Animate only transform, opacity, filter, clip-path and CSS custom properties.
  Never width/height/margin, and never backdrop-filter on animated elements.
- The hero's no-JS default is ACT 3, rendered from server-side CSS vars. If you
  change plate positions, update plateVars() or the no-JS state silently breaks.
  With JS and motion on, hero.css starts at the collapsed state ([data-motion="on"] rules)
  so nothing flashes before GSAP arrives. FIT_NOW (inline script) sets the stage scale
  before first paint; keep its formula in step with the effect in machine.tsx.
- All seven service names must stay in the served HTML — check with:
  curl -s localhost:3000/ | grep -c "WhatsApp Bots"
- 7 plates on desktop, 4 on phone, never a pin below 768px.
- Never add `export const runtime = 'edge'` (OpenNext uses the Node.js runtime).
- Binding types: cf-typegen runs with --include-runtime=false. Wrangler's full runtime types
  redeclare fetch, Response and DOM Element and break the browser code. The binding types
  come from cloudflare-bindings.d.ts instead; add a line there for any new binding kind.
- Never edit an applied migration; add migrations/000N_*.sql.
- A lead is stored before anything else happens to it. Alerts (n8n) run in ctx.waitUntil
  after the response, so an outage there never loses a lead.
- Copy lives in lib/content.ts (home) and lib/pages.ts (inner pages: services, case studies,
  member bios); pages pass it to client components as props.
- Inner pages: app/pages.css + components/pages (PageHead with breadcrumbs, CtaBand, JsonLd).
  Blocks use .page-block on a .wrap: set padding-top only, or you erase .wrap's side padding.
  Importing content.ts into a 'use client' file ships all of it to the browser.
- Team cards: public/lanyard/card.glb is the React Bits card with its branded texture
  stripped; the art is drawn at runtime by lib/card-art.ts. Don't ship React Bits' lanyard.png.

## Before saying a task is done
- npm run build and npm run check pass (check covers 375, 768 and 1440, both themes, motion on and off).
- No horizontal overflow at any width; no spacing value outside the 4px scale.
