import { useState } from 'react'
import { BadgeCheck, CheckCircle2 } from 'lucide-react'
import type { IssueView } from '@/lib/issues'
import { NEXT_STATUSES, STATUS_META } from '@/lib/issues'
import { useChangeStatus } from '@/features/issues/mutations'
import { useAuth } from '@/features/auth/AuthProvider'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ResolveDialog } from '@/components/admin/ResolveDialog'

/** Inline triage/verification actions shown to staff on an issue's detail page. */
export function StaffActions({ issue }: { issue: IssueView }) {
  const { role } = useAuth()
  const change = useChangeStatus(issue.id as string)
  const [resolveOpen, setResolveOpen] = useState(false)
  const status = issue.status ?? 'reported'
  const isStaff = role === 'authority' || role === 'volunteer' || role === 'superadmin'
  if (!isStaff) return null

  const canVerify = status === 'reported'
  const canResolve = status === 'in_progress'
  const nextOptions = NEXT_STATUSES[status] ?? []

  return (
    <Card className="border-primary/30 bg-primary-tint/30">
      <CardBody className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Staff actions</p>

        {canVerify ? (
          <Button variant="outline" className="w-full justify-start" loading={change.isPending}
            onClick={() => change.mutate({ status: 'community_verified' })}>
            <BadgeCheck className="size-4" /> Verify on the ground
          </Button>
        ) : null}

        {canResolve ? (
          <Button className="w-full justify-start" onClick={() => setResolveOpen(true)}>
            <CheckCircle2 className="size-4" /> Resolve with proof
          </Button>
        ) : null}

        {nextOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {nextOptions.map((s) => (
              <Button key={s} size="sm" variant="ghost" onClick={() => change.mutate({ status: s })}>
                → {STATUS_META[s].label}
              </Button>
            ))}
          </div>
        ) : null}

        <ResolveDialog issue={issue} open={resolveOpen} onOpenChange={setResolveOpen} />
      </CardBody>
    </Card>
  )
}
