import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.heat'
import { STATUS_META, type IssueView } from '@/lib/issues'
import { DEFAULT_CENTER, type Coords } from '@/hooks/useGeolocation'

interface IssueMapProps {
  issues: IssueView[]
  center?: Coords | null
  mode?: 'pins' | 'heat'
  onSelect?: (id: string) => void
  className?: string
}

function statusColor(status: IssueView['status']): string {
  const tone = status ? STATUS_META[status].tone : 'status-reported'
  return `var(--color-${tone})`
}

function markerIcon(issue: IssueView): L.DivIcon {
  const color = statusColor(issue.status)
  const ring = issue.severity && issue.severity >= 7 ? '0 0 0 4px color-mix(in oklch, var(--color-sev-high) 35%, transparent)' : 'none'
  return L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:${ring}, 0 2px 6px rgba(0,0,0,.3);border:2px solid white"><span style="width:7px;height:7px;border-radius:50%;background:white;transform:rotate(45deg)"></span></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function HeatLayer({ issues }: { issues: IssueView[] }) {
  const map = useMap()
  useEffect(() => {
    const points = issues
      .filter((i) => i.lat != null && i.lng != null)
      .map((i) => [i.lat as number, i.lng as number, Math.min(1, (i.severity ?? 5) / 10)] as [number, number, number])
    // leaflet.heat augments L at runtime; types are not shipped.
    const layer = (L as unknown as { heatLayer: (pts: unknown, opts: unknown) => L.Layer }).heatLayer(points, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      gradient: { 0.3: '#22c55e', 0.6: '#eab308', 0.9: '#ef4444' },
    })
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [issues, map])
  return null
}

function Recenter({ center }: { center: Coords }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14))
  }, [center, map])
  return null
}

export function IssueMap({ issues, center, mode = 'pins', onSelect, className }: IssueMapProps) {
  const start = center ?? DEFAULT_CENTER
  const located = issues.filter((i) => i.lat != null && i.lng != null)

  const markers = useMemo(
    () =>
      located.map((issue) => (
        <Marker
          key={issue.id}
          position={[issue.lat as number, issue.lng as number]}
          icon={markerIcon(issue)}
          eventHandlers={{ click: () => onSelect?.(issue.id as string) }}
        />
      )),
    [located, onSelect],
  )

  return (
    <MapContainer
      center={[start.lat, start.lng]}
      zoom={13}
      scrollWheelZoom
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {center ? <Recenter center={center} /> : null}
      {mode === 'heat' ? (
        <HeatLayer issues={located} />
      ) : (
        <MarkerClusterGroup chunkedLoading>{markers}</MarkerClusterGroup>
      )}
    </MapContainer>
  )
}
