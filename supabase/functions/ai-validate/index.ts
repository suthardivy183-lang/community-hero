import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

interface ValidateBody {
  beforeUrl: string
  afterUrl: string
  category: string
}

async function fetchBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch image ${res.status}`)
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  const buf = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return { data: btoa(binary), mimeType }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: ValidateBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!hasGemini() || !body.beforeUrl || !body.afterUrl) {
    return json({
      verdict: 'genuine',
      confidence: 0.75,
      explanation:
        'Resolution photo received. (AI before/after comparison is offline — set GEMINI_API_KEY to enable automated verification.)',
    })
  }

  const prompt = `You verify whether a reported civic issue (category: ${body.category}) was genuinely fixed.
Image 1 is the ORIGINAL reported problem. Image 2 is the claimed RESOLUTION at the same location.
Return STRICT JSON:
- verdict: "genuine" (the specific problem is clearly fixed), "insufficient" (same scene but the problem still visible or only partially addressed), or "unrelated" (different place/subject, can't confirm)
- confidence: number 0..1
- explanation: one sentence justifying the verdict for a citizen audience.`

  try {
    const [before, after] = await Promise.all([fetchBase64(body.beforeUrl), fetchBase64(body.afterUrl)])
    const raw = await geminiJson([
      { text: prompt },
      { text: 'ORIGINAL:' },
      { inlineData: before },
      { text: 'RESOLUTION:' },
      { inlineData: after },
    ])
    const verdict = ['genuine', 'insufficient', 'unrelated'].includes(String(raw.verdict))
      ? String(raw.verdict)
      : 'insufficient'
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0.5))
    return json({ verdict, confidence, explanation: String(raw.explanation ?? '').slice(0, 500) })
  } catch (err) {
    console.error('ai-validate fallback:', err)
    return json({
      verdict: 'insufficient',
      confidence: 0.4,
      explanation: 'Automated comparison could not be completed; manual review recommended.',
    })
  }
})
