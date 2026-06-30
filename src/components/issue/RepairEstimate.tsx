import { IndianRupee, Clock, Users, Wrench } from 'lucide-react'
import { estimateRepair } from '@/lib/repair'
import type { IssueView } from '@/lib/issues'
import { Card, CardBody } from '@/components/ui/Card'

/** AI repair estimate: cost, time, crew, responsible team. */
export function RepairEstimate({ issue }: { issue: IssueView }) {
  const est = estimateRepair(issue)
  const items = [
    { icon: <IndianRupee className="size-4" />, label: 'Estimated cost', value: est.costLabel },
    { icon: <Clock className="size-4" />, label: 'Repair time', value: `${est.durationHours} ${est.durationHours === 1 ? 'hour' : 'hours'}` },
    { icon: <Users className="size-4" />, label: 'Team required', value: `${est.team} (${est.manpower})` },
    { icon: <Wrench className="size-4" />, label: 'Department', value: est.department },
  ]
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-display text-lg font-semibold">AI repair estimate</h2>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-xl bg-surface-sunk p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{it.icon}{it.label}</div>
              <div className="mt-1 font-display text-lg font-semibold">{it.value}</div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
