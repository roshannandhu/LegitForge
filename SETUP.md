# Legit Forge — accounts, setup and automation plan

Part 1 records where every account, ID and setting lives and what is left to do. Part 2 is the
full plan for the WhatsApp automation system, SEO and launch. The website itself is specified in
`PLAN.md` (§9 covers the original WhatsApp and n8n design; Part 2 here refines it).

**No secrets in this file, ever.** Passwords and tokens live only in a password manager and in
encrypted secret stores (GitHub Actions secrets → Cloudflare). This repository is not a safe place
for them. If a secret is ever pasted into a chat, a file or a screenshot, rotate it.

Last updated: 29 September 2026.

---

## Business

| Item | Value |
|---|---|
| Trade name | Legit Forge |
| Type | Proprietorship (Roshan Raj M) |
| Udyam number | UDYAM-KL-08-0118659 (public; verify on udyamregistration.gov.in) |
| Location | Feroke, Kozhikode, Kerala, India |
| Activities (NIC) | 62012 Web-page designing · 62020 Computer consultancy |
| Business email | legitforge@gmail.com |
| GST | Exempted (below threshold) |

The full address is on the Udyam certificate. Use it **exactly** the same on Meta, Google Business
Profile and the website.

---

## Meta / WhatsApp Cloud API

| Item | Value |
|---|---|
| Business portfolio ID | 554954349988257 |
| App | Legit Forge Bot |
| App ID | 1828060321515264 |
| Use case | Connect with customers through WhatsApp → Integrate with API |
| Test number | +1 555 193 6315 |
| Test Phone number ID | 1407419142444585 |
| WhatsApp Business Account ID | 2890191351360065 |
| API Setup page | https://developers.facebook.com/apps/1828060321515264/whatsapp-business/wa-dev-console/ |
| Graph API version | v25.0 |

The test number can message only the recipient numbers verified on the API Setup page (up to 5).
The real business number is added in "Step 2. Production setup", once the bot works.

---

## Supabase (bot brain: conversations, AI memory, team status, escalations)

| Item | Value |
|---|---|
| Project ref | htnkzplobqoghnuvmyup |
| Region | ap-south-1 (Mumbai) |
| Host (session pooler, IPv4) | aws-0-ap-south-1.pooler.supabase.com |
| Port | 5432 |
| Database | postgres |
| User | postgres.htnkzplobqoghnuvmyup |
| SSL | required |

Use the **session pooler** from n8n. Free projects pause after about a week without activity, so
keep a daily n8n ping or move to Pro before launch.

Website content, form leads and the admin stay in **Cloudflare D1** (see `web/`). WhatsApp leads are
sent to the Worker so every lead appears in `/admin`.

---

## Secrets: where each one lives (never the values)

| Name | What | Stored in |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploys the site | GitHub Actions secret |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account | GitHub Actions secret |
| `WA_ACCESS_TOKEN` | Meta **permanent** system-user token | GitHub Actions secret → Cloudflare |
| `WA_APP_SECRET` | Meta App settings → Basic → App secret (webhook signatures) | GitHub Actions secret → Cloudflare |
| `WA_VERIFY_TOKEN` | Random phrase for the Meta webhook check | GitHub Actions secret → Cloudflare |
| `TELEGRAM_BOT_TOKEN` | Team alert bot (@BotFather) | n8n credentials |
| Supabase database password | Postgres login | Password manager + n8n credentials |
| `N8N_SHARED_KEY`, `N8N_CALLBACK_SECRET` | Worker ↔ n8n authentication | GitHub Actions secret → Cloudflare, and n8n |

Keep a copy of every value in a password manager (for example Bitwarden) under legitforge@gmail.com.

---

## Status

