import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssueStatus } from '@/lib/issues'

export interface AuditEvent {
  id: string
  issue_id: string
  from_status: IssueStatus | null
  to_status: IssueStatus
  note: string | null
  created_at: string
  issue: { title: string | null; category_id: string | null; category: { name: string } | null } | null
  actor: { full_name: string | null } | null
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: async (): Promise<AuditEvent[]> => {
      const { data, error } = await supabase
        .from('status_history')
        .select('id, issue_id, from_status, to_status, note, created_at, issue:issues(title, category_id, category:categories(name)), actor:profiles!status_history_actor_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as AuditEvent[]
    },
  })
}
