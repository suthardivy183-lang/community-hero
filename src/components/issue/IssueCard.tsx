import { Link } from 'react-router-dom'
import { ArrowBigUp, Eye, MessageSquare, MapPin } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from './StatusBadge'
import { SeverityMeter } from './SeverityMeter'
import { CategoryIcon } from './CategoryIcon'
import { timeAgo } from '@/lib/utils'

export function IssueCard({ issue }: { issue: IssueView }) {
  return (
    <Card interactive className="overflow-hidden">
      <Link to={`/issue/${issue.id}`} className="block p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary">
            <CategoryIcon icon={issue.category_icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 font-display text-base font-semibold leading-snug">{issue.title}</h3>
              <StatusBadge status={issue.status ?? 'reported'} />
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{issue.description}</p>

            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{issue.address ?? `${issue.category_name}`}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <SeverityMeter severity={issue.severity ?? 5} />
              <div className="flex items-center gap-3 text-xs font-medium text-muted">
                <span className="inline-flex items-center gap-1"><ArrowBigUp className="size-4" />{issue.vote_count}</span>
                <span className="inline-flex items-center gap-1"><Eye className="size-4" />{issue.confirm_count}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="size-4" />{issue.comment_count}</span>
                <span>· {issue.created_at ? timeAgo(issue.created_at) : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  )
}
