import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface IssueAssignment {
  issue_id: string
  officer_id: string
  assigned_by: string
  assigned_at: string
  officer: { full_name: string | null } | null
}

export function useIssueAssignments(issueIds: string[]) {
  const key = issueIds.slice().sort()
  return useQuery({
    enabled: key.length > 0,
    queryKey: ['issue-assignments', key],
    queryFn: async (): Promise<IssueAssignment[]> => {
      const { data, error } = await supabase.from('issue_assignments').select('*, officer:profiles!issue_assignments_officer_id_fkey(full_name)').in('issue_id', key)
      if (error) throw error
      return (data ?? []) as unknown as IssueAssignment[]
    },
  })
}

export function useDepartmentOfficers(departmentId: string | null | undefined) {
  return useQuery({
    enabled: !!departmentId,
    queryKey: ['department-officers', departmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role, department_id').eq('department_id', departmentId!).eq('role', 'authority').order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useAssignOfficer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ issueId, officerId }: { issueId: string; officerId: string }) => {
      const { error } = await supabase.rpc('assign_issue_officer', { p_issue_id: issueId, p_officer_id: officerId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-assignments'] })
      qc.invalidateQueries({ queryKey: ['status-history'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAppealIssueResolution(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const { error } = await supabase.rpc('appeal_issue_resolution', { p_issue_id: issueId, p_reason: reason })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', issueId] })
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['status-history', issueId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
