# Legit Forge: Agent Instructions

## Core Workspace Directives
- **Working Directory**: Always work in the web application directory (`web/`). All Next.js, Cloudflare Workers, tests, configurations, and styling code live in `web/`.
- **Target Branch**: The active production branch is `main-exh9xw`. All PRs, feature branches, and commits must target and merge into `main-exh9xw`.
- **Verification & Checks**:
  - Run `npm run test:backend` inside `web/` to verify backend and Miniflare D1 contracts (all 119 tests must pass, including the WhatsApp bot's).
  - Run `npm run build` inside `web/` to ensure TypeScript compilation (`tsc`) and static site generation (`SSG`) succeed with zero errors.
  - Verify page content and markup directly in the code or via build outputs, since headless browser smoke-tests (`npm run check`) require an active local dev server and Chrome binary.
- **Detailed Guidelines**: Refer to `web/CLAUDE.md` for architecture rules, Tempered Steel theme tokens (gold & black, no orange/red), font rules (self-hosted Anybody), and performance budgets.
