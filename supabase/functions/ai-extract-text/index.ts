import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

interface ExtractBody {
  text: string
  hintCategorySlugs: string[]
}

const DEPARTMENTS: Record<string, string> = {
  pothole: 'Roads & Infrastructure', road_damage: 'Roads & Infrastructure', manhole: 'Roads & Infrastructure',
  water_leak: 'Water Supply & Drainage', drainage: 'Water Supply & Drainage', streetlight: 'Electricity & Streetlights',
  garbage: 'Sanitation & Waste', public_property: 'Parks & Public Spaces', tree: 'Parks & Public Spaces',
  'health-service-grievance': 'Health Services', 'education-service-grievance': 'Education Services',
  'public-transport-grievance': 'Public Transport', 'electricity-service-grievance': 'Electricity Services',
  'revenue-certificate-grievance': 'Revenue and Certificates', 'social-welfare-grievance': 'Social Welfare',
  'public-safety-grievance': 'Public Safety', other: 'General grievance cell',
}

function fallback(text: string, hints: string[]) {
  const slug = hints[0] ?? 'other'
  const clean = text.trim()
  return {
    categorySlug: slug,
    title: clean.slice(0, 90) || 'Citizen grievance',
    description: clean || 'The citizen needs to provide more details for this grievance.',
    severity: 5,
    confidence: 0.5,
    departmentSlug: slug,
    departmentName: DEPARTMENTS[slug] ?? DEPARTMENTS.other,
    tags: ['needs-review'],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let body: ExtractBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const hints = Array.isArray(body.hintCategorySlugs) ? body.hintCategorySlugs : []
  if (!text) return json({ error: 'A grievance description is required' }, 400)
  if (!hasGemini()) return json(fallback(text, hints))

  const prompt = `You are an Indian public-service grievance intake assistant. The citizen may write in English, Hindi, Gujarati, or mixed language.
Allowed category slugs: ${hints.join(', ')}.
Citizen's message: ${text}
Return STRICT JSON with categorySlug (one allowed slug; use other only if allowed), title (under 100 chars), description (clear factual English, 2-3 sentences), severity (integer 1-10), confidence (0..1), and tags (2-4 lowercase strings). Do not invent facts.`
  try {
    const raw = await geminiJson([{ text: prompt }])
    const allowed = new Set(hints)
    const categorySlug = typeof raw.categorySlug === 'string' && allowed.has(raw.categorySlug) ? raw.categorySlug : (hints[0] ?? 'other')
    const severity = Math.min(10, Math.max(1, Math.round(Number(raw.severity) || 5)))
    return json({
      categorySlug,
      title: String(raw.title ?? text).slice(0, 120),
      description: String(raw.description ?? text).slice(0, 1500),
      severity,
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.7)),
      departmentSlug: categorySlug,
      departmentName: DEPARTMENTS[categorySlug] ?? DEPARTMENTS.other,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 4) : [],
    })
  } catch (error) {
    console.error('ai-extract-text fallback:', error)
    return json(fallback(text, hints))
  }
})
