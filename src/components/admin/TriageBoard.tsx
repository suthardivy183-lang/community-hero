import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { NEXT_STATUSES, STATUS_META } from '@/lib/issues'
import { computePriority } from '@/lib/priority'
import { PriorityBadge } from '@/components/issue/PriorityBadge'
import { useChangeStatus } from '@/features/issues/mutations'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/issue/StatusBadge'
import { SeverityMeter } from '@/components/issue/SeverityMeter'
import { CategoryIcon } from '@/components/issue/CategoryIcon'
import { ResolveDialog } from './ResolveDialog'
import { timeAgo } from '@/lib/utils'

export function TriageBoard({ issues }: { issues: IssueView[] }) {
  // Sort by AI priority score (severity + community + context + age + emergency).
  const ordered = [...issues].sort((a, b) => computePriority(b).score - computePriority(a).score)
  return (
    <div className="space-y-2.5">
      {ordered.map((issue) => (
        <TriageRow key={issue.id} issue={issue} />
      ))}
      {ordered.length === 0 ? <p className="py-10 text-center text-sm text-muted">No issues in the queue.</p> : null}
    </div>
  )
}

function TriageRow({ issue }: { issue: IssueView }) {
  const change = useChangeStatus(issue.id as string)
  const [resolveOpen, setResolveOpen] = useState(false)
  const status = issue.status ?? 'reported'
  const nextOptions = NEXT_STATUSES[status] ?? []
  const canResolve = status === 'in_progress'

  return (
    <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary">
        <CategoryIcon icon={issue.category_icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/issue/${issue.id}`} className="line-clamp-1 font-semibold hover:text-primary">{issue.title}</Link>
          <Link to={`/issue/${issue.id}`}><ExternalLink className="size-3.5 text-muted" /></Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{issue.category_name}</span>
          <span>· {issue.department_name ?? 'Unassigned'}</span>
          <span>· {issue.created_at ? timeAgo(issue.created_at) : ''}</span>
          <SeverityMeter severity={issue.severity ?? 5} showLabel={false} />
        </div>
      </div>

      <PriorityBadge issue={issue} />
      <StatusBadge status={status} />

      <div className="flex items-center gap-2">
        {canResolve ? (
          <Button size="sm" onClick={() => setResolveOpen(true)}>
            <CheckCircle2 className="size-4" /> Resolve
          </Button>
        ) : nextOptions.length > 0 ? (
          <select
            value=""
            onChange={(e) => { if (e.target.value) change.mutate({ status: e.target.value as never }) }}
            className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="">Move to…</option>
            {nextOptions.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        ) : null}
      </div>

      <ResolveDialog issue={issue} open={resolveOpen} onOpenChange={setResolveOpen} />
    </Card>
  )
}
