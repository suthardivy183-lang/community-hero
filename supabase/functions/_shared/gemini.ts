// Minimal Gemini REST helper for Edge Functions (Deno).
// The key is read from Edge Function secrets only.

const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function hasGemini(): boolean {
  return !!Deno.env.get('GEMINI_API_KEY')
}

interface Part {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

/** Calls Gemini and returns the parsed JSON object the model emits. */
export async function geminiJson(parts: Part[]): Promise<Record<string, unknown>> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`)
  }

  const data = await res.json()
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text)
}
