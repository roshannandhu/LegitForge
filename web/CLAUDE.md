# Legit Forge website: agent guide

The full plan is ../PLAN.md. Read the relevant section before building anything.
PLAN §1.6 (clean-UI rules) and §4.8 (three-viewport contract) are mandatory review gates.

## Stack
- Next.js 16 (App Router, TypeScript) on Cloudflare Workers via @opennextjs/cloudflare
- Tailwind CSS v4; tokens live in app/globals.css — never hard-code hex in components
- GSAP + ScrollTrigger. No second animation library. No WebGL in the hero (PLAN §6.2a)
- Hero data: lib/hero-layout.ts · markup+motion: components/hero/machine.tsx

## Commands
- npm run dev              local development (port 3000)
- npm run build            production build
- npx tsc --noEmit         typecheck
- Hero review: /?qa=0.22 (act 1) /?qa=0.45 (act 2) /?qa=0.72 (act 3) /?qa=0.97 (act 4)

## Rules that are easy to break
- Animate only transform, opacity, filter, clip-path and CSS custom properties.
  Never width/height/margin, and never backdrop-filter on animated elements.
- The hero's no-JS default is ACT 3, rendered from server-side CSS vars. If you
  change plate positions, update plateVars() or the no-JS state silently breaks.
- All seven service names must stay in the served HTML — check with:
  curl -s localhost:3000/ | grep -c "WhatsApp Bots"
- 7 plates on desktop, 4 on phone, never a pin below 768px.
- Never add `export const runtime = 'edge'` (OpenNext uses the Node.js runtime).

## Before saying a task is done
- npm run build passes; checked at 375, 768 and 1440 in both themes, motion on and off.
- No horizontal overflow at any width; no spacing value outside the 4px scale.
