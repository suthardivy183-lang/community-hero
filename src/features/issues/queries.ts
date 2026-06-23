import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { IssueStatus, IssueView } from '@/lib/issues'

export type Category = Database['public']['Tables']['categories']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type IssueMedia = Database['public']['Tables']['issue_media']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type StatusEvent = Database['public']['Tables']['status_history']['Row']
export type Validation = Database['public']['Tables']['validations']['Row']

export interface IssueFilters {
  categoryId?: string | null
  status?: IssueStatus | null
  search?: string
  reporterId?: string
  departmentId?: string | null
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: Infinity,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    staleTime: Infinity,
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.from('departments').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useIssues(filters: IssueFilters = {}) {
  return useQuery({
    queryKey: ['issues', filters],
    queryFn: async (): Promise<IssueView[]> => {
      let q = supabase.from('issues_view').select('*').order('created_at', { ascending: false })
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.reporterId) q = q.eq('reporter_id', filters.reporterId)
      if (filters.departmentId) q = q.eq('department_id', filters.departmentId)
      if (filters.search) q = q.ilike('title', `%${filters.search}%`)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return data
    },
  })
}

export function useIssue(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['issue', id],
    queryFn: async (): Promise<IssueView> => {
      const { data, error } = await supabase.from('issues_view').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export function useIssueMedia(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['issue-media', issueId],
    queryFn: async (): Promise<IssueMedia[]> => {
      const { data, error } = await supabase
        .from('issue_media')
        .select('*')
        .eq('issue_id', issueId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useComments(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['comments', issueId],
    queryFn: async (): Promise<Array<Comment & { author: { full_name: string | null; avatar_url: string | null } | null }>> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(full_name, avatar_url)')
        .eq('issue_id', issueId!)
        .order('created_at')
      if (error) throw error
      return data as never
    },
  })
}

export function useStatusHistory(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['status-history', issueId],
    queryFn: async (): Promise<StatusEvent[]> => {
      const { data, error } = await supabase
        .from('status_history')
        .select('*')
        .eq('issue_id', issueId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useValidation(issueId: string | undefined) {
  return useQuery({
    enabled: !!issueId,
    queryKey: ['validation', issueId],
    queryFn: async (): Promise<Validation | null> => {
      const { data, error } = await supabase
        .from('validations')
        .select('*')
        .eq('issue_id', issueId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
