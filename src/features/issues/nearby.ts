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

export interface SimilarIssue extends NearbyIssue {
  similarity: number
}

interface SimilarParams {
  coords: { lat: number; lng: number } | null
  categoryId: string | null
  embedding?: number[]
  imageHash?: string
  radiusM?: number
}

/** AI duplicate detection: geo + text-embedding + image/category similarity. */
export function useSimilarIssues({ coords, categoryId, embedding, imageHash, radiusM = 150 }: SimilarParams) {
  const sig = embedding && embedding.length ? embedding.slice(0, 3).join(',') : 'none'
  return useQuery({
    enabled: !!coords && !!categoryId,
    queryKey: ['similar', coords?.lat?.toFixed(4), coords?.lng?.toFixed(4), categoryId, imageHash ?? null, sig],
    queryFn: async (): Promise<SimilarIssue[]> => {
      const { data, error } = await supabase.rpc('similar_issues', {
        p_lat: coords!.lat,
        p_lng: coords!.lng,
        p_category: categoryId ?? undefined,
        p_embedding: embedding && embedding.length ? embedding : undefined,
        p_image_hash: imageHash ?? undefined,
        p_radius_m: radiusM,
      })
      if (error) throw error
      return (data ?? []) as SimilarIssue[]
    },
  })
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
