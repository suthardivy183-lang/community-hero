import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssueStatus } from '@/lib/issues'

export interface MyGrievanceSummary {
  id: string
  title: string
  description: string
  category_name: string | null
  department_name: string | null
  status: IssueStatus
  created_at: string
  resolved_at: string | null
}

/** Security-definer RPC: the database, not a client filter, limits results to auth.uid(). */
export function useMyGrievanceSummaries(userId?: string) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['my-grievance-summaries', userId],
    queryFn: async (): Promise<MyGrievanceSummary[]> => {
      const { data, error } = await supabase.rpc('my_grievance_summaries')
      if (error) throw error
      return (data ?? []) as MyGrievanceSummary[]
    },
  })
}

export interface GrievanceMessage {
  id: string
  issue_id: string
  sender_id: string
  body: string
  message_type: string
  created_at: string
  sender: { full_name: string | null; role: string | null } | null
}

export async function insertGrievanceMessage(
  issueId: string,
  senderId: string,
  body: string,
  messageType: 'message' | 'information_request' = 'message',
) {
  const { error } = await supabase.from('grievance_messages').insert({ issue_id: issueId,
    sender_id: senderId,
    body,
    message_type: messageType,
  })
  if (error) throw error
}

export function useGrievanceMessages(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['grievance-messages', issueId],
    queryFn: async (): Promise<GrievanceMessage[]> => {
      if (!issueId) return []
      const { data, error } = await supabase
        .from('grievance_messages')
        .select('*, sender:profiles(full_name, role)')
        .eq('issue_id', issueId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as GrievanceMessage[]
    },
  })
}

export function useComplaintReference(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['complaint-reference', issueId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('my_complaint_reference', { p_issue_id: issueId! })
      if (error) throw error
      return data ?? null
    },
  })
}
