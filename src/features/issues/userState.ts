import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface MyInteractions {
  votes: Set<string>
  confirmations: Set<string>
}

/** The current user's votes + confirmations, as id sets for quick lookup. */
export function useMyInteractions(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['my-interactions', userId],
    queryFn: async (): Promise<MyInteractions> => {
      const [votes, confirms] = await Promise.all([
        supabase.from('votes').select('issue_id').eq('user_id', userId!),
        supabase.from('confirmations').select('issue_id').eq('user_id', userId!),
      ])
      if (votes.error) throw votes.error
      if (confirms.error) throw confirms.error
      return {
        votes: new Set(votes.data.map((v) => v.issue_id)),
        confirmations: new Set(confirms.data.map((c) => c.issue_id)),
      }
    },
  })
}
