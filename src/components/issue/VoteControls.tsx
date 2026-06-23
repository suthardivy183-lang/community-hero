import { ArrowBigUp, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoteControlsProps {
  voteCount: number
  confirmCount: number
  voted: boolean
  confirmed: boolean
  onVote: () => void
  onConfirm: () => void
  size?: 'sm' | 'md'
}

/** Compact Reddit-style icon controls — no text labels, just icon + count. */
export function VoteControls({
  voteCount, confirmCount, voted, confirmed, onVote, onConfirm, size = 'md',
}: VoteControlsProps) {
  const pad = size === 'sm' ? 'h-8 px-2.5' : 'h-10 px-3.5'
  const icon = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onVote}
        title="Upvote priority"
        aria-pressed={voted}
        aria-label={`Upvote — ${voteCount}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all active:scale-95',
          pad,
          voted
            ? 'border-primary bg-primary text-primary-fg'
            : 'border-border-strong bg-surface text-ink-soft hover:border-primary hover:text-primary',
        )}
      >
        <ArrowBigUp className={cn(icon, voted && 'fill-current')} />
        <span className="font-mono tabular-nums">{voteCount}</span>
      </button>

      <button
        type="button"
        onClick={onConfirm}
        title="I've seen this too"
        aria-pressed={confirmed}
        aria-label={`I've seen this too — ${confirmCount}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all active:scale-95',
          pad,
          confirmed
            ? 'border-accent bg-accent text-accent-fg'
            : 'border-border-strong bg-surface text-ink-soft hover:border-accent hover:text-accent-fg',
        )}
      >
        <Eye className={icon} />
        <span className="font-mono tabular-nums">{confirmCount}</span>
      </button>
    </div>
  )
}
