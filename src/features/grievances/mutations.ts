import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { insertGrievanceMessage } from './queries'

export interface CreatePublicGrievanceInput {
  title: string
  description: string
  categoryId: string
  departmentId: string | null
  severity: number
  lat: number
  lng: number
  address: string | null
  language: string
  aiMeta?: Record<string, unknown>
}

export interface GrievanceLodgingResult {
  issue_id: string
  complaint_number: string
  referenceLabel: 'Complaint number' | 'Grievance ID'
}

export function useCreatePublicGrievance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePublicGrievanceInput) => {
      const { data, error } = await supabase.rpc('create_public_grievance', {
        p_title: input.title,
        p_description: input.description,
        p_category_id: input.categoryId,
        p_department_id: input.departmentId,
        p_severity: input.severity,
        p_lat: input.lat,
        p_lng: input.lng,
        p_address: input.address ?? undefined,
        p_language: input.language,
        p_ai_meta: (input.aiMeta ?? {}) as never,
      })
      if (!error) {
        const grievance = data?.[0]
        if (!grievance) throw new Error('The grievance service did not return a complaint reference.')
        return { ...grievance, referenceLabel: 'Complaint number' } as GrievanceLodgingResult
      }

      // Older deployments may not have the richer P0 intake RPC yet. Keep the
      // report flow functional through the established authenticated issue RPC.
      const canUseLegacyFallback = error.code === 'PGRST202' && error.hint?.includes('public.create_issue')
      if (!canUseLegacyFallback) throw error
      const { data: issueId, error: legacyError } = await supabase.rpc('create_issue', {
        p_title: input.title,
        p_description: input.description,
        p_category_id: input.categoryId,
        p_lat: input.lat,
        p_lng: input.lng,
        p_address: input.address ?? undefined,
        p_severity: input.severity,
        p_ai_meta: {
          ...(input.aiMeta ?? {}),
          departmentId: input.departmentId,
          language: input.language,
          intake: 'grievance-fallback',
        } as never,
      })
      if (legacyError) throw legacyError
      if (!issueId) throw new Error('The grievance service did not return an identifier.')
      return { issue_id: issueId, complaint_number: issueId, referenceLabel: 'Grievance ID' } as GrievanceLodgingResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useSendGrievanceMessage(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ senderId, body, messageType = 'message' }: { senderId: string; body: string; messageType?: 'message' | 'information_request' }) => {
      await insertGrievanceMessage(issueId, senderId, body, messageType)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grievance-messages', issueId] }),
  })
}