- [x] Udyam registration
- [x] Meta Business portfolio and app
- [x] WhatsApp test number claimed
- [ ] Test message received on a personal phone, and replied "Hi"
- [ ] Meta business verification submitted (Udyam certificate, same name and address)
- [x] Supabase project in Mumbai
- [ ] Supabase database password reset (the first one was exposed in chat)
- [ ] Supabase connector added at claude.ai/customize/connectors
- [ ] n8n: choose Cloud or VPS
- [ ] Telegram team group and alert bot
- [ ] Website deployed on Cloudflare (workers.dev first, then the real domain)
- [ ] Business details filled in `web/lib/site.ts`

---

# Part 2 — The plan

## 1. Where the project stands

The website (`web/`) is built: every home section, the service pages (websites and web apps,
WhatsApp automation, n8n, SEO, NFC, quotation and warranty system), work and case studies, team
with 3D lanyard cards, blog, contact, legal pages and the admin. Lighthouse scores 100 for SEO,
accessibility and best practices, and it is tuned for 2 GB phones.

What does **not** exist yet is the product the site sells: the WhatsApp webhook, the real bot and
the n8n workflows. The database tables for it are ready (`wa_processed`, `wa_optouts`,
`demo_sessions`, `leads`), and the "live test" on the home page is a scripted demo until the bot
is live.

## 2. Rules that shape everything

1. **Official Meta WhatsApp Cloud API only.** Unofficial libraries (Baileys, whatsapp-web.js,
   WAHA, Evolution API) break WhatsApp's terms and get numbers banned, usually for good. The
   business number is printed on the site, cards, NFC tags and Google Business Profile, and we sell
   WhatsApp automation to clients, so a ban is not a risk we can take. Unofficial tools are only for
   experiments on a spare SIM.
2. **Meta AI policy (since 15 January 2026).** General-purpose AI assistants are not allowed on the
   WhatsApp Business Platform. Business-specific bots are. Our AI talks only about Legit Forge
   work and hands everything else to a person.
3. **Pricing (from 1 October 2026).** Incoming messages are free. Free-form replies inside the
   24-hour window are free for the first 1,000 a month per number, then billed. Templates are
   billed. So replies are short and complete, and team alerts go through Telegram, not WhatsApp.
4. **24-hour window.** If a person answers more than 24 hours after the client's last message, only
   an approved template can be sent.
5. **Verification is not a blocker.** The bot is built on the free test number. An unverified
   business can use its real number with lower limits; verification (Udyam certificate) raises them.

## 3. Architecture

| Layer | Tool | Job |
|---|---|---|
| WhatsApp gateway | Cloudflare Worker (`/api/whatsapp/webhook`) | Verifies Meta's signature, answers in under a second, ignores duplicates, handles STOP/START, sends replies. Holds the WhatsApp token |
| Orchestrator | n8n | Routing, AI calls, team alerts, calendar, escalation timers, sheet copy |
| AI | LLM gateway (section 7) | Language detection, classification, extraction, replies, summaries |
| Bot memory | Supabase (Postgres) | Conversations, messages, AI chat memory, team status, escalations, claims, language; pgvector knowledge base of our services |
| Website data | Cloudflare D1 | Projects, team, testimonials, **all leads** (WhatsApp leads are posted to the Worker so `/admin` shows every lead) |
| Team view | Google Sheet | Read-only copy of leads made by n8n. The bot never reads it |
| Team alerts | Telegram group + bot | Summaries with a Claim button; free and instant |
| Urgent calls | Exotel or Plivo (India) or Twilio | Voice call to whoever is on duty |
| Human replies | Chatwoot (recommended) or Meta coexistence | Shared inbox for the API number, assignment, bot on/off per chat |
| Scheduling | Google Calendar (legitforge@gmail.com) | Who is free, and booking discovery calls with a Meet link |

Why D1 and Supabase both: D1 is already wired into the website and admin. n8n cannot reach D1
directly, but it has native Postgres and Supabase nodes and "Postgres Chat Memory" for AI agents.
Each database has one job; no data is kept in both.

## 4. Chat modes

