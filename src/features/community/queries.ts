import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Badge = Database['public']['Tables']['badges']['Row']

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('points', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })
}

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    staleTime: Infinity,
    queryFn: async (): Promise<Badge[]> => {
      const { data, error } = await supabase.from('badges').select('*').order('threshold')
      if (error) throw error
      return data
    },
  })
}

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['user-badges', userId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId!)
      if (error) throw error
      return data.map((b) => b.badge_id)
    },
  })
}
