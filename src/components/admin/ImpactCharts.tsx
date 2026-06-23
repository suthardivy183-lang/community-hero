import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { IssueView } from '@/lib/issues'
import { Card, CardBody } from '@/components/ui/Card'
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
