import { STATUS_META, type IssueStatus } from '@/lib/issues'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: IssueStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  const color = `var(--color-${meta.tone})`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {meta.label}
    </span>
  )
}
