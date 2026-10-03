# Legit Forge website

Next.js 16 on Cloudflare Workers (OpenNext). The full specification is `../PLAN.md`;
the agent guide is `CLAUDE.md`.

Current scope (3 October 2026): studio website, CMS and enquiries, with a compact homepage,
illustrative demos on inner pages, custom written quotes and MR Signage last. The real WhatsApp
bot/n8n system is future work in `../SETUP.md`. Company data lives in owner-only Admin → Company.

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

The previous release measured **2799.72 KiB gzip** and **23 ms startup**. Re-measure each build;
startup is not request CPU or an uptime guarantee. Browser-only libraries must stay out of the
server bundle. Verify the current plan and runtime usage in the account rather than assuming
that a small bundle proves all requests fit.
Browser-only libraries stay out of the server bundle behind the `process.env.NEXT_RUNTIME`
guard in components/sections/team.tsx. Keep the guard and check current Cloudflare limits;
historic size/plan estimates in PLAN §8.3 are not a current quote.

`.github/workflows/deploy-cloudflare.yml` deploys on every push to `main-exh9xw` (or by hand:
Actions → Deploy to Cloudflare → Run workflow). Its first run creates the D1 database, both R2
buckets and the Pages project, applies the migrations and sets missing random `HASH_SALT` and
`ADMIN_SESSION_KEY` secrets (`scripts/cf-setup.mjs`); later runs reuse them. Before any remote
change it typechecks, runs backend tests, builds OpenNext and checks an isolated local Worker,
mocked JS/no-JS enquiries and the browser gate. It then deploys Worker → four data tags → Pages,
and reads `/api/health`, routes and a matching build asset against the expected Git revision.
The last inspected Actions run lacked its Cloudflare token; local OAuth deployment is a distinct
working fallback. Do not declare Actions repaired until a credentialed run succeeds. Once:

1. Cloudflare → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**,
   and add **Account → D1 → Edit**.
2. Cloudflare → R2 → enable it (once per account). Workers & Pages → note the **Account ID**.
3. GitHub → Settings → Secrets and variables → Actions → add the secrets `CLOUDFLARE_API_TOKEN`
   and `CLOUDFLARE_ACCOUNT_ID`.

The site is **https://legitforge.pages.dev**: the Pages project `legitforge` (`cf-pages/`) serves
the static files itself (`_routes.json`) and hands everything else (pages, API, admin, media) to
the Worker `legitforge-web` through a service binding. Storage is R2 and D1. The Worker has no
public address of its own (`workers_dev: false` in wrangler.jsonc). For a real domain later: add it to the Pages project (Workers & Pages → legitforge → Custom domains),
then add the repository **variable** `SITE_URL` (e.g. `https://legitforge.in`) and re-run the
workflow: canonicals, the sitemap and share images switch to it. The other secrets below
(Turnstile, n8n, admin owners and GitHub) are still set with `npx wrangler secret put`.

### Manual deploy (fallback, from a laptop)

Run from `web/`. For a new account, provision the named D1/R2/Pages resources first with the
documented setup script/API-token workflow; for the existing account reuse them. Never create a
second production database simply because the tracked config carries placeholder IDs. Before
deploy, set both D1 bindings to the existing ID and `vars.SITE_URL` to the canonical Pages address
in the local deploy config; do not commit account credentials.

```powershell
npx wrangler login
npx wrangler whoami                   # confirm the intended account/membership
$env:NEXT_PUBLIC_SITE_URL = 'https://legitforge.pages.dev'
$env:BUILD_REVISION = (git rev-parse HEAD).Trim() # append a local suffix for uncommitted releases
npx tsc --noEmit
npm run test:backend
npx opennextjs-cloudflare build
node scripts/preflight.mjs
```

The preflight uses local D1/R2 and dummy local sessions, ignores `.dev.vars` secrets and never
submits real enquiries or sends messages. It does not exercise paid cover capture. Preserve the
checked build; rebuilding would require running its gates again. Once those checks pass:

```powershell
npx wrangler deployments list          # record prior Worker version in a private release log
npx wrangler pages deployment list --project-name legitforge
npx wrangler d1 time-travel info legitforge # record the bookmark before schema changes
npm run db:migrate:remote
npx opennextjs-cloudflare deploy        # deploys the build already checked
node scripts/revalidate-release.mjs    # this exact .next/BUILD_ID; four content tags
node scripts/prepare-pages.mjs         # this exact .open-next/assets + Pages forwarding files
npx wrangler pages deploy .open-next/pages --project-name legitforge --branch main --config cf-pages/wrangler.jsonc --commit-dirty=true
$env:BASE = $env:NEXT_PUBLIC_SITE_URL
$env:EXPECTED_REVISION = $env:BUILD_REVISION
node scripts/smoke.mjs
```

