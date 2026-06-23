import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

interface AnalyzeBody {
  imageBase64: string
  mimeType: string
  hintCategorySlugs: string[]
}

interface Analysis {
  categorySlug: string
  title: string
  description: string
  severity: number
  departmentSlug?: string
  tags: string[]
}

function clampSeverity(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 5
  return Math.min(10, Math.max(1, v))
}

// Deterministic fallback so the product still demos without a Gemini key/quota.
function mockAnalysis(hints: string[]): Analysis {
  const slug = hints.includes('pothole') ? 'pothole' : hints[0] ?? 'other'
  return {
    categorySlug: slug,
    title: 'Reported civic issue needing attention',
    description:
      'A community issue was captured at this location. Add any details that help the responding department understand the scope and urgency. (AI auto-description is offline — set GEMINI_API_KEY to enable.)',
    severity: 5,
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

  if (!hasGemini() || !body.imageBase64) {
    return json(mockAnalysis(hints))
  }

  const prompt = `You are triaging a citizen-reported civic infrastructure issue from a photo.
Allowed category slugs: ${hints.join(', ')}.
Return STRICT JSON with keys:
- categorySlug: the single best matching slug from the allowed list (use "other" if none fit)
- title: a concise 6-10 word title
- description: 2-3 sentence neutral, factual description a municipal department can act on
- severity: integer 1-10 (1 cosmetic, 10 immediate public-safety danger)
- tags: array of 2-4 short lowercase keyword tags
Judge severity by public-safety risk, scale, and urgency visible in the image.`

  try {
    const raw = await geminiJson([
      { text: prompt },
      { inlineData: { mimeType: body.mimeType || 'image/jpeg', data: body.imageBase64 } },
    ])
    const allowed = new Set(hints)
    const slug = typeof raw.categorySlug === 'string' && allowed.has(raw.categorySlug)
      ? raw.categorySlug
      : 'other'
    const result: Analysis = {
      categorySlug: slug,
      title: String(raw.title ?? 'Reported civic issue').slice(0, 120),
      description: String(raw.description ?? '').slice(0, 1000),
      severity: clampSeverity(raw.severity),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 4) : [],
    }
    return json(result)
  } catch (err) {
    // Never break the report flow — degrade to mock.
    console.error('ai-analyze fallback:', err)
    return json(mockAnalysis(hints))
  }
})
