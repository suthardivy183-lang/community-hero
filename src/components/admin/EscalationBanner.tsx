import { Link } from 'react-router-dom'
import { AlertTriangle, Siren } from 'lucide-react'
import { useEscalations, useTriggerEscalations } from '@/features/admin/escalations'
import { Button } from '@/components/ui/Button'

export function EscalationBanner() {
  const { data: escalations } = useEscalations()
  const trigger = useTriggerEscalations()
  const list = escalations ?? []

  return (
    <div className="mb-5 rounded-[var(--radius-card)] border border-status-escalated/30 bg-status-escalated/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-status-escalated">
          <Siren className="size-5" />
          {list.length > 0 ? `${list.length} issue${list.length > 1 ? 's' : ''} escalated for slow response` : 'No active escalations'}
        </div>
        <Button size="sm" variant="outline" onClick={() => trigger.mutate()} loading={trigger.isPending}>
          <AlertTriangle className="size-4" /> Run escalation check
        </Button>
      </div>
      {list.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {list.slice(0, 5).map((e) => (
            <Link
              key={e.issueId}
              to={`/issue/${e.issueId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-status-escalated/30 bg-surface px-2.5 py-1 text-xs font-medium hover:border-status-escalated"
            >
              <span className="rounded bg-status-escalated/15 px-1.5 font-mono font-bold text-status-escalated">L{e.level}</span>
              <span className="line-clamp-1 max-w-48">{e.title}</span>
              <span className="text-muted">· {e.reason}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
