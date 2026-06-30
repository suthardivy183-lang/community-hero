import { useState } from 'react'
import { Route as RouteIcon, Clock, Wrench, Flag, Loader2 } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { computePriority } from '@/lib/priority'
import { estimateRepair } from '@/lib/repair'
import { buildRoute, type OptimizedRoute, type RouteStop } from '@/lib/route'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { RouteMap } from '@/components/map/RouteMap'

export function RoutePlanner({ issues }: { issues: IssueView[] }) {
  const candidates = issues.filter(
    (i) => i.lat != null && i.lng != null && i.status && !['closed', 'ai_validated', 'rejected'].includes(i.status),
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [route, setRoute] = useState<OptimizedRoute | null>(null)
  const [loading, setLoading] = useState(false)

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function optimize() {
    const stops: RouteStop[] = candidates
      .filter((i) => selected.has(i.id as string))
      .map((i) => ({
        id: i.id as string,
        lat: i.lat as number,
        lng: i.lng as number,
        title: i.title ?? 'Issue',
        priority: computePriority(i).score,
        repairHours: estimateRepair(i).durationHours,
      }))
    if (stops.length < 2) return
    setLoading(true)
    try {
      setRoute(await buildRoute(stops))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted">Select issues, then optimise the repair route.</p>
          <Button size="sm" onClick={optimize} disabled={selected.size < 2 || loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RouteIcon className="size-4" />}
            Optimise ({selected.size})
          </Button>
        </div>
        <div className="space-y-2">
          {candidates.map((i) => {
            const checked = selected.has(i.id as string)
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggle(i.id as string)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  checked ? 'border-primary bg-primary-tint/40' : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <span className={cn('grid size-5 place-items-center rounded border', checked ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong')}>
                  {checked ? '✓' : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted">Priority {computePriority(i).score} · ~{estimateRepair(i).durationHours}h repair</p>
                </div>
              </button>
            )
          })}
          {candidates.length === 0 ? <p className="py-6 text-center text-sm text-muted">No open issues to route.</p> : null}
        </div>
      </div>

      <div>
        {route ? (
          <Card>
            <CardBody>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <Stat icon={<Clock className="size-4" />} label="Travel" value={`${route.travelMinutes} min`} />
                <Stat icon={<Wrench className="size-4" />} label="Repairs" value={`${route.repairHours} h`} />
                <Stat icon={<Flag className="size-4" />} label="Done in" value={`${route.completionHours.toFixed(1)} h`} />
              </div>
              <div className="h-64 overflow-hidden rounded-xl border border-border">
                <RouteMap ordered={route.ordered} line={route.line} className="h-full w-full" />
              </div>
              <ol className="mt-3 space-y-1.5">
                {route.ordered.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{i + 1}</span>
                    <span className="line-clamp-1">{s.title}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">Route via {route.source === 'osrm' ? 'live road network (OSRM)' : 'distance estimate'}.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid h-full min-h-48 place-items-center rounded-[var(--radius-card)] border border-dashed border-border-strong text-sm text-muted">
            Select 2+ issues and optimise to see the route.
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunk p-2.5">
      <div className="flex items-center justify-center gap-1 text-xs text-muted">{icon}{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold">{value}</div>
    </div>
  )
}
