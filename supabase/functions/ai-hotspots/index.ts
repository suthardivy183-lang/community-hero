import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

interface Cluster {
  area: string
  count: number
  topCategory: string
  avgSeverity: number
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: { clusters: Cluster[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const clusters = Array.isArray(body.clusters) ? body.clusters : []

  if (!hasGemini() || clusters.length === 0) {
    const top = clusters[0]
    return json({
      summary: top
        ? `${top.area} is the current hotspot with ${top.count} open reports (mostly ${top.topCategory}). Prioritise inspection there; recurring clusters suggest scheduling preventive maintenance before complaints spike. (Set GEMINI_API_KEY for richer AI insights.)`
        : 'Not enough data yet to predict maintenance hotspots.',
    })
  }

  const prompt = `You are a city maintenance analyst. Given clusters of civic issues, write a concise 3-4 sentence
predictive maintenance briefing: name the highest-risk areas, the dominant issue types, and recommend
proactive actions. Return STRICT JSON: { "summary": string }.
Clusters: ${JSON.stringify(clusters)}`

  try {
    const raw = await geminiJson([{ text: prompt }])
    return json({ summary: String(raw.summary ?? '').slice(0, 800) })
  } catch (err) {
    console.error('ai-hotspots fallback:', err)
    return json({ summary: 'Hotspot analysis is temporarily unavailable.' })
  }
})