Every conversation is in exactly one mode, stored in Supabase, so the AI and a person never both
reply.

| Mode | Who replies | When |
|---|---|---|
| AI qualifying | AI | Default for requests about our listed services: what they need, budget, timeline, similar work |
| Human | A team member; AI silent | Someone claimed the chat, or the client asked for a person |
| AI on a goal | AI, within limits | Nobody is free or it is after hours, with a goal set by the owner or the default goal |

In every mode the AI never quotes beyond the "from" prices on the site, never promises a deadline,
never accepts a contract and never discusses anything outside our business. It says "our team will
confirm that" and flags the chat.

## 5. Escalation ladder (out-of-catalog and important requests)

1. **Detect.** The AI tags each message: listed service / custom or new service / high value /
   upset client / asked for a person. Everything except "listed service" escalates.
2. **Broadcast.** One Telegram message to the team: who, what they want, budget, language, urgency,
   link to the chat, and a **Claim** button. The first person to claim owns it; the others see
   "Claimed by X".
3. **About 5 minutes unclaimed:** voice call to the on-duty person ("Urgent lead, check Telegram").
4. **About 15 minutes unclaimed:** call the next person. The AI tells the client honestly when a
   specialist will reply and keeps collecting details.
5. **Nobody available or after hours:** the chat switches to "AI on a goal" and the owner gets
   "Any goal for this client?". A reply such as "get their budget and book a call Friday" becomes
   the goal. With no reply in about 10 minutes, the default goal applies: collect a full brief and
   book a call.

Availability comes from Google Calendar free/busy plus `/free`, `/busy` and `/off` commands in the
Telegram group. No calls during quiet hours unless the lead is marked urgent. The ladder is what
keeps the "reply within 2 hours" promise printed on the site (`SITE.replyWithin`).

## 6. Google Calendar

1. **Availability:** each team member shares their calendar with legitforge@gmail.com; n8n reads
   free/busy for routing.
2. **Booking:** the AI offers three real free slots as buttons, creates the event with a Google Meet
   link, and sends the approved `call_reminder` template the day before.

## 7. AI models and the LLM gateway

**Routing.** A small, fast model handles about 90% of the work: language detection,
classification, extraction and short replies. A stronger reasoning model is used only for custom
or out-of-catalog requests, upset clients, high-value deals, low-confidence cases and the team
summary. ("Jev model" in the original idea is read as this stronger model; confirm if a specific
model was meant.)

**Gateway with fallback across different providers.** Cloudflare AI Gateway (logs, caching, rate
limits, fallback; already on Cloudflare) or LiteLLM (open source). Order:

1. Cloudflare Workers AI (free daily allowance)
2. Groq or Cerebras free tier
3. Google Gemini or OpenRouter free models
4. A small paid tier as the last step, so the bot never goes silent
5. Optional: an open model on the n8n server

**Not allowed:** several accounts on the same provider to stretch free limits. It breaks their
terms, and linked accounts get banned together, usually mid-conversation.

