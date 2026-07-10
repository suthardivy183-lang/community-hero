import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Download, ExternalLink } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { computePriority } from '@/lib/priority'
import {
  statusBreakdown, categoryBreakdown, departmentPerformance, avgResolutionHours, headlineStats,
} from '@/features/admin/analytics'

export function ImpactCharts({ issues }: { issues: IssueView[] }) {
  const stats = headlineStats(issues)
  const byStatus = statusBreakdown(issues)
  const byCategory = categoryBreakdown(issues).slice(0, 6)
  const byDept = departmentPerformance(issues)
  const avgHours = avgResolutionHours(issues)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button size="sm" variant="outline" onClick={() => downloadIssuesCsv(issues)} disabled={issues.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
        <a
          href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/open311`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Open311 feed <ExternalLink className="size-3.5" />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total reports" value={stats.total} />
        <Stat label="Resolution rate" value={`${stats.resolutionRate}%`} tone="var(--color-status-resolved)" />
        <Stat label="Critical open" value={stats.critical} tone="var(--color-sev-high)" />
        <Stat label="Avg resolution" value={avgHours != null ? `${avgHours.toFixed(1)}h` : '—'} tone="var(--color-status-acknowledged)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="mb-3 font-display text-lg font-semibold">Issues by status</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-3 font-display text-lg font-semibold">Top categories</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'var(--color-surface-sunk)' }} />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h3 className="mb-3 font-display text-lg font-semibold">Department performance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDept}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--color-surface-sunk)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="resolved" stackId="a" fill="var(--color-status-resolved)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" stackId="a" fill="var(--color-status-progress)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  )
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadIssuesCsv(issues: IssueView[]) {
  const headers = ['id', 'title', 'category', 'department', 'status', 'severity_score', 'priority_score', 'created_at', 'resolved_at', 'address', 'lat', 'lng']
  const rows = issues.map((issue) => [
    issue.id,
    issue.title,
    issue.category_name ?? issue.category_slug,
    issue.department_name,
    issue.status,
    issue.severity_score ?? (issue.severity != null ? issue.severity * 10 : null),
    computePriority(issue).score,
    issue.created_at,
    issue.resolved_at,
    issue.address,
    issue.lat,
    issue.lng,
  ])
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `communityhero-issues-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="font-mono text-2xl font-bold" style={{ color: tone ?? 'var(--color-ink)' }}>{value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      </CardBody>
    </Card>
  )
}
