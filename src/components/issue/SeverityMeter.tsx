import { severityLabel, severityTone } from '@/lib/issues'
import { cn } from '@/lib/utils'

interface SeverityMeterProps {
  severity: number
  showLabel?: boolean
  className?: string
}

export function SeverityMeter({ severity, showLabel = true, className }: SeverityMeterProps) {
  const color = `var(--color-${severityTone(severity)})`
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full transition-colors"
            style={{
              height: `${6 + i * 1.4}px`,
              backgroundColor: i < severity ? color : 'var(--color-border-strong)',
            }}
          />
        ))}
      </div>
      {showLabel ? (
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {severity}/10 · {severityLabel(severity)}
        </span>
      ) : null}
    </div>
  )
}
