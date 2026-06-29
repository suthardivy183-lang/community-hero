import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Live-invalidate issue queries when rows change anywhere in the table. */
export function useRealtimeIssues() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('issues-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        qc.invalidateQueries({ queryKey: ['issues'] })
        qc.invalidateQueries({ queryKey: ['issues-bbox'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}
