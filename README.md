# Community Hero — Hyperlocal Problem Solver

Citizens **report → verify → track → resolve** local civic issues (potholes, water leaks,
broken streetlights, garbage, infrastructure) with AI assistance, transparency, and
accountability.

Built for the *Community Hero* hackathon. Demonstrates how AI helps communities address
local challenges through smarter reporting, verification, tracking and resolution.

## Highlights

- **AI photo triage** — snap a photo → Gemini auto-categorises it, writes a polished
  description, scores severity (1–10), and routes it to the right department.
- **Before/after AI validation** — when an authority uploads a resolution photo, AI compares
  it with the original to confirm the fix is *genuine* (the accountability headline feature).
- **"I've seen this too" de-duplication** — nearby same-category reports are detected via
  PostGIS so neighbours confirm an existing issue instead of spamming duplicates.
- **Live civic map** — clustered Leaflet/OpenStreetMap pins + severity heatmap, realtime updates.
- **Predictive hotspots** — recurring problem zones clustered and summarised by AI for
  proactive maintenance.
- **Escalation** — issues unresolved past 3 / 7 days auto-escalate (hourly `pg_cron`).
- **Gamification** — impact points, achievement badges, community leaderboard.
- **Roles** — Citizen, Authority (department triage + impact dashboard), Volunteer verifier,
  Super admin (role management).
- **Multilingual** — English / हिन्दी / ગુજરાતી with a live switcher.

## Stack

React + Vite + TypeScript · Tailwind v4 (custom *civic-trust* design system) · TanStack Query ·
React Leaflet + leaflet.heat · Recharts · react-i18next · **Supabase** (Postgres + PostGIS +
Auth + Storage + Realtime + RLS + Edge Functions) · **Google Gemini 2.0 Flash** (via Edge
Functions — the key never reaches the browser).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

The database schema, RLS, and Edge Functions are already provisioned on the linked Supabase
project (see `supabase/migrations` and `supabase/functions`).

## Required manual setup (Supabase dashboard)

1. **Disable email confirmation** — Authentication → Sign In / Providers → Email → turn off
   "Confirm email", so new signups can log in immediately for the demo.
2. **Enable real AI** — Edge Functions → Secrets → add `GEMINI_API_KEY`. Without it, the
   `ai-analyze`, `ai-validate`, and `ai-hotspots` functions return safe **mock** responses so
   the app still works end-to-end.
3. *(Optional)* **Google sign-in** — Authentication → Providers → enable Google with OAuth
   credentials.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `ai-analyze` | Photo → category, title, description, severity, tags |
| `ai-validate` | Before/after photo comparison → genuine / insufficient / unrelated + confidence |
| `ai-hotspots` | Natural-language predictive maintenance briefing from issue clusters |

All degrade gracefully to deterministic mocks when `GEMINI_API_KEY` is unset.

## Project structure

```
src/
├── components/   ui primitives, layout, map, issue, admin
├── features/     auth, issues, community, admin (queries + mutations)
├── hooks/        geolocation, realtime
├── lib/          supabase client, ai client, i18n, image, geocode, design types
└── pages/        Home, Report, IssueDetail, Dashboard, Leaderboard, Profile, SuperAdmin, Auth
supabase/
├── migrations/   schema, RLS, RPCs, triggers, escalation, seed
└── functions/    ai-analyze, ai-validate, ai-hotspots
```

## Status flow

`reported → community_verified → acknowledged → in_progress → resolved → ai_validated → closed`
(every transition is recorded in `status_history` for a transparent public timeline).
