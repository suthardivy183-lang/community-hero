# CommunityHero: Jury Code Guide

Use this file as the starting point when presenting the code in VS Code. The application is organized around one clear flow: a citizen reports a local issue, the community confirms it, an authority resolves it with evidence, and citizens verify the outcome.

## Start here

| File | What to explain |
|---|---|
| `src/App.tsx` | The complete route map and role protection for citizen, authority, and super-admin areas. |
| `src/pages/LandingPage.tsx` | The product story and entry points for the demo. |
| `src/pages/ReportPage.tsx` | Photo/video/voice/manual reporting, location selection, AI assistance, and the complaint submission flow. |
| `src/pages/IssueDetailPage.tsx` | Public transparency: updates, support, status, priority, discussions, and re-verification. |
| `src/pages/DashboardPage.tsx` | Authority operations: triage, assignments, proof-based resolution, SLAs, routes, hotspots, and analytics. |

## Frontend structure

```text
pages/       Route-level screens and demo journeys
components/  Reusable visual building blocks, grouped by domain
features/    Supabase queries and mutations grouped by business capability
hooks/       Browser integrations: speech, geolocation, realtime
lib/         Shared domain logic: AI client, priority, maps, images, geocoding
```

Keep the explanation simple: pages compose the experience, components render reusable UI, features own data access, and `lib/` holds pure shared logic.

## Backend structure

```text
supabase/migrations/  Database schema, Row Level Security, triggers, audit and SLA rules
supabase/functions/   Server-side AI, notifications, scorecards and Open311 endpoints
```

The frontend never calls Gemini with a secret key. It calls Supabase Edge Functions, which keep AI credentials server-side. Database Row Level Security and role checks protect the workflow even if someone bypasses the user interface.

## Core demo narrative

1. A citizen opens `/report` or `/grievance` and submits a photo, voice note, or manual complaint with location.
2. Gemini can propose structured fields; the citizen can edit all AI output before submitting.
3. The issue is visible on `/map` and `/issue/:id`, where nearby residents can support or discuss it.
4. An authority uses `/dashboard` to prioritize, assign, and resolve it with repair evidence.
5. AI and residents re-check the closure; the timeline, audit data, notifications, SLA status, and Open311 export make the outcome accountable.

## Important files by capability

| Capability | Files |
|---|---|
| Authentication and roles | `src/features/auth/AuthProvider.tsx`, `src/features/auth/guards.tsx` |
| Reporting and AI drafting | `src/pages/ReportPage.tsx`, `src/lib/ai.ts`, `supabase/functions/ai-analyze/` |
| Voice and location | `src/components/report/VoiceComplaint.tsx`, `src/hooks/useSpeechRecognition.ts`, `src/components/map/LocationPicker.tsx` |
| Maps and duplicates | `src/components/map/IssueMap.tsx`, `src/features/issues/nearby.ts`, `src/features/issues/queries.ts` |
| Priority and triage | `src/lib/priority.ts`, `src/components/admin/TriageBoard.tsx`, `src/features/admin/assignments.ts` |
| Proof and verification | `src/components/admin/VerifyPanel.tsx`, `supabase/functions/ai-validate/` |
| Transparency and accountability | `src/pages/TransparencyPage.tsx`, `src/features/admin/audit.ts`, `supabase/functions/open311/` |

## One-sentence architecture summary

CommunityHero is a React PWA backed by Supabase, where citizen reporting, community support, authority triage, evidence-based closure, and AI-assisted verification are connected through role-protected, auditable workflows.
