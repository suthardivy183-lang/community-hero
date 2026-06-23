import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Flame, TrendingUp } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { clusterHotspots } from '@/features/admin/analytics'
import { hotspotSummary } from '@/lib/ai'
import { IssueMap } from '@/components/map/IssueMap'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function HotspotsPanel({ issues }: { issues: IssueView[] }) {
  const navigate = useNavigate()
  const clusters = useMemo(() => clusterHotspots(issues), [issues])
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await hotspotSummary({ clusters })
      setSummary(res.summary)
    } catch {
      setSummary('Could not generate the briefing right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-status-validated/30 bg-status-validated/5">
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-status-validated">
              <Sparkles className="size-5" /> Predictive maintenance briefing
            </h3>
            <Button size="sm" variant="outline" onClick={generate} loading={loading} disabled={clusters.length === 0}>
              <TrendingUp className="size-4" /> {summary ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
          <p className="mt-3 leading-relaxed text-ink-soft">
            {summary ?? (clusters.length === 0
              ? 'Not enough open clusters yet to predict hotspots.'
              : 'Generate an AI briefing of recurring problem zones and proactive recommendations.')}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="h-[55vh] overflow-hidden rounded-[var(--radius-card)] border border-border">
          <IssueMap issues={issues} mode="heat" onSelect={(id) => navigate(`/issue/${id}`)} />
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold"><Flame className="size-5 text-sev-high" /> Recurring zones</h3>
          {clusters.length === 0 ? (
            <p className="text-sm text-muted">No recurring clusters detected yet.</p>
          ) : (
            clusters.slice(0, 8).map((c, i) => (
              <Card key={i} className="flex items-center gap-3 p-3">
                <span className="grid size-9 place-items-center rounded-lg bg-sev-high/15 font-mono text-sm font-bold text-sev-high">{c.count}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{c.area}</p>
                  <p className="text-xs text-muted">Mostly {c.topCategory} · avg severity {c.avgSeverity}/10</p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
