import { useState } from 'react'
import { Award, Lock, MapPin } from 'lucide-react'
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
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'

export function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const { data: badges } = useBadges()
  const { data: owned } = useUserBadges(session?.user.id)
  const { data: myIssues, isLoading } = useIssues({ reporterId: session?.user.id ?? '__public-demo__' })

  const displayProfile = profile ?? {
    full_name: 'Vadodara Citizen',
    avatar_url: null,
    role: 'citizen' as const,
    trust_score: 68,
    points: 120,
  }
  const demoReport = !profile ? readDemoReport() : null
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [caption, setCaption] = useState(() => String(session?.user.user_metadata?.caption ?? ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const ownedSet = new Set(owned ?? [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Identity */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={displayProfile.full_name} url={displayProfile.avatar_url} size={64} />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold">{displayProfile.full_name}</h1>
            <p className="text-sm text-muted">{ROLE_LABELS[displayProfile.role]}{!profile ? ' · Public demo' : ''}</p>
            {caption ? <p className="mt-1 text-sm text-ink-soft">{caption}</p> : null}
            <div className="mt-1.5"><TrustBadge score={displayProfile.trust_score ?? 50} /></div>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold text-primary">{displayProfile.points}</div>
            <div className="text-xs uppercase tracking-wide text-muted">impact points</div>
          </div>
        </CardBody>
      </Card>

      {session && profile ? (
        <Card className="mt-4">
          <CardBody className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Edit your citizen profile</h2>
            <div>
              <Label htmlFor="avatar-url">Profile photo URL</Label>
              <Input id="avatar-url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="caption">Caption</Label>
              <Input id="caption" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Making Vadodara better, one report at a time." />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                loading={saving}
                onClick={async () => {
                  setSaving(true)
                  setSaved(false)
                  await Promise.all([
                    supabase.from('profiles').update({ avatar_url: avatarUrl.trim() || null }).eq('id', session.user.id),
                    supabase.auth.updateUser({ data: { caption: caption.trim() } }),
                  ])
                  await refreshProfile()
                  setSaving(false)
                  setSaved(true)
                }}
              >Save profile</Button>
              {saved ? <span className="text-sm font-medium text-status-resolved">Saved</span> : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

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
      {demoReport ? (
        <Card className="mb-3 border-status-validated/30 bg-status-validated/5">
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-status-validated">Just submitted · Public demo</p>
            <p className="mt-1 font-semibold">{demoReport.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{demoReport.description || 'No additional description provided.'}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><MapPin className="size-3.5" /> {demoReport.address ?? 'Location pinned on map'} · Severity {demoReport.severity}/10</p>
          </CardBody>
        </Card>
      ) : null}
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

function readDemoReport(): { title: string; description: string; severity: number; address: string | null } | null {
  try {
    const raw = window.localStorage.getItem('communityhero-demo-report')
    if (!raw) return null
    const report = JSON.parse(raw) as { title?: unknown; description?: unknown; severity?: unknown; address?: unknown }
    if (typeof report.title !== 'string') return null
    return {
      title: report.title,
      description: typeof report.description === 'string' ? report.description : '',
      severity: typeof report.severity === 'number' ? report.severity : 5,
      address: typeof report.address === 'string' ? report.address : null,
    }
  } catch {
    return null
  }
}
