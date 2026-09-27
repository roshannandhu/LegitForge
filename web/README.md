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

## Deploy (GitHub Actions)

Runs on **Workers Free**: the Worker is about 2.4 MB compressed, under the free plan's 3 MB limit.
Browser-only libraries stay out of the server bundle only behind the `process.env.NEXT_RUNTIME`
guard in components/sections/team.tsx; without it the Worker is 3.7 MB and needs **Workers Paid**
($5/month, PLAN §8.3), which also lifts Free's 10 ms CPU limit per request.

`.github/workflows/deploy-cloudflare.yml` deploys on every push to `main-exh9xw` (or by hand:
Actions → Deploy to Cloudflare → Run workflow). Its first run creates the D1 database, both R2
buckets and the Pages project, applies the migrations and sets a random `HASH_SALT`
(`scripts/cf-setup.mjs`); later runs reuse them. Once:

1. Cloudflare → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**,
   and add **Account → D1 → Edit**.
2. Cloudflare → R2 → enable it (once per account). Workers & Pages → note the **Account ID**.
3. GitHub → Settings → Secrets and variables → Actions → add the secrets `CLOUDFLARE_API_TOKEN`
   and `CLOUDFLARE_ACCOUNT_ID`.

The site is **https://legitforge.pages.dev**: the Pages project `legitforge` (`cf-pages/`) serves
the static files itself (`_routes.json`) and hands everything else (pages, API, admin, media) to
the Worker `legitforge-web` through a service binding. Storage is R2 and D1. The Worker also
answers at `legitforge-web.<subdomain>.workers.dev`; its canonical tags point to pages.dev. For a
real domain later: add it to the Pages project (Workers & Pages → legitforge → Custom domains),
then add the repository **variable** `SITE_URL` (e.g. `https://legitforge.in`) and re-run the
workflow: canonicals, the sitemap and share images switch to it. The other secrets below
(Turnstile, n8n, Access, GitHub) are still set with `npx wrangler secret put`.

### Manual deploy (fallback, from a laptop)

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

Then add your domain to the Worker in the dashboard and set it with `NEXT_PUBLIC_SITE_URL` at build
time and `vars.SITE_URL` in `wrangler.jsonc` (the workflow does both from the `SITE_URL` variable).

**Turnstile:** add the repository variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the widget's site key;
the workflow passes it to the build) together with the `TURNSTILE_SECRET_KEY` secret, never one
without the other: with only the secret, every form submission fails.

## Database changes

Never edit an applied migration. Add `migrations/000N_name.sql`, then run `npm run db:migrate:local`
and, when deploying, `npm run db:migrate:remote`. After changing `wrangler.jsonc`, run
`npm run cf-typegen`. If the change adds a new kind of binding, add its type to
`cloudflare-bindings.d.ts`.

## Admin (/admin)

Projects (paste a screenshot to upload, or capture the live site), team profiles and ID
cards, leads with CSV export, testimonials and site numbers. PLAN §7.8.

**Team:** open Admin → Team and choose "Import the current team" once. From then on the site
reads the people from the database. "Regenerate ID card" redraws the flip and 3D cards.

**Capture cover** needs Cloudflare Browser Rendering (the `BROWSER` binding in
wrangler.jsonc, a paid add-on). Without it, the button says so; pasting a screenshot always
works.

**Add from GitHub (fastest way to add a project):** Admin → Projects → "Add from GitHub" → paste or
pick the image, paste the repo link, press Create project. The title, summary, challenge, what was
built, stack, tags, category and live link are written from the repo's description, README, topics,
languages and homepage (no AI, no cost). It opens as a draft: check it, add the client and the result
number (numbers are never made up), then Publish. For private repos, create a fine-grained GitHub
token (GitHub → Settings → Developer settings → Fine-grained tokens; repository access: your project
repos; permissions: Contents and Metadata, read-only) and set it: `npx wrangler secret put GITHUB_TOKEN`.
Public repos work without it (GitHub allows 60 reads an hour without a token).

**Locally:** run `npm run db:migrate:local`, set `ADMIN_DEV_BYPASS=1` in `.dev.vars`, run
`npm run dev`, then open http://localhost:3000/admin. The bypass only works on localhost.

**In production,** Cloudflare Access protects it, and the app checks the Access token again.
The deploy workflow sets it all up (`scripts/cf-access.mjs`) once the site has its own domain:

1. Cloudflare → Zero Trust: open it once, choose a team name and the Free plan.
2. Add **Access: Apps and Policies → Edit** and **Access: Organizations, Identity Providers, and
   Groups → Edit** to the `CLOUDFLARE_API_TOKEN` (My Profile → API Tokens → edit the token).
3. GitHub → Settings → Secrets and variables → Actions → Variables: add `ADMIN_EMAIL` (your Google
   address; comma-separate several) and `SITE_URL` (your domain). Re-run the workflow.

Sign-in is a one-time PIN sent to that email. For a "Sign in with Google" button instead, create an
OAuth client in Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web
application; redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`; keep the
consent screen in Testing with your address as the only test user) and add its ID and secret as
the repository **secrets** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Either way only
`ADMIN_EMAIL` gets in: the Access policy allows only it, and the app checks `ADMIN_EMAILS` again.

Without both secrets, /admin is a 404 for everyone. If you change data outside the admin
(for example with `wrangler d1 execute`), press Admin → Site → "Refresh site content". Published projects replace the
placeholders on the home page and /work. Draft previews are at `/admin/preview/<slug>`.

## Fonts

Archivo is self-hosted as one subset, `app/fonts/archivo-latin.woff2` (about 80 KB, both variable
axes). Google serves it as two files (176 KB). Same glyphs, so the site looks identical; it just
arrives before the first layout. If `npm run check` reports a character missing from the subset,
rebuild it:

```
python3 -m venv /tmp/fe && /tmp/fe/bin/pip install fonttools brotli
/tmp/fe/bin/python scripts/subset-archivo.py "new characters"
```

## Before launch

Search the code for `[` placeholders and `TODO` (real domain, WhatsApp number, business details,
budget ranges). PLAN §0 and §18 list what's needed.
