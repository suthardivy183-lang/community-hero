# Community Hero — Demo Script

**Live:** https://communityhero-theta.vercel.app
**Demo super-admin:** `aanya.hero@gmail.com` / `demo123456`

> Works fully on mock AI. For *real* AI in the demo, set `GEMINI_API_KEY` in Supabase →
> Edge Functions → Secrets, and turn **Auth → Confirm email = off**.

## 90-second walkthrough (hits all 10 AI features)

1. **Landing → "Explore the live map"** — clustered pins + severity **heatmap**, realtime, viewport-loaded. *(geo + mapping)*
2. **Report an issue** (`+ Report`):
   - **Voice** *(F9)*: tap **Report by voice**, pick हिन्दी/ગુજરાતી/English, speak — transcript → form auto-fills.
   - Or **photo/video** *(F1)*: AI fills category, title, description, **confidence %**, **suggested department**.
   - **Severity 0–100** *(F3)* appears, scored from the image + **real nearby hospital/school/road** (OSM).
   - **Duplicate detection** *(F2)*: if a similar report exists → "Similar issue… 72% similar, 40 m away" → **Join** (bumps supporters) or **Create anyway**.
3. **Issue detail** — semantic **status timeline**, **AI priority** score with ✓ **explainable reasons** *(F10)*, **AI repair estimate** ₹/time/crew *(F5)*, reporter **trust badge** *(F4)*, upvote / "seen this".
4. **Switch to Authority dashboard** (you're super-admin):
   - **Triage** — sorted by **AI priority**; move status; **Resolve with proof** → **before/after AI validation** verdict.
   - **Impact** — counts, resolution rate, avg time, department performance (Recharts).
   - **Hotspots** — heatmap + **predicted maintenance needs with confidence %** *(F6)* + AI briefing.
   - **Route** *(F7)*: select several issues → **Optimise** → ordered stops + live **OSRM** travel time + completion ETA on a route map.
   - **Social** *(F8)*: AI-extracted civic mentions from a monitored feed → **Publish** a draft complaint (non-civic posts auto-filtered).
5. **Accountability loop** — escalation banner flags issues unresolved 3/7 days; citizen gets an **in-app notification** (bell) + **email** on status change; everything is exportable via the **Open311 API** (footer link).
6. **Inclusivity** — language switcher (EN / हिन्दी / ગુજરાતી) in the header.

## Talking points
- **AI everywhere, but degrades gracefully** — every AI call has a mock fallback, so the app never breaks on stage.
- **Real, free data** — OSM Overpass (context), OSRM (routing), Gemini (vision/text/embeddings), pgvector (similarity). No paid keys.
- **Transparency & accountability** — public status timeline, AI before/after proof, escalation, Open311 export.
- **Architecture** — React SPA on CDN + Supabase (Postgres/PostGIS/pgvector/Auth/Storage/Realtime/RLS/Edge). Key never leaves the server; RLS on every table.
