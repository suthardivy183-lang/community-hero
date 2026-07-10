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
  })
  if (error) throw error
  return path
}

export interface CreateIssueMedia {
  uploadBlob: Blob
  mimeType: string
  ext: string
  kind: 'photo' | 'video'
  posterBlob?: Blob
}

export interface CreateIssueInput {
  title: string
  description: string
  categoryId: string
  severity: number
  severityScore?: number | null
  severityFactors?: Record<string, number>
  nearHospital?: boolean
  nearSchool?: boolean
  roadClass?: string | null
  embedding?: number[]
  imageHash?: string
  lat: number
  lng: number
  address: string | null
  tags: string[]
  aiMeta: Record<string, unknown>
  media: CreateIssueMedia
  uploaderId: string
}

async function uploadBlob(blob: Blob, path: string, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from('issue-media').upload(path, blob, { contentType })
  if (error) throw error
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
        p_severity_score: input.severityScore ?? undefined,
        p_near_hospital: input.nearHospital ?? false,
        p_near_school: input.nearSchool ?? false,
        p_road_class: input.roadClass ?? undefined,
        p_severity_factors: (input.severityFactors ?? {}) as never,
      })
      if (error) throw error

      // Persist similarity vectors (embedding + perceptual hash) for dedup.
      if ((input.embedding && input.embedding.length) || input.imageHash) {
        await supabase.rpc('set_issue_vectors', {
          p_id: issueId,
          p_embedding: input.embedding && input.embedding.length ? input.embedding : undefined,
          p_image_hash: input.imageHash ?? undefined,
        })
      }

      const { media, uploaderId } = input
      const path = `${uploaderId}/${issueId}/original-${Date.now()}.${media.ext}`
      await uploadBlob(media.uploadBlob, path, media.mimeType)
      const { error: mediaErr } = await supabase.from('issue_media').insert({
        issue_id: issueId,
        uploader_id: uploaderId,
        kind: 'original',
        type: media.kind,
        storage_path: path,
        ai_analysis: input.aiMeta as never,
      })
      if (mediaErr) throw mediaErr

      // For video, also store the poster frame as a photo (thumbnail + AI fix validation).
      if (media.kind === 'video' && media.posterBlob) {
        const posterPath = `${uploaderId}/${issueId}/poster-${Date.now()}.jpg`
        await uploadBlob(media.posterBlob, posterPath, 'image/jpeg')
        await supabase.from('issue_media').insert({
          issue_id: issueId,
          uploader_id: uploaderId,
          kind: 'original',
          type: 'photo',
          storage_path: posterPath,
        })
      }
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

export function useSubmitFixFeedback(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, satisfied }: { userId: string; satisfied: boolean }) => {
      const { error } = await supabase.from('fix_feedback').insert({ issue_id: issueId, user_id: userId, satisfied })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fix-feedback', issueId] }),
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

export async function updateIssueStatus(issueId: string, status: IssueStatus): Promise<void> {
  const { error } = await supabase.from('issues').update({ status }).eq('id', issueId)
  if (error) throw error
}

export function useAssignDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ issueId, departmentId }: { issueId: string; departmentId: string | null }) => {
      const { error } = await supabase.from('issues').update({ department_id: departmentId }).eq('id', issueId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  })
}
