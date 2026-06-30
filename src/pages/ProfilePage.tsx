import { Award, Lock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBadges, useUserBadges } from '@/features/community/queries'
import { useIssues } from '@/features/issues/queries'
import { Card, CardBody } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/layout/Header'
import { TrustBadge } from '@/components/community/TrustBadge'
import { IssueCard } from '@/components/issue/IssueCard'
import { ROLE_LABELS } from '@/lib/issues'
import { cn } from '@/lib/utils'

export function ProfilePage() {
  const { session, profile } = useAuth()
  const { data: badges } = useBadges()
  const { data: owned } = useUserBadges(session?.user.id)
  const { data: myIssues, isLoading } = useIssues({ reporterId: session?.user.id })

  if (!profile) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>
  const ownedSet = new Set(owned ?? [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Identity */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={64} />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold">{profile.full_name ?? 'Citizen'}</h1>
            <p className="text-sm text-muted">{ROLE_LABELS[profile.role]}</p>
            <div className="mt-1.5"><TrustBadge score={profile.trust_score ?? 50} /></div>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold text-primary">{profile.points}</div>
            <div className="text-xs uppercase tracking-wide text-muted">impact points</div>
          </div>
        </CardBody>
      </Card>

      {/* Badges */}
      <h2 className="mb-3 mt-6 font-display text-lg font-semibold">Achievements</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges?.map((b) => {
          const earned = ownedSet.has(b.id)
          return (
            <Card key={b.id} className={cn('text-center', !earned && 'opacity-60')}>
              <CardBody className="flex flex-col items-center gap-1.5 p-4">
                <span className={cn('grid size-11 place-items-center rounded-full', earned ? 'bg-accent text-accent-fg' : 'bg-surface-sunk text-muted')}>
                  {earned ? <Award className="size-6" /> : <Lock className="size-5" />}
                </span>
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-muted">{b.description}</p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* My reports */}
      <h2 className="mb-3 mt-6 font-display text-lg font-semibold">My reports</h2>
      {isLoading ? (
        <div className="grid h-32 place-items-center"><Spinner /></div>
      ) : myIssues && myIssues.length > 0 ? (
        <div className="space-y-3">{myIssues.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
      ) : (
        <p className="text-sm text-muted">You haven't reported anything yet.</p>
      )}
    </div>
  )
}
