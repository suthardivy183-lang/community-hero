import { severityScoreLevel } from '@/lib/issues'
import { cn } from '@/lib/utils'

interface SeverityBadgeProps {
  score: number
  className?: string
}

/** 0–100 severity badge, e.g. "Severity 91 · Critical". */
export function SeverityBadge({ score, className }: SeverityBadgeProps) {
  const { label, tone } = severityScoreLevel(score)
  const color = `var(--color-${tone})`
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', className)}
      style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span className="font-mono font-bold">Severity {score}</span>
      <span className="opacity-50">·</span>
      {label}
    </span>
  )
}
