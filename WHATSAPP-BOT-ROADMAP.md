# WhatsApp bot: feature roadmap

Chosen by the owner on 16 Oct 2026. Built in `web/bot/` (see `SETUP.md`, "The WhatsApp bot as
built"). Everything runs on free plans (Cloudflare Workers, Supabase, Groq, Gemini) except where
a cost is marked. Every phase is tested before it ships; nothing reaches clients until phase 0 is done.

**Already built:** service menu, language choice (English, Malayalam, Manglish, Hindi, Kannada),
the brief (name, business, need, timeline), answers from approved knowledge, questions to the team
on WhatsApp, learning after Approve, the 10-minute "team will reply" message, STOP, `#CODE take` /
`#CODE bot`, every lead in Admin → Leads, a daily AI limit per client.

## Phase 0: switch it on (owner steps, no code)
Meta token / app secret / webhook, the `team_alert` template, Supabase secret key, Groq and
Gemini keys, a test from a spare phone. Details: `SETUP.md`.

## Phase 1: safe start
| Feature | What it does |
|---|---|
| First-message notice | The first reply says it is an automated assistant and links the privacy page. |
| Training mode (2 weeks) | Every AI-written answer comes to the team as a draft first. |
| Price questions | "Quotes are written after a short call", offers the call, alerts the team. |
| Discount / deadline guard | Discounts, free work, fixed deadlines always go to the team with the client's words. |
| Upset or urgent → person | The bot stops asking questions and hands the chat to the team at once. |
| Spam & abuse filter | Stops replying, marks the chat, tells the team once; unblock in Admin. |
| DELETE MY DATA | Erases that client's chat and details, confirms, tells the team. |
| Returning clients | "Welcome back": same project or a new one? |

## Phase 2: self-learning
| Feature | What it does |
|---|---|
| Draft-and-approve | When the bot is only fairly sure: draft to the team with [Send] [Edit] [Ask me]; each approval teaches it. |
| Learn from every team reply | Replies you write yourself also become suggested answers to approve. |
| Answers in every language | Each approved answer is translated once per language; you approve the translation. |
| Learn your tone | A short style guide drawn from your replies keeps the bot sounding like you. |
| Weekly learning report | Monday 10 a.m.: most-asked questions, what still goes to the team, answers to approve in one tap. |
| Learn from won deals | Chats that became Won leads guide how similar clients are handled. |

## Phase 3: the full requirement
| Feature | What it does |
|---|---|
| Service-specific questions | Different follow-ups per service (website pages and domain, bot languages and volume, NFC quantity…). |
| Reference websites | Asks for 1–2 sites they like and why. |
| Files and photos | Logo, photos, documents saved privately (Cloudflare R2) and linked on the lead. |
| Voice notes | Transcribed (Groq Whisper, free) and handled like text. |
| Show matching work | 2–3 published projects for that service, from Admin → Projects. |
| Gentle follow-up | One reminder 3 hours after a client stops answering (10 a.m.–7 p.m. only). |
| Auto brief document | A one-page English summary on the lead when the brief is complete. |

## Phase 4: team workflow
| Feature | What it does |
|---|---|
| Route by skill | Website/app leads to one person first, automation/AI to the other (set in Admin → Team). |
| Take turns alerting | First person, then the other after 10 minutes. |
| Busy / free / off | Commands to the bot that change who is alerted. |
| Form leads on WhatsApp | Website form enquiries also reach the team through the bot (replaces n8n). |
| Morning summary | 10 a.m. on working days: yesterday's leads, open questions, hot leads. |
| Reply-time tracking | Admin shows how fast each lead got a human reply (the 2-hour promise). |
| Client project updates | `#CODE update: …` passes progress to the client in their language. |

## Phase 5: calls and sales
| Feature | What it does |
|---|---|
| Arrange a call, the client's way | Chat stays the default. When a call is wanted: WhatsApp call, phone call or Google Meet, the client's choice, in the client's language. Times from the Google Calendar (legitforge@gmail.com) within working hours; Meet link and calendar invite; reminder before. |
| Send quote link | `#CODE quote <link>`: sent nicely, noted on the lead, team told when the client replies. |
| Advance payment link | `#CODE pay <amount>`: a UPI/Razorpay link; the team approves every amount. (Razorpay account needed.) |
| Google review request | After a lead is marked Won, a polite review request with your link. |
| Referrals | After a review, asks if they know someone who needs a site or bot. |
| Revive cold leads | One approved template after 30 silent days. **Cost:** about ₹0.86 per message (Meta marketing rate). |

## Phase 6: admin and insights
| Feature | What it does |
|---|---|
| Chat viewer | Read any WhatsApp lead's full conversation in Admin. |
| Answers manager | See, edit, switch off or add what the bot knows. |
| Bot switch + away message | Pause the bot; your own holiday / after-hours message. |
| Saved team replies | Short codes, e.g. `#CODE /portfolio`. |
| Lead score | Hot / warm / cold from timeline, clarity and urgency; hot leads alert first. |
| Leads dashboard | By service, language, source, score, won/lost, week on week. |
| Which page brought them | From the site's WhatsApp buttons and the form. |
| Top questions | Most asked; answered by the bot vs the team. |
| Monthly report | 1st of the month on WhatsApp. |

## Phase 7: more channels (after WhatsApp is settled)
Website chat bubble (free), Instagram DMs and Facebook Messenger (free via Meta, linked business
accounts needed), all using the same knowledge, languages and team hand-off.

## Limits to keep in mind
- Cloudflare Workers Free: 10 ms CPU per request and 100,000 requests a day for the whole account.
  The bot is small and plain-fetch; heavy work (AI) is waiting time, not CPU.
- Gemini's free tier may keep what it receives; Meta's terms forbid that for chat data. Turning on
  Gemini billing fixes it with no code change.
- WhatsApp only allows free replies within 24 hours of the client's last message; anything later
  needs an approved template, and marketing templates cost money.
