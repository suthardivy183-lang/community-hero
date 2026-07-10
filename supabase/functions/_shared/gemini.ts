// Minimal Gemini REST helper for Edge Functions (Deno).
// The key is read from Edge Function secrets only.

// gemini-2.0-flash was shut down by Google on June 1, 2026.
const MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite']

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

  let lastError = 'Gemini returned no content'
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      lastError = `Gemini ${res.status}: ${detail.slice(0, 200)}`
      if (res.status === 429 || res.status === 503) continue
      throw new Error(lastError)
    }
    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (text) return JSON.parse(text)
    lastError = 'Gemini returned no content'
  }
  throw new Error(lastError)
}
