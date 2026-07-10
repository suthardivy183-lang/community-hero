import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type SlaPolicy = Database['public']['Tables']['sla_policies']['Row']

export function useSlaPolicies() {
  return useQuery({
    queryKey: ['sla-policies'],
    queryFn: async (): Promise<SlaPolicy[]> => {
      const { data, error } = await supabase.from('sla_policies').select('*').order('category_id', { nullsFirst: true })
      if (error) throw error
      return data
    },
  })
}

export function useSaveSlaPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (policy: Pick<SlaPolicy, 'id' | 'category_id' | 'level1_days' | 'level2_days'>) => {
      const { data, error } = await supabase
        .from('sla_policies')
        .upsert(policy, { onConflict: policy.category_id ? 'category_id' : 'id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  })
}
