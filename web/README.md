# Legit Forge website

Next.js 16 on Cloudflare Workers (OpenNext). The full specification is `../PLAN.md`;
the agent guide is `CLAUDE.md`.

## Local development

```bash
npm ci
cp .dev.vars.example .dev.vars      # local secrets
npm run db:migrate:local            # create the local D1 database (.wrangler/)
npm run dev                         # http://localhost:3000, with local D1 and R2 bindings
```

`npm run preview` builds the real Worker and runs it in the local Workers runtime
(http://localhost:8787). Use it to test `worker.ts`, the cron and anything
Cloudflare-specific. `npm run check` is the headless-Chrome gate (see `CLAUDE.md`).

`next dev`, `next build` and `next start` print a warning that `DOQueueHandler` is not exported.
It comes from OpenNext's dev-bindings helper, which never loads `worker.ts`. It is expected and harmless.

## First deploy (once)

Needs a Cloudflare account on **Workers Paid** (PLAN §8.3).

```bash
npx wrangler login
npx wrangler d1 create legitforge                  # paste the id into BOTH d1 entries in wrangler.jsonc
npx wrangler r2 bucket create legitforge-media
npx wrangler r2 bucket create legitforge-next-cache
npm run db:migrate:remote

npx wrangler secret put HASH_SALT                  # any long random string
npx wrangler secret put N8N_LEAD_WEBHOOK_URL       # optional until n8n WF-2 exists
npx wrangler secret put N8N_SHARED_KEY             # optional until n8n WF-2 exists
npx wrangler secret put TURNSTILE_SECRET_KEY       # from the Turnstile widget (dashboard → Turnstile)

npm run deploy
```

Then, in the Cloudflare dashboard:

1. Add your domain to the Worker.
2. Set the same domain in `lib/site.ts` (`SITE.url`) and in `wrangler.jsonc` (`vars.SITE_URL`).
3. Connect the GitHub repo with **Workers Builds**, with the deploy command `npm run deploy`, so every push to `main` deploys.
   Add the build variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the widget's site key). Set it together with the
   `TURNSTILE_SECRET_KEY` secret, never one without the other: with only the secret, every form submission fails.

## Database changes

Never edit an applied migration. Add `migrations/000N_name.sql`, then run `npm run db:migrate:local`
and, when deploying, `npm run db:migrate:remote`. After changing `wrangler.jsonc`, run
`npm run cf-typegen`. If the change adds a new kind of binding, add its type to
`cloudflare-bindings.d.ts`.

## Admin (/admin)

Projects (paste a screenshot to upload), leads with CSV export, testimonials and site
numbers. PLAN §7.8.

**Locally:** run `npm run db:migrate:local`, set `ADMIN_DEV_BYPASS=1` in `.dev.vars`, run
`npm run dev`, then open http://localhost:3000/admin. The bypass only works on localhost.

**In production,** Cloudflare Access protects it, and the app checks the Access token again:
1. Zero Trust → Access → Applications → Add a self-hosted application for your domain.
   Give it two paths: `/admin` and `/api/admin`.
2. Add a policy that allows your two email addresses.
3. Copy the application's **Audience (AUD) tag** and your team domain
   (`yourteam.cloudflareaccess.com`), then set both as secrets:
   `npx wrangler secret put ACCESS_AUD` and `npx wrangler secret put ACCESS_TEAM_DOMAIN`.
4. Apply the migrations remotely: `npm run db:migrate:remote`.

Without both secrets, /admin is a 404 for everyone. Published projects replace the
placeholders on the home page and /work. Draft previews are at `/admin/preview/<slug>`.

## Before launch

Search the code for `[` placeholders and `TODO` (real domain, WhatsApp number, business details,
budget ranges). PLAN §0 and §18 list what's needed.
