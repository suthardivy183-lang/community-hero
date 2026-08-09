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
      if (error) throw error
      const grievance = data?.[0]
      if (!grievance) throw new Error('The grievance service did not return a complaint reference.')
      return grievance
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
