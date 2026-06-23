import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { IssueStatus } from '@/lib/issues'

type MediaKind = Database['public']['Enums']['media_kind']

/** Upload a processed photo blob to the issue-media bucket; returns the storage path. */
export async function uploadIssuePhoto(
  blob: Blob,
  userId: string,
  issueId: string,
  kind: MediaKind,
): Promise<string> {
  const path = `${userId}/${issueId}/${kind}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('issue-media').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
  return path
}

export interface CreateIssueInput {
  title: string
  description: string
  categoryId: string
  severity: number
  lat: number
  lng: number
  address: string | null
  tags: string[]
  aiMeta: Record<string, unknown>
  blob: Blob
  uploaderId: string
}

export function useCreateIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateIssueInput): Promise<string> => {
      const { data: issueId, error } = await supabase.rpc('create_issue', {
        p_title: input.title,
        p_description: input.description,
        p_category_id: input.categoryId,
        p_severity: input.severity,
        p_lat: input.lat,
        p_lng: input.lng,
        p_address: input.address ?? undefined,
        p_tags: input.tags,
        p_ai_meta: input.aiMeta as never,
      })
      if (error) throw error

      const path = await uploadIssuePhoto(input.blob, input.uploaderId, issueId, 'original')
      const { error: mediaErr } = await supabase.from('issue_media').insert({
        issue_id: issueId,
        uploader_id: input.uploaderId,
        kind: 'original',
        type: 'photo',
        storage_path: path,
        ai_analysis: input.aiMeta as never,
      })
      if (mediaErr) throw mediaErr
      return issueId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}

export function useToggleVote(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase.from('votes').delete().eq('issue_id', issueId).eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('votes').insert({ issue_id: issueId, user_id: userId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', issueId] })
      qc.invalidateQueries({ queryKey: ['my-interactions'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}

export function useToggleConfirm(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      if (active) {
        const { error } = await supabase
          .from('confirmations')
          .delete()
          .eq('issue_id', issueId)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('confirmations').insert({ issue_id: issueId, user_id: userId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', issueId] })
      qc.invalidateQueries({ queryKey: ['my-interactions'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}

export function useAddComment(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, body }: { userId: string; body: string }) => {
      const { error } = await supabase.from('comments').insert({ issue_id: issueId, user_id: userId, body })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', issueId] })
      qc.invalidateQueries({ queryKey: ['issue', issueId] })
    },
  })
}

export function useChangeStatus(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ status }: { status: IssueStatus }) => {
      const { error } = await supabase.from('issues').update({ status }).eq('id', issueId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', issueId] })
      qc.invalidateQueries({ queryKey: ['status-history', issueId] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}