**Privacy.** Some free tiers may use prompts for training. Strip phone numbers and personal details
before sending, use free tiers only where their terms allow client data, and name the AI providers
in the privacy policy (India's DPDP Act requires consent and disclosure).

**Consistency.** One shared prompt and output format for every model; every AI output is checked
against the format before use, and an invalid answer moves to the next model.

## 8. Languages

WhatsApp allows three reply buttons, or a list of up to ten rows.

1. Detect the language from the first message and confirm: "Continue in Malayalam?" [Yes]
   [Change language].
2. "Change language" opens a list of the supported languages. The choice is stored per client.
3. The AI replies in that language; **team summaries are always in English**.
4. In Chatwoot a person can write in English and translate before sending (always reviewed, never
   automatic).
5. Templates need Meta approval **per language**. Start with English, Malayalam, Hindi and Tamil,
   then add languages the data asks for.

The website stays English; translating it is a separate project.

## 9. Build phases

| Phase | Scope | Why this order |
|---|---|---|
| 1. Launch basics | Webhook, button bot (PLAN §9.6), form and WhatsApp leads → D1 + Telegram alert, Chatwoot, deploy workflow copies secrets into Cloudflare | Works without AI and powers the site's live test |
| 2. Core idea | AI classification and summaries, Claim button, call ladder, Calendar availability and booking, Supabase memory, Sheet copy | Most of the value |
| 3. Scale | AI on a goal, stronger model routing, gateway fallback chain, languages | Built on real conversation data |

**Measure from day one:** first-reply time (the 2-hour promise), share of chats handed to a person,
AI answers a person had to correct, cost per conversation, chats that became booked calls.

**Productise it.** "AI WhatsApp receptionist with team handoff" is a package to sell under the
WhatsApp automation and n8n services. Build it for Legit Forge first, then write the case study.

## 10. Meta setup, step by step

1. Business portfolio at business.facebook.com (name Legit Forge, email legitforge@gmail.com). Done.
2. Developer account at developers.facebook.com. If Meta blocks changing the email on a new device,
   keep the Facebook account's email; legitforge@gmail.com is set on the portfolio and the app.
   Turn on two-factor authentication.
3. App "Legit Forge Bot", use case "Connect with customers through WhatsApp", "Integrate with API".
   Done.
4. Step 1 "Try it out": generate the temporary token, add a personal number as recipient, send the
   sample template, reply "Hi".
5. Business verification: Security Centre → Start verification, name and address exactly as on the
   Udyam certificate.
6. After the bot works (Step 2 "Production setup"): add the business SIM (not active in the normal
   WhatsApp app), get the display name "Legit Forge" approved, create a system user with a
   permanent token (`whatsapp_business_messaging`, `whatsapp_business_management`), add a payment
   method, set the webhook to `https://<domain>/api/whatsapp/webhook`, submit the `quote_ready`
   and `call_reminder` templates (utility).
7. Every week: quality rating and messaging limits in WhatsApp Manager.

## 11. SEO setup (with legitforge@gmail.com)

The site already has per-page titles and descriptions, canonicals, `sitemap.xml`, `robots.txt`,
structured data, share images and `llms.txt`. What remains is outside the code:

0. **Real domain first.** On `*.workers.dev` the site is deliberately noindex. Add the domain to the
   Worker, set the `SITE_URL` repository variable and re-run the deploy (`web/README.md`).
1. **Google Search Console:** add a **Domain** property, verify it with the TXT record in Cloudflare
   DNS, submit `sitemap.xml`, request indexing for the home page.
2. **Google Business Profile:** primary category "Website designer" plus secondary categories,
   service area (Kozhikode), services, photos, hours; verify; send the review link to every client.
   Name, address and phone exactly as on the Udyam certificate and Meta.
3. **Bing Webmaster Tools:** import from Search Console (submits the sitemap too).
4. **Analytics:** the site is cookie-less by design (Cloudflare Web Analytics). Google Analytics 4
   would need a code change and a privacy policy update.
5. **Fill the business details** in `web/lib/site.ts` (legal name, city, country, email, WhatsApp
   number, social links) so the footer, legal pages and structured data are complete.
6. **Check:** Rich Results Test on the home, a service and a case study; share previews on WhatsApp
   and LinkedIn; PageSpeed Insights.

## 12. Next actions

1. Reset the Supabase database password.
2. Finish Meta Step 1 (test message received and replied).
3. Submit Meta business verification with the Udyam certificate.
4. Decide n8n Cloud or VPS.
5. Create the Telegram group and alert bot.
6. Deploy the site on Cloudflare (workers.dev first).
7. Connect the Supabase connector at claude.ai/customize/connectors and start a new session.
8. Build Phase 1: webhook, button bot, lead saving, Telegram alert, secrets in the deploy workflow.
