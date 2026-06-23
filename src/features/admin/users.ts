import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { UserRole } from '@/lib/issues'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role, departmentId }: { userId: string; role: UserRole; departmentId?: string | null }) => {
      const { error } = await supabase.rpc('set_user_role', {
        target: userId,
        new_role: role,
        dept: departmentId ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-profiles'] }),
  })
}
