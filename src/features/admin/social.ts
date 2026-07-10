import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { geocodeSearch } from '@/lib/geocode'
import { DEFAULT_CENTER } from '@/hooks/useGeolocation'

export interface SocialPost {
  id: string
  source: string
  author: string
  text: string
  time: string
}

export interface SocialMention extends SocialPost {
  categorySlug: string
  issueType: string
  location: string
  confidence: number
  summary: string
}

// Demo feed standing in for a live social-listening stream (X/Facebook/etc.).
export const MOCK_FEED: SocialPost[] = [
  { id: 's1', source: 'X', author: '@vadodara_cmmtr', text: 'Huge pothole near Alkapuri circle, two bikes almost fell today. @municipality please fix!', time: '2h' },
  { id: 's2', source: 'X', author: '@citizen_vdr', text: 'Garbage piling up at Sayajigunj market corner for 3 days, terrible smell.', time: '5h' },
  { id: 's3', source: 'Facebook', author: 'Manjalpur Residents', text: 'Street light not working on the lane near Manjalpur school, very unsafe at night.', time: '8h' },
  { id: 's4', source: 'X', author: '@gujju_road', text: 'Water pipeline leaking at Gotri road since morning, lots of water wasted.', time: '1d' },
  { id: 's5', source: 'X', author: '@foodie_vdr', text: 'Best dhokla in town at this new cafe!', time: '1d' },
]

/** Run each monitored post through AI extraction (mock-safe). */
export function useSocialMentions(categorySlugs: string[]) {
  return useQuery({
    queryKey: ['social-mentions', categorySlugs.length],
    queryFn: async (): Promise<SocialMention[]> => {
      const results = await Promise.all(
        MOCK_FEED.map(async (post) => {
          const { data } = await supabase.functions.invoke('ai-social', {
            body: { text: post.text, hintCategorySlugs: categorySlugs },
          })
          const d = (data ?? {}) as Partial<SocialMention>
          return {
            ...post,
            categorySlug: d.categorySlug ?? 'other',
            issueType: d.issueType ?? 'unknown',
            location: d.location ?? '',
            confidence: d.confidence ?? 0,
            summary: d.summary ?? post.text,
          }
        }),
      )
      // Only surface posts AI is reasonably sure are civic issues.
      return results.filter((m) => m.categorySlug !== 'other' && m.confidence >= 0.4)
    },
  })
}

/** Analyse a manually pasted social post through the same AI extractor. */
export function useAnalyseSocialPost() {
  return useMutation({
    mutationFn: async ({ text, source, categorySlugs }: { text: string; source: string; categorySlugs: string[] }): Promise<SocialMention> => {
      const { data, error } = await supabase.functions.invoke('ai-social', {
        body: { text, source, hintCategorySlugs: categorySlugs },
      })
      if (error) throw error
      const result = (data ?? {}) as Partial<SocialMention>
      return {
        id: `manual-${crypto.randomUUID()}`,
        source,
        author: 'Manual intake',
        text,
        time: 'just now',
        categorySlug: result.categorySlug ?? 'other',
        issueType: result.issueType ?? 'unknown',
        location: result.location ?? '',
        confidence: result.confidence ?? 0,
        summary: result.summary ?? text,
      }
    },
  })
}

/** Publish a reviewed mention as a draft complaint (officer-created). */
export function usePublishMention() {
  return useMutation({
    mutationFn: async ({ mention, categoryId }: { mention: SocialMention; categoryId: string }): Promise<string> => {
      const coords = (mention.location && (await geocodeSearch(`${mention.location}, Vadodara`))) || DEFAULT_CENTER
      const { data, error } = await supabase.rpc('create_issue', {
        p_title: mention.summary.slice(0, 80),
        p_description: `${mention.text}\n\n— sourced from ${mention.source} (${mention.author})`,
        p_category_id: categoryId,
        p_severity: 5,
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_address: mention.location || 'From social media',
        p_tags: ['social', mention.source.toLowerCase()],
        p_ai_meta: { source: 'social', author: mention.author, confidence: mention.confidence } as never,
      })
      if (error) throw error
      return data as string
    },
  })
}
