import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { RouteStop } from '@/lib/route'

function numberIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--color-primary);color:white;font:700 13px/1 sans-serif;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function Fit({ line }: { line: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (line.length) map.fitBounds(L.latLngBounds(line).pad(0.2))
  }, [line, map])
  return null
}

interface RouteMapProps {
  ordered: RouteStop[]
  line: [number, number][]
  className?: string
}

export function RouteMap({ ordered, line, className }: RouteMapProps) {
  const center = line[0] ?? [22.3072, 73.1812]
  return (
    <MapContainer center={center} zoom={13} className={className} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {line.length > 1 ? <Polyline positions={line} pathOptions={{ color: 'var(--color-primary)', weight: 4, opacity: 0.8 }} /> : null}
      {ordered.map((s, i) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={numberIcon(i + 1)} />
      ))}
      <Fit line={line.length ? line : ordered.map((s) => [s.lat, s.lng])} />
    </MapContainer>
  )
}
