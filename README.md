# CommunityHero — Hyperlocal Problem Solver

> **Report. Verify. Resolve. Rebuild trust.**

CommunityHero is a deployed civic-tech platform that turns a citizen's photo, video, voice note, or manual complaint into a structured, geo-tagged issue that communities and authorities can track through to a verified resolution.

It is designed for potholes, water leaks, damaged streetlights, sanitation problems, unsafe infrastructure, and similar hyperlocal issues.

**Live app:** [asli-solution-challenge.web.app](https://asli-solution-challenge.web.app)

## Demo access

> These are **demo-environment credentials only**. Do not reuse this password in a production deployment. Rotate or remove the account before sharing a production repository publicly.

| Role | Email | Password | What it can do |
|---|---|---|---|
| Super admin | `aanya.hero@gmail.com` | `demo123456` | Manage users and roles, SLA policies, audit history, all authority operations, verification, and platform configuration |

## What the platform does

### Citizen reporting and community participation

- **AI-assisted or manual reporting** — after attaching a photo/video, citizens can either let AI suggest the title, category, description, severity, and department, or complete every field themselves.
- **Voice reporting** — English, Hindi, and Gujarati speech can help populate a report.
- **Geo-tagged live civic map** — map pins, heatmap, search, filters, clustering, browser geolocation, and a **Near me** recenter action.
- **Duplicate-aware reporting** — nearby, same-category complaints can be joined instead of repeatedly creating the same issue.
- **Issue transparency** — public timeline, category, location, severity, explainable priority, repair estimate, discussion, views, and community support.
- **Citizen ownership** — reporters can edit or withdraw their own report while it is still in the `reported` state.
- **Resolution re-verification** — residents other than the reporter can say whether a resolved issue is actually fixed; disputed fixes are visibly flagged.
- **Profile and recognition** — profile photo upload, caption, points, badges with progress, report history, and shareable impact cards.

### Authority workflow and accountability

- **Role-based workflow** — Citizens report; volunteers verify on the ground; authorities triage, assign, and resolve; super admins govern the platform.
- **Triage board** — priority-sorted queue, bulk status actions, department assignment, and resolution-with-proof flow.
- **Evidence-backed closure** — authorities attach repair evidence; AI checks before/after media; citizens can re-verify closure.
- **Explainable priority** — the score considers severity, community confirmation, reporter trust, nearby risk context, issue age, and emergency signals. It is not a black-box decision.
- **SLA policies and escalation** — configurable category/default thresholds drive hourly escalation for overdue issues.
- **Impact dashboard** — issue metrics, resolution trends, department performance, repair-budget rollups, route planning, CSV export, and Open311 feed.
- **Super admin controls** — user role management, SLA policy controls, latest audit log, and platform-wide monitoring.
- **Social intake** — staff can paste a public post from X, Facebook, WhatsApp, or another source and analyse it into a draft civic complaint; the mock feed is clearly labelled as demo data.

## Permissions at a glance

| Action | Citizen | Volunteer | Authority | Super admin |
|---|:---:|:---:|:---:|:---:|
| Create, support, comment on reports | Yes | Yes | Yes | Yes |
| Edit/withdraw own `reported` complaint | Yes | Yes | Yes | Yes |
| Verify an issue on the ground | No | Yes | Yes | Yes |
| Acknowledge, assign, reject, progress, or resolve issues | No | No | Yes | Yes |
| Configure SLA policies and roles; view audit logs | No | No | No | Yes |

Database triggers and Row Level Security enforce status/department rules; the UI is not the only access control.

## Status lifecycle

```text
reported → community_verified → acknowledged → in_progress
         → resolved (repair proof) → ai_validated → closed
```

Every status change is recorded in `status_history`. A reporter may only withdraw their own complaint from `reported` to `rejected`.

## AI: helpful, not autonomous

Google Gemini is used securely through Supabase Edge Functions for:

- analysing uploaded complaint media;
- generating/editing structured report suggestions;
- validating before/after repair evidence;
- identifying civic hotspots; and
- analysing manually pasted social posts.

AI output is always editable. The app has graceful manual/mock fallbacks, so reporting remains available if the AI provider is unavailable. Operational decisions remain role-controlled and human-reviewed.

## Technology

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query |
| Maps and location | Leaflet, OpenStreetMap, PostGIS, browser geolocation |
| Backend | Supabase PostgreSQL, Auth, Storage, Realtime, Row Level Security, Edge Functions |
| AI | Google Gemini via server-side Supabase Edge Functions |
| Analytics and visuals | Recharts, client-side CSV export, canvas impact-card generation |
| Deployment | Firebase Hosting |
| Mobile baseline | Web App Manifest and production service worker |

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never commit `.env.local`, Gemini keys, service-role keys, or a real production admin password.

### Supabase setup

1. Apply the migrations in `supabase/migrations`.
2. Deploy the Edge Functions in `supabase/functions`.
3. Add `GEMINI_API_KEY` as a Supabase Edge Function secret to enable real AI responses.
4. Configure the Auth site URL and allowed redirect URLs for the deployed app.
5. For a demo with email/password signup, disable email confirmation in Supabase Auth if appropriate for the environment.

## Edge Functions

| Function | Purpose |
|---|---|
| `ai-analyze` | Media → suggested category, title, description, severity, tags, department |
| `ai-validate` | Original + repair proof → genuine / insufficient / unrelated validation |
| `ai-hotspots` | Recurring issue clusters → maintenance insight |
| `ai-social` | Pasted social mention → analysed civic complaint draft |
| `notify-department` | Department/status notification workflow |
| `dept-scorecard` | Weekly department performance payload/email workflow |
| `open311` | Open311-compatible public issue feed |

## Project structure

```text
src/
├── components/   UI, reporting, map, issue, community, and admin components
├── features/     auth, issues, community, notification, and admin data workflows
├── hooks/        geolocation, realtime updates, and speech recognition
├── lib/          AI client, priority, repair estimates, maps, geocoding, i18n
└── pages/        landing, map, report, issue detail, profile, dashboard, admin, auth
supabase/
├── migrations/   schema, RLS, triggers, SLA, feedback, audit and status rules
└── functions/    server-side AI, notifications, scorecard and Open311 endpoints
```

## Demo talking points

1. A citizen uploads a pothole image and chooses AI-assisted or manual reporting.
2. The issue appears on the map, can be joined as a duplicate, and earns community confirmation.
3. An authority triages it by explainable priority and uploads repair proof.
4. AI and residents re-verify whether it was actually fixed.
5. SLA monitoring, audits, dashboards, and Open311 export make the process accountable end-to-end.
