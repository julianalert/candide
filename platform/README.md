# Candide platform

The app behind **app.candideai.com** and the **AI Creators Club**, an extra-curricular club schools run themselves for ages 8 to 11. A club group follows a term (Term 1 is *Create Your Comic*, 12 weeks); each week the teacher starts that week's mission, every child works in a guarded AI workspace, and their pinned work follows them from week to week until the end-of-term showcase. The marketing site lives one folder up and deploys separately to candideai.com.

Stack: Next.js 15 (App Router), TypeScript, Tailwind v4 with the Sodobat design tokens, Supabase (Postgres, Auth, Storage), Anthropic SDK (Claude Sonnet for chat, Claude Haiku for moderation and prompt rewriting), Zod, Vitest, Playwright. Deployed on Vercel.

## Layout

```
app/                  routes: /join, /play, /g/[publicId], /login, /teacher/**, /api/play/**, /api/teacher/**,
                      /api/demo-request (the "Book a demo" form on candideai.com)
components/           teacher tabs, gallery, join form, kid workspace (studio, mission panel, board)
lib/                  missions (terms + weekly missions, Zod + loader), ai (prompt assembly, Claude), moderation,
                      image providers, kid-session (signed cookie), kid-work (earlier weeks), caps, play, gallery,
                      demo + loops (demo form emails), supabase clients
terms/<term>/         one folder per term: term.json (topic, goal, phases) and week-NN-*.json, one mission per
                      week. Edit JSON, run `npm run seed`. No code change needed.
ai/                   safety.md (fixed, always first), age-tier-8-11.md, moderation.md, image-rewrite.md
supabase/migrations/  0001 schema + RLS, 0002 functions, 0003 storage bucket, 0004 pg_cron jobs,
                      0005 demo requests, 0006 terms, club groups and club lists
scripts/              seed-missions, create-school, ops (end-stale, purge-transcripts, moderation-report)
tests/                Vitest: loader, codes, cookie, caps, prompt assembly, adversarial (live, gated)
e2e/                  Playwright: club + club list → week 1 → kid taps their name, chats, pins → gallery → end
```

## Set up a Supabase project

1. Create a project in the **EU (Frankfurt)** region. Note the project URL, anon key and service role key.
2. Run the files in `supabase/migrations/` in order (SQL editor, or `supabase db push` if you use the CLI). `0004` schedules the auto-end and the 90-day transcript purge with pg_cron; if pg_cron is not available it prints a notice and you run `npm run ops end-stale` / `npm run ops purge-transcripts` from a scheduler instead.
3. Authentication → URL configuration: Site URL `https://app.candideai.com`, redirect URLs `https://app.candideai.com/auth/callback` and `http://localhost:3000/auth/callback`.
4. Auth emails go through **Loops** (candideai.com sending domain). In Loops → Settings → Supabase, connect the project to set its SMTP (smtp.loops.so:587, user `loops`, a Loops API key as password). Each email is a published Loops transactional email (group "Account Management": Auth · Invite, Auth · Magic link, Auth · Confirm signup) with one data variable, `signInUrl`. In Supabase → Authentication → Emails, the Invite user, Magic link and Confirm sign up template bodies are not HTML but a Loops payload, for example:

   ```json
   {"transactionalId": "<Loops ID>", "email": "{{ .Email }}", "dataVariables": {"signInUrl": "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite"}}
   ```

   with `type=magiclink` for Magic link and `type=email` for Confirm sign up (Supabase sends that one instead of a magic link to someone who hasn't accepted their invite). Any template left as HTML fails to send. Subject and sender come from Loops, not Supabase.

## Run locally

```bash
cp .env.example .env.local   # fill in Supabase keys, ANTHROPIC_API_KEY, KID_COOKIE_SECRET
npm install
npm run seed                 # validates terms/*/ and loads the terms and their weekly missions
npm run create-school -- --name "Pilot School" --country QA --admin-email you@example.com --admin-name "You"
npm run dev
```

The invite email signs you in at `/teacher`. Create a club group (name, age track, term), add the children's first names to its club list, and start week 1. Then open `/join` in a private window, type the club code and tap a name. Each week the teacher starts the next week; a child who taps their name sees everything they pinned in earlier weeks, and the AI helper gets a short summary of it.

Without an Anthropic key, set `AI_MOCK=1` (canned replies, keyword moderation) and `IMAGE_PROVIDER=mock` (a locally drawn placeholder PNG); the whole flow still works end to end.

## Image provider

`IMAGE_PROVIDER` selects the adapter in `lib/image.ts`:

- `openai` — gpt-image-1 with `moderation: auto`; set `IMAGE_API_BASE_URL=https://eu.api.openai.com/v1` for EU data residency.
- `google` — Imagen through the Gemini API with `personGeneration: dont_allow`, which refuses people outright.
- `mock` — no network, for development and tests.

The provider is still an open decision in the spec; both real adapters are ~40 lines and share one interface, so switching is an environment change.

## Book a demo (candideai.com)

The marketing site's form posts to `POST /api/demo-request` (CORS allows candideai.com). The route saves the request in `demo_requests` and, through Loops, emails the team the "DEMO ASKED FOR CANDIDE" alert (Loops email "Demo · Team alert") and the requester a confirmation ("Demo · Confirmation"). It needs `LOOPS_API_KEY` and `DEMO_NOTIFY_EMAILS` (comma-separated team addresses, kept out of the repo); without them the request is still saved.

## Tests

```bash
npm test                              # unit tests, no network
RUN_LIVE_TESTS=1 npm test             # also the 20 adversarial kid messages against Claude (needs ANTHROPIC_API_KEY)
npx playwright install chromium       # once
npm run test:e2e                      # full flow against your Supabase project, with the mock model
```

## Deploy to app.candideai.com

Vercel project with **Root Directory = `platform`**, framework Next.js, region `fra1`. Environment variables: everything in `.env.example` except the mock flags, with `NEXT_PUBLIC_APP_URL=https://app.candideai.com` and `IMAGE_PROVIDER` set to the chosen provider. Add the domain `app.candideai.com` to the project and point its CNAME at Vercel.

## Operations

```bash
npm run ops end-stale               # close sessions older than three hours (pg_cron also does this)
npm run ops purge-transcripts       # delete unpinned messages older than 90 days
npm run ops moderation-report       # blocked messages per school and reason, last 7 days (--days N)
```

School admins can delete a session and everything under it from the School tab (or `DELETE /api/teacher/session/[id]`). Candide staff create schools with `npm run create-school`; there is no UI for it.