Worker and Pages are a matched release. `npm run deploy` alone publishes only the Worker. For a
custom domain add it to the **Pages** project and Google's authorised JavaScript origins, update
`SITE_URL`/`NEXT_PUBLIC_SITE_URL`, then run the entire checked release. The smoke test issues GETs
only and checks admin rejection; no live customer data or test messages are created.

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
cards, leads with CSV export and delete, testimonials, company details and who can sign in. PLAN §7.8.

**Company:** Admin → Company holds what the site prints about the business: the email (with a
"show on the site" switch), the WhatsApp number every "Chat on WhatsApp" button opens (empty: they
open the contact section), the chat greeting, social links (each with a Show switch), and the legal
name, city, country and GSTIN. Only the owners can save it (whoever sets the WhatsApp number
receives every customer chat); other admins see it read-only. A WhatsApp bot (Cloud API / n8n)
must use the same number.

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
**Private repos (any team member's):** Admin → Projects → Private repos. Once, an owner presses
**Connect GitHub**; GitHub shows "Create GitHub App" (a Legit Forge app on that owner's GitHub
account, read-only: code and details); press it. If GitHub says the name is taken, change it there.
The panel then shows a link: send it to each team member (roshannandhu, vijay-pk, anyone later).
They sign in to GitHub, pick the repos Legit Forge may read, and press Install. Their private repos
then work in "Add from GitHub" like public ones, and the panel lists who has approved. They can
remove it any time in GitHub → Settings → Applications. If someone pastes a repo its owner hasn't
approved yet, the message gives the link to send them. Nobody copies a key: GitHub hands the app's
key straight to the site, which keeps it in D1 encrypted with `ADMIN_SESSION_KEY` (replacing that
secret means pressing Connect GitHub again). Without it, a private repo still gets "Create from the
name only": the draft has the title and repo link, and you fill in the rest. Public repos never need the token and never hit a limit:
your browser tries GitHub's API (60 reads an hour per connection, often used up on mobile networks),
and when that is out, the server reads the repo's public page and raw README instead, which GitHub
doesn't count against that limit.

**Locally:** run `npm run db:migrate:local`, set `ADMIN_DEV_BYPASS=1` in `.dev.vars`, run
`npm run dev`, then open http://localhost:3000/admin. The bypass only works under `npm run dev`
and on localhost: production builds don't contain it. To try
the real Google sign-in instead, leave the bypass empty and set `ADMIN_EMAILS` and
`ADMIN_SESSION_KEY` in `.dev.vars` (the Google client allows http://localhost:3000).

**In production,** only approved Google accounts get in (`lib/admin/auth.ts`). /admin sends
everyone else to `/admin/sign-in`, which shows Google's own "Sign in with Google" button. The
server checks Google's signed ID token itself (Google's keys, this site's client ID, a verified
email, a one-time nonce), then sets a signed, HttpOnly session cookie for 12 hours. Every admin
page, Server Action and route checks that cookie and the allow-list again.

- **Owners:** the Worker secret `ADMIN_EMAILS` (comma-separated). They can always sign in and
  can't be removed in the admin. Change them with `npx wrangler secret put ADMIN_EMAILS`.
- **Everyone else:** Admin → Access. The owners add or remove Google accounts there (added
  admins can use everything else, but can't change who gets in); a removed account is out on its
  next click.
- **Sign-in log and "Sign out everywhere":** Admin → Access lists every sign-in of the last 90
  days. Don't recognise one? Remove that account, or press "Sign out everywhere" (every session on
  every device ends; everyone signs in with Google again).
- **Hardening:** each Google sign-in token works once (a copied one is refused), the admin can't be
  framed by other sites, and its pages enforce a content security policy that blocks scripts and
  connections to anywhere but this site and Google's sign-in.
- **Session key:** the Worker secret `ADMIN_SESSION_KEY`, random, set once by the deploy workflow
  (`scripts/cf-setup.mjs --post`). Replacing it signs everyone out.
- **Google client:** Google Cloud project `legitforge-admin`, OAuth client "Legit Forge admin
  sign-in" (Web application). Its client ID is public and lives in `lib/admin/google.ts`; no client
  secret is used. A new address for the site (a custom domain) must be added to the client's
  Authorised JavaScript origins, or the button won't load there.

With no owners and no one added in Access, nobody can sign in. If you change data outside the admin
(for example with `wrangler d1 execute`), press Admin → Overview → "Refresh site content". Published projects replace the
placeholders on the home page and /work. Draft previews are at `/admin/preview/<slug>`.

## Fonts

Anybody is self-hosted as one subset, `app/fonts/anybody-latin.woff2` (about 44 KB, both variable
axes, trimmed to the weights 400–900 and widths 88–112 % the site uses: the full ranges tripled
the first layout time on phones). Google serves it as separate latin and latin-ext files; one small file
arrives before the first layout. If `npm run check` reports a character missing from the subset,
rebuild it:

```
python3 -m venv /tmp/fe && /tmp/fe/bin/pip install fonttools brotli
/tmp/fe/bin/python scripts/subset-font.py "new characters"
```

## Before launch

Review business/legal/contact data in Admin → Company, real team/work and testimonial permission.
Use custom written quotes; empty numerical prices and invented budget ranges must not reappear.
Keep simulation labels explicit. Review the canonical domain, Google authorised origins,
Turnstile key pair, current account plan/CPU, Web Analytics, Search Console and D1 recovery
retention. External setup is unverified until tested in the account. Starter blog posts remain
draft/noindex until an editor reviews their author and copy.

## Monitoring and recovery

Before a production mutation run `node scripts/check-release-config.mjs`. It reads secret names
only and refuses a partial Turnstile configuration. After securely verifying the exact widget
pair, hostname and `lead` action, set `TURNSTILE_PAIR_VERIFIED=1` (the matching repository variable
in CI). Leave both Turnstile keys unset until that verification is complete. Preflight also checks
keyboard navigation and 200% zoom reflow; `BASE=... node scripts/measure-phone.mjs` records a
repeatable 375-pixel, sixfold CPU/slow-4G lab estimate, with its method and limitations.

Admin Overview reports the last 30 days of aggregate conversion events and lead-delivery states.
Event input is bounded; no names, phones, messages, IPs or session identifiers are retained in
analytics. Aggregate events expire after 13 months. A saved lead is distinct from a delivered
notification: both an HTTPS n8n webhook and shared key are required; unset means no team alert.
The D1 outbox uses atomic leases, an eight-second send timeout and bounded retry/backoff for
network errors, 429 and server failures. Configure it only after n8n authenticates `x-lf-key` and
deduplicates by the stable lead ID/`idempotency-key`: delivery is at least once. Review pending,
delivered and exhausted/dead jobs in admin before explicitly resetting a failed notification.

After every release, retain commit/revision, `.next/BUILD_ID`, Worker version, Pages deployment,
pre-migration D1 bookmark and gate outcomes in a private release log. CI retains identifiers for
30 days, not database exports. Daily: review Worker errors/CPU and delivery failures. Weekly:
review enquiry conversion and Search Console. Dashboard Web Analytics and an external uptime
monitor remain setup items; this repository does not prove they are enabled.

For a code regression, stop new releases, identify the last matching Worker + Pages deployment,
and restore both: `npx wrangler rollback <WORKER_VERSION_ID>` plus the previous production
deployment's **Rollback** action in Pages. Keep matching assets available. Re-run read-only smoke
with that release's `EXPECTED_REVISION`. If the previous code cannot read the new schema, use a
forward-compatible fix; a code rollback does not reverse D1 migrations or R2 changes. Do not
rotate `ADMIN_SESSION_KEY` during rollback: it also encrypts the connected GitHub App key.

Before a schema change, confirm D1 restore support/retention and record a bookmark with
`npx wrangler d1 time-travel info legitforge`. Database recovery overwrites data: pause writes,
take a current encrypted export outside the repository, assess newer leads/content that would
be lost, and get the owner's explicit approval for the chosen restore point. Then use
`npx wrangler d1 time-travel restore legitforge --bookmark <BOOKMARK>`, retain its undo bookmark,
refresh site data and verify admin content/enquiries. Never print or attach the SQL export to a
chat or CI artifact. R2 deletions need a separate media recovery plan; D1 restore is not R2 backup.

Reference commands/limitations against current [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/commands/),
[D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/) and
[Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/) before recovery.
