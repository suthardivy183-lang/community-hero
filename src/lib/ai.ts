import { z } from 'zod'
import { supabase } from './supabase'

/**
 * Thin client over the Supabase Edge Functions that proxy Google Gemini.
 * The Gemini key lives only in Edge Function secrets — never in the browser.
 */

export const analysisSchema = z.object({
  categorySlug: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.number().int().min(1).max(10),
  departmentSlug: z.string().optional(),
  tags: z.array(z.string()).default([]),
})
export type IssueAnalysis = z.infer<typeof analysisSchema>

export const validationSchema = z.object({
  verdict: z.enum(['genuine', 'insufficient', 'unrelated']),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
})
export type FixValidation = z.infer<typeof validationSchema>

async function invoke<T>(fn: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw new Error(`AI service (${fn}) failed: ${error.message}`)
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`AI service (${fn}) returned an unexpected shape`)
  }
  return parsed.data
}

/** Analyze an issue photo → category, polished description, severity, routing. */
export function analyzeReport(input: {
  imageBase64: string
  mimeType: string
  hintCategorySlugs: string[]
}): Promise<IssueAnalysis> {
  return invoke('ai-analyze', input, analysisSchema)
}

/** Compare a before + after photo to confirm a genuine repair. */
export function validateFix(input: {
  beforeUrl: string
  afterUrl: string
  category: string
}): Promise<FixValidation> {
  return invoke('ai-validate', input, validationSchema)
}

/** Translate free text into a target language (en | hi | gu). */
export function translateText(input: { text: string; target: string }): Promise<{ text: string }> {
  return invoke('ai-translate', input, z.object({ text: z.string() }))
}

/** Natural-language summary of predicted maintenance hotspots. */
export function hotspotSummary(input: { clusters: unknown }): Promise<{ summary: string }> {
  return invoke('ai-hotspots', input, z.object({ summary: z.string() }))
}
