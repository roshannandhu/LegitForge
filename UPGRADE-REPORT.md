# WhatsApp automation: audit, upgrade and verification report

18 October 2026 · branch `main-exh9xw` · commits `5ba5d93` → `d89f992` (on top of phases 1–7, `8ebc58b`…`ec2f754`).
Architecture: [ARCHITECTURE-WHATSAPP.md](ARCHITECTURE-WHATSAPP.md) and [ARCHITECTURE-WEBSITE.md](ARCHITECTURE-WEBSITE.md).

**Read first.** The brief assumed Baileys, a Node.js socket runtime, an email-signature service and
a "ten-workflow" WhatsApp offering. None of these exist in this project. The bot uses Meta's
official **WhatsApp Cloud API** on a **Cloudflare Worker** (`web/bot/`): webhooks, with no
persistent socket or QR session. The website (`web/lib/pages.ts`) sells six services: websites and
web apps, WhatsApp automation, n8n workflows, SEO, NFC cards and tags, and MR Signage. I did not
add Baileys, an email-signature service or invented workflows. Everything below is measured on the
real system. Nothing was deployed, no secret was set, and no live message was sent.

---

## A. Existing functionality verified (phases 0–7)

| Feature (phase) | Where | How verified | Status |
|---|---|---|---|
| Webhook signature, store-then-200, dedupe by `wamid` (1) | `worker.ts` fetch, `inbound` | backend tests: bad signature 401, duplicate delivery → one reply, Supabase down → 500 | Working |
| Menu → language → name, business, need → timeline (1, 3) | `Turn.handle/ask`, `text.ts` | tests per step, WhatsApp limits tests | Working |
| Lead in D1 before any alert (1) | `saveLead` | test "a lead in Admin → Leads" | Working |
| One turn per client, drain loop, stuck-turn retry (2) | `runClient`, `claim`, cron | tests "two quick messages", cron retry | Working |
| STOP, DELETE MY DATA (1, 2) | `Turn.handle`, `erase` | tests incl. erase of leads, files, calls, messages | Working |
| AI extraction, redaction, Groq→Gemini order, per-client cap (3) | `io.ts chat/redact`, `Turn.ai` | tests: no AI request contains a phone or email; caps | Working (fakes) |
| Knowledge answers, escalation, 10-minute message (4) | `answerOrAsk`, `escalate`, cron | tests incl. thresholds, MONEY, commitment | Working (fakes) |
| Team answer → Q&A → Approve / Edit / Reject (2, 5) | `suggest`, `review`, `saveEdit` | phase 2 tests | Working |
| Files, voice notes (3) | `keep`, `listen`, R2 | tests incl. sizes, purge | Working (fakes) |
| Team routing in turns, busy/off, form leads, summary (4) | `alertTurns`, `route`, `passOn`, cron | phase 4 tests | Working |
| Calls (calendar), quotes, payments, reviews, revival (5) | `calendar.ts`, `pay.ts`, worker | phase 5 tests | Working (fakes) |
| Admin: chat viewer, answers, pause, saved replies, dashboard, monthly report (6) | `bot/admin.ts`, `app/admin/whatsapp` | phase 6 tests + build | Working |
| Website chat bubble, Messenger, Instagram (7) | `channels.ts`, `components/chat` | phase 7 tests + browser check at 3 sizes | Working, after fixes (B) |

**Audit matrix for the brief's capabilities**

