# Legit Forge — accounts and setup record

Where every account, ID and setting lives, and what is left to do.

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

## Next build steps

1. WhatsApp webhook in the Worker (`/api/whatsapp/webhook`): signature check, de-duplication, STOP/START.
2. Button bot (PLAN §9.6) through n8n, with leads saved and a Telegram alert.
3. Deploy workflow copies the WhatsApp secrets from GitHub into Cloudflare.
4. Then: AI classification and summaries, claim button, call escalation, Google Calendar booking,
   languages (PLAN §9 and the refined plan).
