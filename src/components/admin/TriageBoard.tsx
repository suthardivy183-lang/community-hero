import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, CheckSquare, Square, AlertCircle } from 'lucide-react'
import type { IssueStatus, IssueView } from '@/lib/issues'
import { NEXT_STATUSES, STATUS_META } from '@/lib/issues'
import { computePriority } from '@/lib/priority'
import { PriorityBadge } from '@/components/issue/PriorityBadge'
import { updateIssueStatus, useAssignDepartment, useChangeStatus } from '@/features/issues/mutations'
import { useDepartments } from '@/features/issues/queries'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/issue/StatusBadge'
import { SeverityMeter } from '@/components/issue/SeverityMeter'
import { CategoryIcon } from '@/components/issue/CategoryIcon'
import { ResolveDialog } from './ResolveDialog'
import { timeAgo } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAssignOfficer, useDepartmentOfficers, useIssueAssignments, type IssueAssignment } from '@/features/admin/assignments'

export function TriageBoard({ issues }: { issues: IssueView[] }) {
  const { session } = useAuth()
  const [demoStatuses, setDemoStatuses] = useState<Record<string, IssueStatus>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDepartment, setBulkDepartment] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [pendingOnly, setPendingOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [minUrgency, setMinUrgency] = useState('0')
  const [location, setLocation] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState('all')
  const { data: departments } = useDepartments()
  const assignDepartment = useAssignDepartment()
  const filtered = useMemo(() => issues.filter((issue) => {
    const ageDays = issue.created_at ? (Date.now() - new Date(issue.created_at).getTime()) / 86_400_000 : 0
    const open = !['resolved', 'ai_validated', 'closed', 'rejected'].includes(issue.status ?? 'reported')
    const urgency = issue.severity_score ?? (issue.severity ?? 0) * 10
    if (pendingOnly && !open) return false
    if (overdueOnly && (!open || ageDays < 3)) return false
    if (urgency < Number(minUrgency)) return false
    if (location.trim() && !(issue.address ?? '').toLowerCase().includes(location.trim().toLowerCase())) return false
    if (maxAgeDays !== 'all' && ageDays > Number(maxAgeDays)) return false
    return true
  }), [issues, location, maxAgeDays, minUrgency, overdueOnly, pendingOnly])
  const { data: assignments } = useIssueAssignments(filtered.map((issue) => issue.id as string))
  // Sort by AI priority score (severity + community + context + age + emergency).
  const ordered = [...filtered].sort((a, b) => computePriority(b).score - computePriority(a).score)
  function updateDemoStatus(issueId: string, status: IssueStatus) {
    setDemoStatuses((statuses) => ({ ...statuses, [issueId]: status }))
  }

  function toggleSelected(id: string) {
    setSelected((items) => { const next = new Set(items); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function bulkStatus(status: IssueStatus) {
    if (!selected.size) return
    setBulkBusy(true); setBulkErrors([])
    const errors: string[] = []
    for (const id of selected) {
      try {
        if (session) await updateIssueStatus(id, status)
        else updateDemoStatus(id, status)
      } catch (error) { errors.push(`${id}: ${error instanceof Error ? error.message : 'could not update status'}`) }
    }
    setBulkErrors(errors); setBulkBusy(false)
    if (!errors.length) setSelected(new Set())
  }

  async function bulkAssign() {
    if (!selected.size || !bulkDepartment) return
    setBulkBusy(true); setBulkErrors([])
    const errors: string[] = []
    for (const id of selected) {
      try {
        if (session) await assignDepartment.mutateAsync({ issueId: id, departmentId: bulkDepartment })
      } catch (error) { errors.push(`${id}: ${error instanceof Error ? error.message : 'could not assign department'}`) }
    }
    setBulkErrors(errors); setBulkBusy(false)
    if (!errors.length) { setSelected(new Set()); setBulkDepartment('') }
  }
  return (
    <div className="space-y-2.5">
      {!session ? <p className="rounded-lg bg-primary-tint px-3 py-2 text-xs font-medium text-primary">Public demo mode — triage changes update this dashboard locally.</p> : null}
      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-muted">Urgency
          <select value={minUrgency} onChange={(e) => setMinUrgency(e.target.value)} className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm"><option value="0">Any urgency</option><option value="40">Medium +</option><option value="70">High +</option><option value="90">Critical</option></select>
        </label>
        <label className="text-xs font-semibold text-muted">Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address or area" className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-muted">Age
          <select value={maxAgeDays} onChange={(e) => setMaxAgeDays(e.target.value)} className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm"><option value="all">Any age</option><option value="1">Last day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm font-medium"><input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending</label>
        <label className="flex items-center gap-2 pt-5 text-sm font-medium"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue (3+ days)</label>
      </div>
      {selected.size > 0 ? <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-surface/95 p-3 shadow-lg backdrop-blur">
        <span className="mr-1 text-sm font-semibold">{selected.size} selected</span>
        <Button size="sm" variant="outline" onClick={() => bulkStatus('acknowledged')} loading={bulkBusy}>Move to Acknowledged</Button>
        <Button size="sm" variant="outline" onClick={() => bulkStatus('in_progress')} loading={bulkBusy}>Move to In Progress</Button>
        <select value={bulkDepartment} onChange={(e) => setBulkDepartment(e.target.value)} className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium">
          <option value="">Assign department…</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Button size="sm" onClick={bulkAssign} loading={bulkBusy} disabled={!bulkDepartment}>Assign</Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
      </div> : null}
      {bulkErrors.length > 0 ? <div className="flex items-start gap-2 rounded-lg bg-status-rejected/10 px-3 py-2 text-xs text-status-rejected"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div>{bulkErrors.map((error) => <p key={error}>{error}</p>)}</div></div> : null}
      {ordered.map((issue) => (
        <TriageRow key={issue.id} issue={issue} assignment={assignments?.find((item) => item.issue_id === issue.id)} selected={selected.has(issue.id as string)} onToggle={() => toggleSelected(issue.id as string)} demoStatus={demoStatuses[issue.id as string]} onDemoStatusChange={updateDemoStatus} />
      ))}
      {ordered.length === 0 ? <p className="py-10 text-center text-sm text-muted">No issues in the queue.</p> : null}
    </div>
  )
}

function TriageRow({ issue, assignment, selected, onToggle, demoStatus, onDemoStatusChange }: { issue: IssueView; assignment?: IssueAssignment; selected: boolean; onToggle: () => void; demoStatus?: IssueStatus; onDemoStatusChange: (issueId: string, status: IssueStatus) => void }) {
  const { session, role } = useAuth()
  const change = useChangeStatus(issue.id as string)
  const [resolveOpen, setResolveOpen] = useState(false)
  const { data: officers } = useDepartmentOfficers(issue.department_id)
  const assignOfficer = useAssignOfficer()
  const status = demoStatus ?? issue.status ?? 'reported'
  const nextOptions = NEXT_STATUSES[status] ?? []
  const canResolve = status === 'in_progress'

  return (
    <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
      <button type="button" aria-label={selected ? 'Deselect issue' : 'Select issue'} onClick={onToggle} className="text-primary">
        {selected ? <CheckSquare className="size-5" /> : <Square className="size-5 text-muted" />}
      </button>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary">
        <CategoryIcon icon={issue.category_icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/issue/${issue.id}`} className="line-clamp-1 font-semibold hover:text-primary">{issue.title}</Link>
          <Link to={`/issue/${issue.id}`}><ExternalLink className="size-3.5 text-muted" /></Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{issue.category_name}</span>
          <span>· {issue.department_name ?? 'Unassigned'}</span>
          <span>· {assignment?.officer?.full_name ? `Officer: ${assignment.officer.full_name}` : 'Unassigned officer'}</span>
          <span>· {issue.created_at ? timeAgo(issue.created_at) : ''}</span>
          <SeverityMeter severity={issue.severity ?? 5} showLabel={false} />
        </div>
      </div>

      <PriorityBadge issue={issue} />
      <StatusBadge status={status} />

      {(role === 'supervisor' || role === 'superadmin') && issue.department_id ? <select value={assignment?.officer_id ?? ''} onChange={(e) => { if (e.target.value) assignOfficer.mutate({ issueId: issue.id as string, officerId: e.target.value }) }} className="rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-xs font-medium" aria-label="Assign officer">
        <option value="">Assign officer…</option>{officers?.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? 'Unnamed officer'}</option>)}
      </select> : null}

      <div className="flex items-center gap-2">
        {canResolve ? (
          <Button size="sm" onClick={() => session ? setResolveOpen(true) : onDemoStatusChange(issue.id as string, 'resolved')}>
            <CheckCircle2 className="size-4" /> Resolve
          </Button>
        ) : nextOptions.length > 0 ? (
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              const next = e.target.value as IssueStatus
              session ? change.mutate({ status: next }) : onDemoStatusChange(issue.id as string, next)
            }}
            className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
          >
            <option value="">Move to…</option>
            {nextOptions.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        ) : null}
      </div>

      <ResolveDialog issue={issue} open={resolveOpen} onOpenChange={setResolveOpen} />
    </Card>
  )
}
