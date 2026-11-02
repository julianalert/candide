# Candide platform

The classroom app behind **app.candideai.com**: a teacher launches a 45-minute AI mission, every kid works in a guarded AI workspace, and the session ends with a shareable class gallery. The marketing site lives one folder up and deploys separately to candideai.com.

Stack: Next.js 15 (App Router), TypeScript, Tailwind v4 with the Sodobat design tokens, Supabase (Postgres, Auth, Storage), Anthropic SDK (Claude Sonnet for chat, Claude Haiku for moderation and prompt rewriting), Zod, Vitest, Playwright. Deployed on Vercel.

## Layout

```
app/                  routes: /join, /play, /g/[publicId], /login, /teacher/**, /api/play/**, /api/teacher/**
components/           teacher tabs, gallery, join form, kid workspace (studio, mission panel, board)
lib/                  missions (Zod + loader), ai (prompt assembly, Claude), moderation, image providers,
                      kid-session (signed cookie), caps, play (getParticipant), gallery, supabase clients
missions/*.json       the 10 missions. Edit JSON, run `npm run seed`. No code change needed.
ai/                   safety.md (fixed, always first), age-tier-8-11.md, moderation.md, image-rewrite.md
supabase/migrations/  0001 schema + RLS, 0002 functions, 0003 storage bucket, 0004 pg_cron jobs
scripts/              seed-missions, create-school, ops (end-stale, purge-transcripts, moderation-report)
tests/                Vitest: loader, codes, cookie, caps, prompt assembly, adversarial (live, gated)
e2e/                  Playwright: teacher starts → kid joins, chats, pins → gallery → end
```

## Set up a Supabase project

1. Create a project in the **EU (Frankfurt)** region. Note the project URL, anon key and service role key.
2. Run the four files in `supabase/migrations/` in order (SQL editor, or `supabase db push` if you use the CLI). `0004` schedules the auto-end and the 90-day transcript purge with pg_cron; if pg_cron is not available it prints a notice and you run `npm run ops end-stale` / `npm run ops purge-transcripts` from a scheduler instead.
3. Authentication → URL configuration: Site URL `https://app.candideai.com`, redirect URLs `https://app.candideai.com/auth/callback` and `http://localhost:3000/auth/callback`.
4. Authentication → Email templates: the invite and magic link templates should link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite` and `...&type=magiclink`. For pilots the built-in mailer is fine; add custom SMTP before more than a handful of schools.

## Run locally

```bash
cp .env.example .env.local   # fill in Supabase keys, ANTHROPIC_API_KEY, KID_COOKIE_SECRET
npm install
npm run seed                 # validates missions/*.json and loads them
npm run create-school -- --name "Pilot School" --country QA --admin-email you@example.com --admin-name "You"
npm run dev
```

The invite email signs you in at `/teacher`. Create a class, pick a mission, start it, then open `/join` in a private window with the class code.

Without an Anthropic key, set `AI_MOCK=1` (canned replies, keyword moderation) and `IMAGE_PROVIDER=mock` (a locally drawn placeholder PNG); the whole flow still works end to end.

## Image provider

`IMAGE_PROVIDER` selects the adapter in `lib/image.ts`:

- `openai` — gpt-image-1 with `moderation: auto`; set `IMAGE_API_BASE_URL=https://eu.api.openai.com/v1` for EU data residency.
- `google` — Imagen through the Gemini API with `personGeneration: dont_allow`, which refuses people outright.
- `mock` — no network, for development and tests.

The provider is still an open decision in the spec; both real adapters are ~40 lines and share one interface, so switching is an environment change.

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
