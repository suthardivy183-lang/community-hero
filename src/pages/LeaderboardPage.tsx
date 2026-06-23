import { Trophy } from 'lucide-react'
import { useLeaderboard } from '@/features/community/queries'
import { useAuth } from '@/features/auth/AuthProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/layout/Header'
import { ROLE_LABELS } from '@/lib/issues'
import { cn } from '@/lib/utils'

const MEDAL = ['var(--color-accent)', 'oklch(75% 0.02 265)', 'oklch(60% 0.1 50)']

export function LeaderboardPage() {
  const { data: people, isLoading } = useLeaderboard()
  const { session } = useAuth()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg"><Trophy className="size-6" /></span>
        <div>
          <h1 className="font-display text-3xl font-semibold">Community Heroes</h1>
          <p className="text-sm text-muted">Top contributors keeping the city accountable.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {people?.map((p, i) => {
            const isMe = session?.user.id === p.id
            return (
              <Card key={p.id} className={cn('flex items-center gap-3 p-3', isMe && 'ring-2 ring-primary')}>
                <span className="w-7 text-center font-mono text-lg font-bold" style={{ color: i < 3 ? MEDAL[i] : 'var(--color-muted)' }}>
                  {i + 1}
                </span>
                <Avatar name={p.full_name} url={p.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.full_name ?? 'Citizen'} {isMe ? <span className="text-xs text-primary">(you)</span> : null}</p>
                  <p className="text-xs text-muted">{ROLE_LABELS[p.role]}</p>
                </div>
                <span className="font-mono text-lg font-bold text-primary">{p.points}<span className="ml-1 text-xs font-medium text-muted">pts</span></span>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
