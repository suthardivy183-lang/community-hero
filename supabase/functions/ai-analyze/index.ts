import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

interface Ctx {
  nearHospital?: boolean
  nearSchool?: boolean
  roadClass?: string
  traffic?: string
}
interface AnalyzeBody {
  imageBase64: string
  mimeType: string
  hintCategorySlugs: string[]
  context?: Ctx
}

const DEPT: Record<string, string> = {
  pothole: 'Roads & Infrastructure', road_damage: 'Roads & Infrastructure',
  manhole: 'Roads & Infrastructure', broken_footpath: 'Roads & Infrastructure',
  water_leak: 'Water Supply & Drainage', drainage: 'Water Supply & Drainage',
  streetlight: 'Electricity & Streetlights', power_hazard: 'Electricity & Streetlights',
  traffic_signal: 'Electricity & Streetlights',
  garbage: 'Sanitation & Waste', illegal_dumping: 'Sanitation & Waste',
  public_property: 'Parks & Public Spaces', tree: 'Parks & Public Spaces',
  other: 'General / Other',
}

function clampSeverity(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 5
  return Math.min(10, Math.max(1, v))
}

// Deterministic, explainable 0-100 score from base severity + real context.
function severityScore(sev: number, ctx?: Ctx): { score: number; factors: Record<string, number> } {
  let s = sev * 10
  const f: Record<string, number> = { base: s }
  if (ctx?.nearHospital) { s += 12; f.nearHospital = 12 }
  if (ctx?.nearSchool) { s += 8; f.nearSchool = 8 }
  const road = ctx?.roadClass ?? ''
  let rb = 0
  if (['motorway', 'trunk', 'primary'].includes(road)) rb = 12
  else if (['secondary', 'tertiary'].includes(road)) rb = 6
  if (rb) { s += rb; f.road = rb }
  return { score: Math.min(100, Math.max(0, Math.round(s))), factors: f }
}

function mock(hints: string[], ctx?: Ctx) {
  const slug = hints.includes('pothole') ? 'pothole' : hints[0] ?? 'other'
  const sev = 5
  const ss = severityScore(sev, ctx)
  return {
    categorySlug: slug,
    title: 'Reported civic issue needing attention',
    description:
      'A community issue was captured at this location. Add any details that help the responding department understand the scope and urgency. (AI auto-description is offline — set GEMINI_API_KEY to enable.)',
    severity: sev,
    severityScore: ss.score,
    severityFactors: ss.factors,
    confidence: 0.6,
    departmentSlug: slug,
    departmentName: DEPT[slug] ?? DEPT.other,
    tags: ['needs-review'],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: AnalyzeBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const hints = Array.isArray(body.hintCategorySlugs) ? body.hintCategorySlugs : []
  const ctx = body.context

  if (!hasGemini() || !body.imageBase64) {
    return json(mock(hints, ctx))
  }

  const prompt = `You are triaging a citizen-reported civic infrastructure issue from a photo.
Allowed category slugs: ${hints.join(', ')}.
Return STRICT JSON with keys:
- categorySlug: single best matching slug from the allowed list ("other" if none fit)
- title: concise 6-10 word title
- description: 2-3 sentence neutral, factual description a municipal department can act on
- severity: integer 1-10 by public-safety risk, scale and urgency visible in the image
- confidence: number 0..1 for how confident you are in the category
- tags: array of 2-4 short lowercase keyword tags`

  try {
    const raw = await geminiJson([
      { text: prompt },
      { inlineData: { mimeType: body.mimeType || 'image/jpeg', data: body.imageBase64 } },
    ])
    const allowed = new Set(hints)
    const slug = typeof raw.categorySlug === 'string' && allowed.has(raw.categorySlug) ? raw.categorySlug : 'other'
    const severity = clampSeverity(raw.severity)
    const ss = severityScore(severity, ctx)
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0.7))
    return json({
      categorySlug: slug,
      title: String(raw.title ?? 'Reported civic issue').slice(0, 120),
      description: String(raw.description ?? '').slice(0, 1000),
      severity,
      severityScore: ss.score,
      severityFactors: ss.factors,
      confidence,
      departmentSlug: slug,
      departmentName: DEPT[slug] ?? DEPT.other,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 4) : [],
    })
  } catch (err) {
    console.error('ai-analyze fallback:', err)
    return json(mock(hints, ctx))
  }
})
