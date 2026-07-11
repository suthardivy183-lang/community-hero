import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { LayoutDashboard, ListChecks, BarChart3, Flame, Route as RouteIcon, Radio, MapPinCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useIssues } from '@/features/issues/queries'
import { useRealtimeIssues } from '@/hooks/useRealtimeIssues'
import { TriageBoard } from '@/components/admin/TriageBoard'
import { ImpactCharts } from '@/components/admin/ImpactCharts'
import { HotspotsPanel } from '@/components/admin/HotspotsPanel'
import { RoutePlanner } from '@/components/admin/RoutePlanner'
import { SocialMonitor } from '@/components/admin/SocialMonitor'
import { VerifyPanel } from '@/components/admin/VerifyPanel'
import { EscalationBanner } from '@/components/admin/EscalationBanner'
import { Spinner } from '@/components/ui/Spinner'
import { ROLE_LABELS } from '@/lib/issues'
import { cn } from '@/lib/utils'

const tabTrigger =
  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors data-[state=active]:border-primary data-[state=active]:text-primary border-transparent text-muted hover:text-ink'

export function DashboardPage() {
  useRealtimeIssues()
  const { profile, role } = useAuth()
  // Authorities see their department's queue; volunteers/superadmins see all.
  const departmentId = role === 'authority' ? profile?.department_id ?? null : null
  const { data: issues, isLoading } = useIssues(departmentId ? { departmentId } : {})

  const [tab, setTab] = useState(role === 'volunteer' ? 'verify' : 'triage')
  const canOperate = role === 'authority' || role === 'superadmin'

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-fg"><LayoutDashboard className="size-6" /></span>
        <div>
          <h1 className="font-display text-3xl font-semibold">Authority dashboard</h1>
          <p className="text-sm text-muted">{role ? ROLE_LABELS[role] : 'Public demo'} · triage, resolve & measure impact</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-64 place-items-center"><Spinner /></div>
      ) : (
        <>
        <EscalationBanner />
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List className="mb-5 flex gap-1 border-b border-border">
            {canOperate ? <><Tabs.Trigger value="triage" className={cn(tabTrigger)}><ListChecks className="size-4" /> Triage queue</Tabs.Trigger><Tabs.Trigger value="impact" className={cn(tabTrigger)}><BarChart3 className="size-4" /> Impact</Tabs.Trigger><Tabs.Trigger value="map" className={cn(tabTrigger)}><Flame className="size-4" /> Hotspots</Tabs.Trigger><Tabs.Trigger value="route" className={cn(tabTrigger)}><RouteIcon className="size-4" /> Route</Tabs.Trigger><Tabs.Trigger value="social" className={cn(tabTrigger)}><Radio className="size-4" /> Social</Tabs.Trigger></> : null}
            {role === 'volunteer' || role === 'superadmin' ? <Tabs.Trigger value="verify" className={cn(tabTrigger)}><MapPinCheck className="size-4" /> Verify</Tabs.Trigger> : null}
          </Tabs.List>

          <Tabs.Content value="triage"><TriageBoard issues={issues ?? []} /></Tabs.Content>
          <Tabs.Content value="impact"><ImpactCharts issues={issues ?? []} /></Tabs.Content>
          <Tabs.Content value="map"><HotspotsPanel issues={issues ?? []} /></Tabs.Content>
          <Tabs.Content value="route"><RoutePlanner issues={issues ?? []} /></Tabs.Content>
          <Tabs.Content value="social"><SocialMonitor /></Tabs.Content>
          {role === 'volunteer' || role === 'superadmin' ? <Tabs.Content value="verify"><VerifyPanel /></Tabs.Content> : null}
        </Tabs.Root>
        </>
      )}
    </div>
  )
}
