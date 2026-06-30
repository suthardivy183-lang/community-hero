import { Gauge } from 'lucide-react'
import { computePriority } from '@/lib/priority'
import type { IssueView } from '@/lib/issues'
import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  issue: IssueView
  showReasons?: boolean
  className?: string
}

/** AI priority score + (optionally) the human-readable reasoning. */
export function PriorityBadge({ issue, showReasons, className }: PriorityBadgeProps) {
  const { score, level, tone, reasons } = computePriority(issue)
  const color = `var(--color-${tone})`
  return (
    <div className={className}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
      >
        <Gauge className="size-3.5" />
        <span className="font-mono font-bold">Priority {score}</span>
        <span className="opacity-50">·</span>
        {level}
      </span>
      {showReasons ? (
        <ul className="mt-2 space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className={cn('text-sm text-ink-soft')}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
