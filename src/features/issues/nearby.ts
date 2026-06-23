import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface NearbyIssue {
  id: string
  title: string
  status: string
  category_id: string | null
  confirm_count: number
  vote_count: number
  distance_m: number
  created_at: string
}

/** Find existing issues near a point to offer "I've seen this too" instead of a duplicate. */
export function useNearbyIssues(
  coords: { lat: number; lng: number } | null,
  categoryId: string | null,
  radiusM = 80,
) {
  return useQuery({
    enabled: !!coords && !!categoryId,
    queryKey: ['nearby', coords?.lat, coords?.lng, categoryId, radiusM],
    queryFn: async (): Promise<NearbyIssue[]> => {
      const { data, error } = await supabase.rpc('nearby_issues', {
        p_lat: coords!.lat,
        p_lng: coords!.lng,
        p_radius_m: radiusM,
        p_category_id: categoryId ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as NearbyIssue[]
    },
  })
}
