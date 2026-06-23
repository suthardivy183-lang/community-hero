import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, mediaUrl } from '@/lib/supabase'
import { uploadIssuePhoto } from '@/features/issues/mutations'
import { validateFix } from '@/lib/ai'

export interface ResolveInput {
  issueId: string
  category: string
  beforeUrl: string | null
  beforeMediaId: string | null
  blob: Blob
  validatorId: string
}

export interface ResolveResult {
  verdict: 'genuine' | 'insufficient' | 'unrelated'
  confidence: number
  explanation: string
}

/**
 * Resolve an issue with photographic proof, then run AI before/after validation.
 * Genuine fixes auto-advance to 'ai_validated'; others stay 'resolved' for review.
 */
export function useResolveWithProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ResolveInput): Promise<ResolveResult> => {
      const path = await uploadIssuePhoto(input.blob, input.validatorId, input.issueId, 'resolution')
      const { data: media, error: mediaErr } = await supabase
        .from('issue_media')
        .insert({ issue_id: input.issueId, uploader_id: input.validatorId, kind: 'resolution', type: 'photo', storage_path: path })
        .select('id')
        .single()
      if (mediaErr) throw mediaErr

      const afterUrl = mediaUrl(path)
      const result = await validateFix({
        beforeUrl: input.beforeUrl ?? afterUrl,
        afterUrl,
        category: input.category,
      })

      const { error: valErr } = await supabase.from('validations').insert({
        issue_id: input.issueId,
        before_media_id: input.beforeMediaId,
        after_media_id: media.id,
        verdict: result.verdict,
        confidence: result.confidence,
        explanation: result.explanation,
        validator_id: input.validatorId,
      })
      if (valErr) throw valErr

      // Mark resolved, then validated if AI confirms a genuine fix.
      const { error: s1 } = await supabase.from('issues').update({ status: 'resolved' }).eq('id', input.issueId)
      if (s1) throw s1
      if (result.verdict === 'genuine') {
        const { error: s2 } = await supabase.from('issues').update({ status: 'ai_validated' }).eq('id', input.issueId)
        if (s2) throw s2
      }
      return result
    },
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ['issue', input.issueId] })
      qc.invalidateQueries({ queryKey: ['validation', input.issueId] })
      qc.invalidateQueries({ queryKey: ['issue-media', input.issueId] })
      qc.invalidateQueries({ queryKey: ['status-history', input.issueId] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}
