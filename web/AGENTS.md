<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current website decisions

Follow the approved October 2026 release decisions in `CLAUDE.md` and the current-decision block in `../PLAN.md`. Keep the black-and-gold identity, Anybody type, hero, intro, embers, admin-selected work and team cards.

The homepage presents hero → compact trust → published work and genuine testimonials → compact service ledger → full enquiry → process, quotes and FAQ → team, tools and closing contact. Detailed demonstrations live on their service pages. MR Signage is last in every service list; “Not sure yet” is the final enquiry utility option. Existing service URLs and primary homepage anchors remain stable.

The owner explicitly retains the trust section's reversible steel-split animation: scrolling down reveals, scrolling up closes again, even after full opening. Start with the complete heading readable; keep the steel closed for the first 25% of remaining travel and seek the paused timeline through the remaining 75%. No timer, autoplay or permanent completion. Keep the timeline mounted, strike hallmarks once, freeze behind menu/intro/hidden tab and preserve the frame while resizing/rebasing. Keep all viewports unpinned, with static readable content for reduced motion, no JavaScript or failed loading.

Keep websites and web apps on one service page with clear sections. Each service shows outcome/audience, practical deliverables, relevant published work, included work, quotes/timelines and preparation before its primary illustrative demo. Put deeper details and extra demos in native disclosures, preserving old hashes and opening the matching disclosure for deep links. The service index is compact. Match work through existing project tags; omit unmatched work. Remove fictional client quotations and unsupported speed/ranking/reliability claims. Keep sample-data labels and accessible demo transcripts accurate.

Website illustrations must not claim live WhatsApp processing or measured timings. Quotes are fixed in writing after scoping; do not invent prices or quotation/warranty commercial terms. Bot, n8n hosting, Telegram provisioning and AI workflows are a separate release.

Release checks include `npm run test:backend`, TypeScript, the isolated production Worker preflight and live smoke tests. Deploy database migration → Worker → content tags → matching Pages assets → verification. Preserve production content and unrelated local trace files. Never expose secrets or enable Turnstile from an unverified site-key/secret pair.
