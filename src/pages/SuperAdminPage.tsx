import { useMemo, useState } from 'react'
import { ShieldAlert, Save, History } from 'lucide-react'
import { useAllProfiles, useSetUserRole } from '@/features/admin/users'
import { useDepartments } from '@/features/issues/queries'
import { useCategories } from '@/features/issues/queries'
import { useSaveSlaPolicy, useSlaPolicies, type SlaPolicy } from '@/features/admin/sla'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/layout/Header'
import { ROLE_LABELS, type UserRole } from '@/lib/issues'
import { ALL_STATUSES, STATUS_META } from '@/lib/issues'
import { useAuditLog } from '@/features/admin/audit'
import { timeAgo } from '@/lib/utils'

const ROLES: UserRole[] = ['citizen', 'volunteer', 'authority', 'superadmin']

export function SuperAdminPage() {
  const { data: profiles, isLoading } = useAllProfiles()
  const { data: departments } = useDepartments()
  const { data: categories } = useCategories()
  const { data: policies, isLoading: policiesLoading } = useSlaPolicies()
  const savePolicy = useSaveSlaPolicy()
  const { data: auditLog, isLoading: auditLoading } = useAuditLog()
  const [auditCategory, setAuditCategory] = useState('all')
  const [auditStatus, setAuditStatus] = useState('all')
  const [drafts, setDrafts] = useState<Record<string, { level1_days: number; level2_days: number }>>({})

  const policyRows = useMemo(() => {
    const byCategory = new Map((policies ?? []).filter((p) => p.category_id).map((p) => [p.category_id!, p]))
    const defaults = (policies ?? []).find((p) => !p.category_id)
    return [
      { key: 'default', label: 'Default policy', policy: defaults ?? null },
      ...(categories ?? []).map((category) => ({ key: category.id, label: category.name, policy: byCategory.get(category.id) ?? null })),
    ]
  }, [categories, policies])

  function values(row: { key: string; policy: SlaPolicy | null }) {
    return drafts[row.key] ?? { level1_days: row.policy?.level1_days ?? 3, level2_days: row.policy?.level2_days ?? 7 }
  }

  function updateDraft(key: string, field: 'level1_days' | 'level2_days', value: number) {
    const current = policyRows.find((row) => row.key === key)
    if (!current) return
    const next = { ...values(current), [field]: value }
    setDrafts((items) => ({ ...items, [key]: next }))
  }

  async function save(row: typeof policyRows[number]) {
    const next = values(row)
    await savePolicy.mutateAsync({
      id: row.policy?.id ?? crypto.randomUUID(),
      category_id: row.key === 'default' ? null : row.key,
      ...next,
    })
    setDrafts((items) => { const copy = { ...items }; delete copy[row.key]; return copy })
  }
  const setRole = useSetUserRole()
  const filteredAudit = (auditLog ?? []).filter((event) => (auditCategory === 'all' || event.issue?.category_id === auditCategory) && (auditStatus === 'all' || event.to_status === auditStatus))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-status-escalated/15 text-status-escalated"><ShieldAlert className="size-6" /></span>
        <div>
          <h1 className="font-display text-3xl font-semibold">Platform administration</h1>
          <p className="text-sm text-muted">Assign roles and route authorities to departments.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {profiles?.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar name={p.full_name} url={p.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.full_name ?? 'Citizen'}</p>
                <p className="text-xs text-muted">{ROLE_LABELS[p.role]} · {p.points} pts</p>
              </div>

              <select
                value={p.role}
                onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value as UserRole, departmentId: p.department_id })}
                className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-medium focus:border-primary focus:outline-none"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>

              {p.role === 'authority' ? (
                <select
                  value={p.department_id ?? ''}
                  onChange={(e) => setRole.mutate({ userId: p.id, role: 'authority', departmentId: e.target.value || null })}
                  className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">No department</option>
                  {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardBody>
          <div className="mb-4">
            <h2 className="font-display text-xl font-semibold">SLA policies</h2>
            <p className="text-sm text-muted">Set the unresolved-day thresholds that trigger level 1 and level 2 escalation.</p>
          </div>
          {policiesLoading ? <div className="grid h-24 place-items-center"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 font-semibold">Category</th>
                    <th className="pb-2 font-semibold">Level 1 (days)</th>
                    <th className="pb-2 font-semibold">Level 2 (days)</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {policyRows.map((row) => {
                    const current = values(row)
                    return <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium">{row.label}</td>
                      <td className="py-3 pr-3"><Input type="number" min={0} value={current.level1_days} onChange={(e) => updateDraft(row.key, 'level1_days', Number(e.target.value))} /></td>
                      <td className="py-3 pr-3"><Input type="number" min={0} value={current.level2_days} onChange={(e) => updateDraft(row.key, 'level2_days', Number(e.target.value))} /></td>
                      <td className="py-3 text-right"><Button size="sm" onClick={() => save(row)} loading={savePolicy.isPending}><Save className="size-4" /> Save</Button></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><History className="size-5 text-primary" /> Audit log</h2><p className="text-sm text-muted">Latest 100 status changes across the platform.</p></div>
            <div className="flex flex-wrap gap-2">
              <select value={auditCategory} onChange={(e) => setAuditCategory(e.target.value)} className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm"><option value="all">All categories</option>{categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <select value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)} className="rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm"><option value="all">All statuses</option>{ALL_STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select>
            </div>
          </div>
          {auditLoading ? <div className="grid h-24 place-items-center"><Spinner /></div> : filteredAudit.length === 0 ? <p className="py-8 text-center text-sm text-muted">No status changes match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted"><th className="pb-2">When</th><th className="pb-2">Issue</th><th className="pb-2">Category</th><th className="pb-2">Change</th><th className="pb-2">Actor</th><th className="pb-2">Note</th></tr></thead><tbody>{filteredAudit.map((event) => <tr key={event.id} className="border-b border-border last:border-0"><td className="py-3 whitespace-nowrap text-muted" title={event.created_at}>{timeAgo(event.created_at)}</td><td className="max-w-[220px] truncate py-3 font-medium">{event.issue?.title ?? event.issue_id}</td><td className="py-3 text-muted">{event.issue?.category?.name ?? '—'}</td><td className="py-3 whitespace-nowrap"><span className="text-muted">{event.from_status ? STATUS_META[event.from_status].label : 'Created'}</span> → <span className="font-semibold">{STATUS_META[event.to_status].label}</span></td><td className="py-3 text-muted">{event.actor?.full_name ?? 'System'}</td><td className="max-w-[180px] truncate py-3 text-muted">{event.note ?? '—'}</td></tr>)}</tbody></table></div>}
        </CardBody>
      </Card>
    </div>
  )
}
