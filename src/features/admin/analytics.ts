import { STATUS_META, type IssueView } from '@/lib/issues'

export interface NameValue {
  name: string
  value: number
  color?: string
}

const RESOLVED_STATUSES = ['resolved', 'ai_validated', 'closed']

export function statusBreakdown(issues: IssueView[]): NameValue[] {
  const counts = new Map<string, number>()
  for (const i of issues) {
    if (!i.status) continue
    counts.set(i.status, (counts.get(i.status) ?? 0) + 1)
  }
  return [...counts.entries()].map(([status, value]) => ({
    name: STATUS_META[status as keyof typeof STATUS_META].label,
    value,
    color: `var(--color-${STATUS_META[status as keyof typeof STATUS_META].tone})`,
  }))
}

export function categoryBreakdown(issues: IssueView[]): NameValue[] {
  const counts = new Map<string, number>()
  for (const i of issues) {
    const name = i.category_name ?? 'Other'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function departmentPerformance(issues: IssueView[]): Array<{ name: string; resolved: number; open: number }> {
  const map = new Map<string, { resolved: number; open: number }>()
  for (const i of issues) {
    const name = i.department_name ?? 'Unassigned'
    const row = map.get(name) ?? { resolved: 0, open: 0 }
    if (i.status && RESOLVED_STATUSES.includes(i.status)) row.resolved += 1
    else row.open += 1
    map.set(name, row)
  }
  return [...map.entries()].map(([name, v]) => ({ name, ...v }))
}

export function avgResolutionHours(issues: IssueView[]): number | null {
  const durations = issues
    .filter((i) => i.resolved_at && i.created_at)
    .map((i) => (new Date(i.resolved_at as string).getTime() - new Date(i.created_at as string).getTime()) / 3_600_000)
  if (durations.length === 0) return null
  return durations.reduce((a, b) => a + b, 0) / durations.length
}

export interface HotspotCluster {
  area: string
  count: number
  topCategory: string
  avgSeverity: number
  lat: number
  lng: number
}

/** Group open issues into ~1km grid cells to surface recurring problem zones. */
export function clusterHotspots(issues: IssueView[]): HotspotCluster[] {
  const GRID = 0.01 // ~1.1km
  const cells = new Map<string, IssueView[]>()
  for (const i of issues) {
    if (i.lat == null || i.lng == null) continue
    if (i.status && RESOLVED_STATUSES.includes(i.status)) continue
    const key = `${Math.round(i.lat / GRID)}:${Math.round(i.lng / GRID)}`
    const arr = cells.get(key) ?? []
    arr.push(i)
    cells.set(key, arr)
  }
  return [...cells.values()]
    .filter((arr) => arr.length >= 2)
    .map((arr) => {
      const catCounts = new Map<string, number>()
      for (const i of arr) catCounts.set(i.category_name ?? 'Other', (catCounts.get(i.category_name ?? 'Other') ?? 0) + 1)
      const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const avgSeverity = arr.reduce((s, i) => s + (i.severity ?? 5), 0) / arr.length
      const area = arr.find((i) => i.address)?.address?.split(',').slice(0, 2).join(',') ?? 'Unnamed zone'
      return {
        area,
        count: arr.length,
        topCategory,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        lat: arr[0].lat as number,
        lng: arr[0].lng as number,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function headlineStats(issues: IssueView[]) {
  const total = issues.length
  const resolved = issues.filter((i) => i.status && RESOLVED_STATUSES.includes(i.status)).length
  const open = total - resolved
  const critical = issues.filter((i) => (i.severity ?? 0) >= 8 && !(i.status && RESOLVED_STATUSES.includes(i.status))).length
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0
  return { total, resolved, open, critical, resolutionRate }
}
