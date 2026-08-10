import { BarChart3, Clock3, ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
import { useIssues } from '@/features/issues/queries'
import { avgResolutionHours, departmentPerformance, headlineStats } from '@/features/admin/analytics'
import { Card, CardBody } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const FINISHED = ['resolved', 'ai_validated', 'closed']

export function TransparencyPage() {
  const { data: issues, isLoading } = useIssues()
  if (isLoading) return <div className="grid h-64 place-items-center"><Spinner /></div>
  const list = issues ?? []
  const stats = headlineStats(list)
  const averageHours = avgResolutionHours(list)
  const escalated = list.filter((issue) => !FINISHED.includes(issue.status ?? '') && (issue.severity_score ?? (issue.severity ?? 0) * 10) >= 70).length
  const escalationRate = list.length ? Math.round((escalated / list.length) * 100) : 0
  const departments = departmentPerformance(list).sort((a, b) => (b.open + b.resolved) - (a.open + a.resolved))

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Open civic data</p>
      <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Public transparency dashboard</h1>
      <p className="mt-3 text-sm text-muted">Live service indicators for public reports. Confidential grievances, identities, and supporting records are excluded.</p>
    </div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<BarChart3 />} label="Total complaints" value={stats.total} />
      <Metric icon={<ShieldCheck />} label="Resolved complaints" value={stats.resolved} detail={`${stats.resolutionRate}% resolution rate`} />
      <Metric icon={<Clock3 />} label="Average response time" value={averageHours == null ? '—' : `${averageHours.toFixed(1)}h`} detail="For resolved complaints" />
      <Metric icon={<TrendingUp />} label="Escalation rate" value={`${escalationRate}%`} detail="High-priority open reports" />
    </div>
    <Card className="mt-6"><CardBody>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">Department performance</h2><p className="text-sm text-muted">Open and resolved public complaints by responsible department.</p></div><a href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/open311`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open311 data feed <ExternalLink className="size-4" /></a></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted"><th className="pb-2">Department</th><th className="pb-2">Resolved</th><th className="pb-2">Open</th><th className="pb-2">Resolution rate</th></tr></thead><tbody>{departments.map((department) => { const total = department.open + department.resolved; return <tr key={department.name} className="border-b border-border last:border-0"><td className="py-3 font-medium">{department.name}</td><td className="py-3 text-status-resolved">{department.resolved}</td><td className="py-3 text-status-progress">{department.open}</td><td className="py-3">{total ? Math.round((department.resolved / total) * 100) : 0}%</td></tr> })}</tbody></table></div>
    </CardBody></Card>
  </div>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail?: string }) {
  return <Card><CardBody className="p-4"><span className="grid size-9 place-items-center rounded-lg bg-primary-tint text-primary">{icon}</span><p className="mt-3 font-mono text-2xl font-bold">{value}</p><p className="text-sm font-semibold">{label}</p>{detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}</CardBody></Card>
}