| Capability | Before this work | After | Evidence |
|---|---|---|---|
| Baileys connection, QR, reconnect | Not applicable (Cloud API webhooks) | Not applicable | `ARCHITECTURE-WHATSAPP.md` runtime note |
| Nine reply styles (en, ml, mg, hi, hg, kn, kg, ta, tg) | 5 (no Hinglish, Kanglish, Tamil, Tanglish) | 9 | `tests/language.test.ts` |
| Language detection without an LLM; short replies never switch | Script only | Script + romanised words + English, with false-positive guards | 35 detection cases |
| Skip the language list for a clear first message | Missing (always asked) | Implemented | conversation tests |
| Mirror the style; saved preference respected | Missing | Implemented (auto follows two clear messages; a choice stays) | tests |
| Regional phrase corrections | Missing | Implemented (D1 `bot_phrases`, WhatsApp command, Admin) | tests |
| Numbered-text fallback, typed numbers, option titles | Missing | Implemented | tests incl. Meta refusing lists |
| Back, menu, cancel, change language, talk to a person | Partial (AI "person" only) | Typed commands in every language | tests |
| Service-specific questions, nothing asked twice | Working | Kept | phase 3 tests |
| No invented prices or commitments | Working (MONEY, commitment → team) | MONEY extended to Tamil and romanised amounts | tests |
| Knowledge lifecycle (versions, supersede, archive, review dates) | Partial (pending, approved, rejected) | Implemented | tests |
| Duplicate/conflicting answers | Missing | Every approval supersedes the answer in use | tests |
| Admin: pending questions, answer them, health, take over, language | Missing | Implemented | tests + build |
| Global daily AI cap | Missing | Implemented (`AI_DAILY_CAP`) | tests |
| Website-chat leads reachable | Missing (no contact info) | Contact step | tests |
| Hybrid keyword + vector retrieval | Vector only | Vector only (**not done**: see M) | — |
| Per-conversation quality scoring | Missing | Missing (**not done**: see M) | — |
| Email-signature service, ten workflows | Not part of the product | Not added (not on the site) | `lib/pages.ts` |

## B. Bugs found and fixed

Three adversarial reviews ran (reviewer, then a skeptic verifier, then a completeness critic per
round), plus my own checks. When the verifiers hit usage limits, I checked each finding against
the code myself. Every fix has a regression test.

**Phase 7 review (website chat, Messenger, Instagram).** Commits `ec2f754`, `5ba5d93`.
- Forged button ids on the public `/chat`: anyone could book calls at 3 a.m. and set off paid
  team templates. Fix: only the buttons of the bot's latest message are accepted, and `book()`
  takes only offerable half hours (`calendar.ts offerable`).
- Rate limits could be bypassed with parallel requests or with DELETE MY DATA. Fix: atomic D1
  counters (`bot_limits`, migration 0016): 10 a minute per chat, 20 new chats an hour per hashed
  address, 100 in all.
- One poisoned message (`slot:Infinity`) blocked everyone's retries. Fix: a message is let go
  after 30 minutes of failures.
- Instagram refused texts over 1,000 bytes. Fix: `parts()` splits them.
- Channel leads were recorded as WhatsApp with WhatsApp consent. Fix: the channel is the page,
  and there is no consent.
- Website-chat leads were unreachable. Fix: a contact step.
- Messenger/Instagram replies were impossible after 24 hours. Fix: Meta's human-agent tag, for a
  person's reply only.
- The bot's `workers.dev` address was exposed on the site. Fix: the bubble goes through the site's
  `/api/chat` and the `BOT` binding.
- Bubble UI fixes: Lenis took the mouse wheel, the panel sat under the header, the poll loop
  leaked, and a failed chunk load broke the page. Others: focus, input-method Enter, links, the
  delete confirmation, the print rule.

**Upgrade review: 32 findings, all fixed** (`d89f992`). The most serious:
- **Privacy:** a number typed into the website chat could erase another person's WhatsApp leads
  (`erase()` now matches phones only for WhatsApp chats).
- **Wrong service:** "a quote for a website" picked the quotation system and "found you on Google"
  picked SEO, both skipping the menu (`clearService` now needs exactly one service in words that
  mean it).
- **Lost enquiries:** "cancel" after a booked call wiped the enquiry (now only while the brief is
  asked).
