import { useMemo, useState } from 'react'
import { CheckCircle2, LocateFixed, MapPin, MessageCircle, Navigation } from 'lucide-react'
import { useIssuesInBbox, type Bbox } from '@/features/issues/queries'
import { addIssueComment, updateIssueStatus } from '@/features/issues/mutations'
import { useAuth } from '@/features/auth/AuthProvider'
import { useGeolocation, DEFAULT_CENTER } from '@/hooks/useGeolocation'
import { IssueMap } from '@/components/map/IssueMap'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { timeAgo } from '@/lib/utils'
import type { IssueView } from '@/lib/issues'

const DEFAULT_BBOX: Bbox = { minLng: DEFAULT_CENTER.lng - 0.08, minLat: DEFAULT_CENTER.lat - 0.08, maxLng: DEFAULT_CENTER.lng + 0.08, maxLat: DEFAULT_CENTER.lat + 0.08 }

export function VerifyPanel() {
  const { session } = useAuth()
  const location = useGeolocation()
  const [bbox, setBbox] = useState<Bbox | null>(DEFAULT_BBOX)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { data: issues, isLoading } = useIssuesInBbox(bbox, { status: 'reported' })

  const ordered = useMemo(() => [...(issues ?? [])].sort((a, b) => (distanceFrom(location.coords, a) ?? Number.POSITIVE_INFINITY) - (distanceFrom(location.coords, b) ?? Number.POSITIVE_INFINITY)), [issues, location.coords])

  async function verify(issue: IssueView) {
    if (!session || !issue.id) return
    setBusy(issue.id); setNotice(null)
    try { await updateIssueStatus(issue.id, 'community_verified'); setNotice('Issue marked as community verified.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not verify this issue.') }
    finally { setBusy(null) }
  }

  async function cannotFind(issue: IssueView) {
    if (!session || !issue.id) return
    setBusy(issue.id); setNotice(null)
    try { await addIssueComment(issue.id, session.user.id, 'Volunteer could not find this issue on the ground.'); setNotice('Added a “can’t find it” note for the team.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not add the note.') }
    finally { setBusy(null) }
  }

  return <div className="space-y-4">
    <Card className="overflow-hidden">
      <div className="h-56 sm:h-72"><IssueMap issues={issues ?? []} center={location.coords ?? undefined} onBoundsChange={setBbox} /></div>
      <CardBody className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={location.locate} loading={location.loading}><LocateFixed className="size-4" /> Near me</Button>
        <span className="text-xs text-muted">Pan or zoom the map to refresh nearby reported issues.</span>
        {location.error ? <span className="basis-full text-xs text-status-rejected">{location.error}</span> : null}
      </CardBody>
    </Card>
    {notice ? <p className="rounded-lg bg-primary-tint px-3 py-2 text-sm text-primary">{notice}</p> : null}
    <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Nearby tasks</h2><p className="text-sm text-muted">Reported issues ready for an on-the-ground check.</p></div><span className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary">{ordered.length} open</span></div>
    {isLoading ? <div className="grid h-32 place-items-center"><Spinner /></div> : ordered.length === 0 ? <Card><CardBody><p className="text-center text-sm text-muted">No reported issues in this viewport.</p></CardBody></Card> : ordered.map((issue) => <VerifyRow key={issue.id} issue={issue} distance={distanceFrom(location.coords, issue)} busy={busy === issue.id} onVerify={() => verify(issue)} onCannotFind={() => cannotFind(issue)} />)}
  </div>
}

function VerifyRow({ issue, distance, busy, onVerify, onCannotFind }: { issue: IssueView; distance: number | null; busy: boolean; onVerify: () => void; onCannotFind: () => void }) {
  return <Card><CardBody className="space-y-3">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary"><MapPin className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{issue.title}</h3><p className="mt-1 text-sm text-muted">{issue.address ?? 'Location unavailable'}</p><p className="mt-1 text-xs text-muted">{distance == null ? 'Distance unavailable' : `${distance.toFixed(1)} km away`} · {issue.created_at ? timeAgo(issue.created_at) : 'recently reported'}</p></div></div>
    <div className="flex flex-wrap gap-2"><Button size="sm" onClick={onVerify} loading={busy}><CheckCircle2 className="size-4" /> Verify on the ground</Button><Button size="sm" variant="outline" onClick={onCannotFind} loading={busy}><MessageCircle className="size-4" /> Can’t find it</Button><a href={`/issue/${issue.id}`} className="ml-auto inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-primary hover:underline"><Navigation className="size-4" /> Details</a></div>
  </CardBody></Card>
}

function distanceFrom(coords: { lat: number; lng: number } | null, issue: IssueView): number | null {
  if (!coords || issue.lat == null || issue.lng == null) return null
  const rad = Math.PI / 180; const dLat = (issue.lat - coords.lat) * rad; const dLng = (issue.lng - coords.lng) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(coords.lat * rad) * Math.cos(issue.lat * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
