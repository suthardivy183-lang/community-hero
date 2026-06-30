import { ShieldCheck } from 'lucide-react'
import { trustTier } from '@/lib/issues'
import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  score: number
  showScore?: boolean
  className?: string
}

/** Community trust tier badge: Bronze / Silver / Gold / Hero. */
export function TrustBadge({ score, showScore = true, className }: TrustBadgeProps) {
  const tier = trustTier(score)
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', className)}
      style={{ color: tier.color, backgroundColor: `color-mix(in oklch, ${tier.color} 16%, transparent)` }}
      title={`Trust score ${score}/100`}
    >
      <ShieldCheck className="size-3.5" />
      {tier.label}
      {showScore ? <span className="font-mono opacity-70">{score}</span> : null}
    </span>
  )
}