- **Typed numbers:** "1" after a price question was taken as "arrange a call" (numbers now answer
  only the step's own buttons).
- **Knowledge:** an old Edit prompt brought back a replaced answer, so two answers competed. Every
  approval now supersedes the one in use.
- **Language detection:** "Karna Motors" and "a mere landing page" turned English into Hinglish.
  Names and English words are now hints only.
- **Cost cap:** the daily AI cap blocked team approvals, and the seed script crashed without D1.
- **Admin drafts:** admin answers kept client names. They now go through the same generalising
  step as the team's.
- **Coverage gaps:** Tamil money words, approved translations for the four new styles, and voice
  notes switching a romanised client to the script.

**Dependency check.**
- `next` 16.3.6 has advisories fixed in 16.3.8. Upgrading broke every share-image route (500 on
  Workers: 320 preflight checks passed, 5 failed), so I **reverted** and report it (J, M).
- `source-map-js` updated within range.

## C. Missing functionality implemented

- Four reply styles (Hinglish, Kanglish, Tamil, Tanglish) with every fixed message and service
  question. The **owner should proofread** the new text.
- Language detection in `text.ts guessLang`, plus skipping the language list and following the
  customer's style.
- Typed commands in all languages, typed numbers and option titles, and the numbered fallback
  (`io.ts orNumbered`).
- Knowledge versions with history, archive, review dates, supersede on every approval, and wins
  credited to the version in use.
- Regional phrases (D1 `bot_phrases`): the WhatsApp `phrase …` command and Admin → Settings. The
  AI gets them as reading hints.
- A global daily AI cap (`AI_DAILY_CAP`). The team's and admin's saves are counted but never
  blocked.
- Admin → WhatsApp → **Questions** (answer from the admin), the **health** card, **take over / hand
  back** and the **reply language** in the chat viewer, and **phrases**.
- A browser release check for the bubble (`scripts/check-chat.mjs`, in the preflight).
- The two architecture documents.

## D. Architecture changes

- No new services, providers or frameworks.
- The website chat now reaches the bot through the website's own `/api/chat` and the private
  `BOT` service binding (`BotAdmin.fetch`). The bot has no public chat endpoint, and its address
  is not on the site.
- `MONEY` moved to `lib/wa-services.ts` so the admin and the bot share one price filter (`lib/`
  never imports `bot/`).
- See the diagrams in `ARCHITECTURE-WHATSAPP.md` (message, learning, handoff, ERD, deployment,
  trust boundaries).

## E. Database changes (all additive)

| Migration | Where | Change | Who runs it |
|---|---|---|---|
| `007_phase7.sql` | Supabase | `messages.options` (bubble buttons) | Owner, SQL editor |
| `008_upgrade.sql` | Supabase | step `contact`; languages hg, kg, ta, tg; `knowledge.version`, `supersedes`, `review_at`; statuses `superseded`, `archived`; `match_knowledge` skips answers past review | Owner, SQL editor (needed for WhatsApp too) |
| `0016_bot_limits.sql` | D1 | chat limits and the AI count | Site deploy |
| `0017_bot_phrases.sql` | D1 | regional phrases | Site deploy |

RLS is unchanged: on for every Supabase table, with no policies, so only the bot's service role
can read. The fake database in the tests mirrors every CHECK constraint.

## F. Multilingual results (`tests/language.test.ts`, executed)

| Style | Native-script case | Romanised cases | Mixed / variants | Short replies | Result |
|---|---|---|---|---|---|
| English | — | — | "I need a website for my shop", names ("Karna Motors", "Unga Textiles") stay English | — | pass |
| Malayalam / Manglish | എനിക്ക് ഒരു വെബ്സൈറ്റ് വേണം | "Enikku oru website venam. Ethra paisa aakum?", "Website ethra aakum?", "Bro payment gateway venam." | "…budget 15k aanu", "enikk oru site venam chetta" | "Venda." → none | pass |
| Kannada / Kanglish | ನನಗೆ ವೆಬ್‌ಸೈಟ್ ಬೇಕು | "Nanage website beku. Eshtu cost agutte?", "Nanage dynamic website beku." | — | — | pass |
| Hindi / Hinglish | मुझे वेबसाइट चाहिए | "Mujhe business website chahiye. Kitna kharcha hoga?", "Mujhe automation chahiye." | "muje site chaiye bhai" | "Nahi." → none | pass |
| Tamil / Tanglish | எனக்கு ஒரு இணையதளம் வேண்டும் | "Enakku ecommerce website venum. Evlo aagum?", "Enakku booking website venum." | "oru website venum bro" | — | pass |
| All | — | — | "Bro enikku website venam, kitna lagega?" → none (two languages: the bot asks) | Ok, Yes, 👍, hmm, ha → none | pass |

- **The test file covers:** 35 detection cases, commands in every language, money words, the
  contact parser, and every fixed text in all nine styles within WhatsApp's limits.
- **Conversation tests:**
  - a Manglish first message skips the menu and the list, the brief is in Manglish, and the call
    offer follows
  - "ok" never switches
  - two Hinglish messages switch an auto-detected language
  - a chosen one stays
  - numbers pick Tamil from the list
- **Not run: the live AI's quality** (Groq/Gemini output in each style). There are no API keys
  here, so this is **blocked**, not passed.

## G. Team-learning verification (executed with fakes)

The whole loop runs in the phase 2 and upgrade tests:
1. A question is asked and no approved answer exists.
2. It is escalated with the 10-minute message.
3. A team member answers by swiping or with `#CODE`.
4. The answer is relayed in the client's language.
5. A generalised Q&A is drafted.
6. Approve → approved, with translations offered for approval.
7. A second client asking the same thing differently is answered by the bot, and the team is not
   asked again.

Also tested:
- Reject, Edit (a new version), and an old Edit prompt (refused).
- Two answers for one question: superseded.
- Expired: past its review date, so the team is asked.
- Archive.
- A second answer to the same question: "already answered by …".
- An admin answering from Admin → Questions: a generalised draft that the bot doesn't use until it
  is switched on.
- A take-over.

**Not implemented:** linking similar pending questions from *different* clients into one team
request (each client's question goes to the team).

## H. WhatsApp menus

- Lists and reply buttons are the Cloud API's official interactive messages. Their payloads,
  limits and tap parsing are tested.
- **No real Android or iOS device was tested** (blocked). This is not verified.
- **Numbered fallback, tested:** when Meta refuses a list or buttons (and only then, not on a
  timeout), the same choices go out as numbered text. "1", "2.", "option 2" or the option's words
  answer it.
- Typed numbers answer only the step's own buttons.

## I. Cost-control verification

Tested:
- the per-client AI cap (40 a day)
- the global `AI_DAILY_CAP`: past it, fixed text and the team, and the team's saves are never
  blocked
- the call budget (`room()`, 48 calls / 18 s: "two quick messages" stays inside it)
- the bubble's limits (10 a minute, 20 new chats an hour per address), including concurrent
  requests

No AI is used for menus, taps, numbers, commands, languages, STOP or deletion. Embeddings are made
only for questions and saved answers. Free-tier limits are in `ARCHITECTURE-WHATSAPP.md` §11.
Templates (WhatsApp) cost money; the revival template is off by default.

## J. Security verification

Tested:
- webhook signatures, the bubble's own-buttons rule and its size and rate limits, and
  `/api/chat`'s 4 KB cap
- `redact()` before every AI call
- MONEY and the commitment flag
- DELETE MY DATA isolation (a typed number can't reach another person's leads)
- team commands only from team numbers
- `requireAdmin()` in every new action (a code rule; the build checks types)

Other checks:
- **Secret scan:** tracked files, no keys found.
- **`npm audit --omit=dev`:** 10 high advisories, none in the bot's runtime path:
  - `next` 16.3.6: SSG/ISR cache poisoning, image-optimization SSRF and a metadata-image bypass.
    No remote image patterns are configured, so the SSRF can only fetch the site's own images. The
    patch release breaks share images on Workers (B), so it needs a Next + OpenNext upgrade tested
    together.
  - `@cloudflare/puppeteer` and its tree: browser-download code that doesn't run in Workers.
  - `sharp`: build-time and local only.
- **No ESLint configuration** exists in the project, so lint was **skipped**.

## K. Test report

| Category | Command / procedure | Cases | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|---|---|
| Backend: bot, languages, calendar, leads, analytics, cache, front door, GitHub brief | `npm run test:backend` (node:test, Miniflare D1, fakes) | 139 | 139 | 0 | 0 | 0 |
| — of which the bot | `tests/bot.test.ts` | 100 | 100 | 0 | 0 | 0 |
| — of which languages | `tests/language.test.ts` | 7 (35+ cases inside) | 7 | 0 | 0 | 0 |
| Type check | `npx tsc --noEmit` | 1 | 1 | 0 | 0 | 0 |
| Production build | `npm run build` | 1 | 1 | 0 | 0 | 0 |
| Worker sizes | `wrangler deploy --dry-run` | 2 | site 2,917 KiB gzip (limit 3,072), bot 75.8 KiB | 0 | 0 | 0 |
| Release gate | `node scripts/preflight.mjs` (smoke, mocked enquiries, access, 37 trust-opening scenarios, 42 service layouts, chat bubble at 3 sizes, 3-viewport audit, phone measure) | 325 checks | 325 | 0 | 0 | 0 |
| Secret scan | grep for key patterns over tracked files | 1 | 1 | 0 | 0 | 0 |
| Dependency audit | `npm audit --omit=dev` | — | — | 10 high (pre-existing, see J) | — | — |
| Lint | — | — | — | — | 1 (no config) | — |
| Live AI quality per language | needs GROQ/GEMINI keys | — | — | — | — | blocked |
| Real-device rendering of lists/buttons | needs phones | — | — | — | — | blocked |
| Live WhatsApp / Messenger / Instagram / Supabase | needs the owner's deploy and keys | — | — | — | — | blocked |
| Load tests beyond the bounded concurrency tests | — | — | — | — | — | not run |

## L. Files changed (since phase 7)

36 files, +2,368 / −201. The main ones:
- `web/bot/text.ts`: nine styles, detection, commands, `clearService`.
- `web/bot/worker.ts`: the flow fixes, lifecycle, phrases, contact step, relay windows.
- `web/bot/io.ts`: the AI cap, the numbered fallback, refused vs failed.
- `web/bot/admin.ts`: questions, health, take over, language, versions.
- `web/bot/channels.ts`
- `web/bot/supabase/008_upgrade.sql`, `web/migrations/0017_bot_phrases.sql`
- `web/app/api/chat/route.ts`
- `web/app/admin/whatsapp/*`: questions page, answers, settings.
- `web/app/admin/leads/[id]/chat/page.tsx`
- `web/components/chat/*`
- `web/lib/wa-services.ts`: MONEY, channels.
- `web/lib/admin/bot.ts`
- `web/scripts/check-chat.mjs`
- tests (`bot.test.ts`, `language.test.ts`, `bot-fakes.ts`)
- docs (`SETUP.md`, `web/CLAUDE.md`, `ARCHITECTURE-*.md`)

## M. Remaining limitations

**Blocked here:**
- Live AI quality in each language.
- Real phones (list and button rendering).
- Meta app review for Messenger/Instagram (pages_messaging, instagram_manage_messages, Human Agent).
- Any live end-to-end run. Nothing is deployed.

**Not built:**
- Keyword (full-text) fallback retrieval.
- Merging similar pending questions across clients.
- Per-conversation quality scoring.

**Dependencies:** the Next.js advisories remain until a tested Next + OpenNext upgrade.

**Owner tasks:**
- The new fixed texts in Hinglish, Kanglish, Tamil and Tanglish need the owner's proofreading.
- The website chat's limits can be filled by a distributed attacker. Turnstile is the noted next
  step.

## N. Deployment readiness

The code is ready to deploy: all automated gates pass. **It is not deployed**, and it needs the
owner, in this order:
1. Run Supabase `schema.sql`, or `002`–`008` on an existing project.
2. Set the Worker secrets (WhatsApp, Groq, Gemini, Supabase, optionally Google, Razorpay and the
   Page token).
3. Deploy through the GitHub workflow, which applies D1 migrations, deploys the bot and then the
   site.
4. Point Meta's webhook at the bot.
5. Test from the spare phone.
6. Proofread the new languages.
7. Optionally set `WEB_CHAT=1` and the Messenger/Instagram steps (SETUP.md step 12).

## O. How it fits together

A client writes on WhatsApp, Messenger, Instagram or the website bubble.
1. **Arrival:** Meta's signed webhook (or the site's `/api/chat` over the private `BOT` binding)
   reaches the bot Worker, which stores the message in Supabase first.
2. **The turn:** one turn per client reads the step from `contacts`:
   - commands, taps and typed numbers are handled without AI
   - language detection picks the reply style
   - the brief's fixed questions come in that style
3. **Questions:** the AI is called only to read free text and answer questions, with numbers and
   emails removed. A question is matched against approved `knowledge` (pgvector, current versions
   only) and answered when sure. Otherwise it goes to the team on their own WhatsApp, in turns, or
   to Admin → Questions.
4. **Learning:** the team's answer is relayed in the client's style and generalised into a draft.
   It becomes reusable knowledge only after a person approves it, and it replaces the earlier
   version.
5. **Leads:** every enquiry is a D1 lead in Admin → Leads. Admin → WhatsApp shows health, questions,
   answers and their history, settings and phrases. The chat viewer shows the whole conversation,
   the take-over control and the language.
6. **Background work:** the bot's cron runs reminders, reports, retries and the privacy purge.
   Everything stays on free plans, with daily AI and per-chat caps.
