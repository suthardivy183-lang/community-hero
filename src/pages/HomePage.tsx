import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon, Flame, SlidersHorizontal, LocateFixed } from 'lucide-react'
import { useIssues, useCategories } from '@/features/issues/queries'
import { useRealtimeIssues } from '@/hooks/useRealtimeIssues'
import { useGeolocation } from '@/hooks/useGeolocation'
import { IssueMap } from '@/components/map/IssueMap'
import { IssueCard } from '@/components/issue/IssueCard'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ALL_STATUSES, STATUS_META, type IssueStatus } from '@/lib/issues'
import { cn } from '@/lib/utils'

export function HomePage() {
  useRealtimeIssues()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { coords, locate, loading: locating } = useGeolocation()

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [status, setStatus] = useState<IssueStatus | null>(null)
  const [mapMode, setMapMode] = useState<'pins' | 'heat'>('pins')

  const { data: categories } = useCategories()
  const { data: issues, isLoading } = useIssues({ categoryId, status })

  const stats = useMemo(() => {
    const list = issues ?? []
    const open = list.filter((i) => i.status && !['closed', 'ai_validated', 'rejected'].includes(i.status)).length
    const resolved = list.filter((i) => i.status && ['resolved', 'ai_validated', 'closed'].includes(i.status)).length
    return { total: list.length, open, resolved }
  }, [issues])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Editorial header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{t('home.kicker')}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            {t('home.title')}
          </h1>
        </div>
        <div className="flex gap-2">
          <StatPill label={t('stats.reported')} value={stats.total} />
          <StatPill label={t('stats.open')} value={stats.open} tone="var(--color-status-progress)" />
          <StatPill label={t('stats.resolved')} value={stats.resolved} tone="var(--color-status-resolved)" />
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
          <SlidersHorizontal className="size-3.5" /> {t('home.filter')}
        </span>
        <Chip active={!categoryId} onClick={() => setCategoryId(null)}>{t('home.allTypes')}</Chip>
        {categories?.map((c) => (
          <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip active={!status} onClick={() => setStatus(null)}>{t('home.anyStatus')}</Chip>
        {ALL_STATUSES.filter((s) => s !== 'rejected').map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {STATUS_META[s].label}
          </Chip>
        ))}
      </div>

      {/* Map + feed */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <section className="order-2 lg:order-1">
          {isLoading ? (
            <div className="grid h-64 place-items-center"><Spinner /></div>
          ) : issues && issues.length > 0 ? (
            <div className="space-y-3">
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          ) : (
            <EmptyState onReport={() => navigate('/report')} />
          )}
        </section>

        <section className="order-1 lg:order-2">
          <div className="sticky top-20 overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
              <div className="inline-flex rounded-lg bg-surface-sunk p-0.5">
                <ModeButton active={mapMode === 'pins'} onClick={() => setMapMode('pins')} icon={<MapIcon className="size-4" />}>{t('home.pins')}</ModeButton>
                <ModeButton active={mapMode === 'heat'} onClick={() => setMapMode('heat')} icon={<Flame className="size-4" />}>{t('home.heatmap')}</ModeButton>
              </div>
              <Button size="sm" variant="ghost" onClick={locate} loading={locating}>
                <LocateFixed className="size-4" /> {t('home.nearMe')}
              </Button>
            </div>
            <div className="h-[60vh] lg:h-[calc(100vh-11rem)]">
              <IssueMap
                issues={issues ?? []}
                center={coords}
                mode={mapMode}
                onSelect={(id) => navigate(`/issue/${id}`)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-1.5 text-center shadow-[var(--shadow-card)]">
      <div className="font-mono text-lg font-bold" style={{ color: tone ?? 'var(--color-ink)' }}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-ink-soft hover:border-border-strong',
      )}
    >
      {children}
    </button>
  )
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
        active ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function EmptyState({ onReport }: { onReport: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface p-10 text-center">
      <h3 className="font-display text-lg font-semibold">{t('home.emptyTitle')}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('home.emptyBody')}</p>
      <Button className="mt-4" onClick={onReport}>{t('home.reportCta')}</Button>
    </div>
  )
}
