import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface EscalatedIssue {
  issueId: string
  title: string
  status: string
  level: number
  reason: string | null
  triggeredAt: string
}

/** Latest escalation per still-open issue, highest level first. */
export function useEscalations() {
  return useQuery({
    queryKey: ['escalations'],
    queryFn: async (): Promise<EscalatedIssue[]> => {
      const { data, error } = await supabase
        .from('escalations')
        .select('issue_id, level, reason, triggered_at, issue:issues(title, status)')
        .order('triggered_at', { ascending: false })
      if (error) throw error
      const seen = new Set<string>()
      const out: EscalatedIssue[] = []
      for (const row of data as never[]) {
        const r = row as {
          issue_id: string
          level: number
          reason: string | null
          triggered_at: string
          issue: { title: string; status: string } | null
        }
        if (seen.has(r.issue_id)) continue
        if (r.issue && ['resolved', 'ai_validated', 'closed', 'rejected'].includes(r.issue.status)) continue
        seen.add(r.issue_id)
        out.push({
          issueId: r.issue_id,
          title: r.issue?.title ?? 'Issue',
          status: r.issue?.status ?? 'reported',
          level: r.level,
          reason: r.reason,
          triggeredAt: r.triggered_at,
        })
      }
      return out.sort((a, b) => b.level - a.level)
    },
  })
}

export function useTriggerEscalations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('trigger_escalations')
      if (error) throw error
      return data ?? 0
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalations'] }),
  })
}
