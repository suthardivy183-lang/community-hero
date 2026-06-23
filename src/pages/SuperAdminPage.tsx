import { ShieldAlert } from 'lucide-react'
import { useAllProfiles, useSetUserRole } from '@/features/admin/users'
import { useDepartments } from '@/features/issues/queries'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/layout/Header'
import { ROLE_LABELS, type UserRole } from '@/lib/issues'

const ROLES: UserRole[] = ['citizen', 'volunteer', 'authority', 'superadmin']

export function SuperAdminPage() {
  const { data: profiles, isLoading } = useAllProfiles()
  const { data: departments } = useDepartments()
  const setRole = useSetUserRole()

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
    </div>
  )
}
