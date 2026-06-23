import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Coords } from '@/hooks/useGeolocation'

const pinIcon = L.divIcon({
  className: '',
  html: `<span style="display:block;width:28px;height:28px;border-radius:50% 50% 50% 0;background:var(--color-primary);transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.35)"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function Controller({ value }: { value: Coords }) {
  const map = useMap()
  useEffect(() => {
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16))
  }, [value, map])
  return null
}

interface LocationPickerProps {
  value: Coords
  onChange: (coords: Coords) => void
  className?: string
}

export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const markerRef = useRef<L.Marker>(null)

  return (
    <MapContainer center={[value.lat, value.lng]} zoom={16} className={className} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Controller value={value} />
      <Marker
        position={[value.lat, value.lng]}
        icon={pinIcon}
        draggable
        ref={markerRef}
        eventHandlers={{
          dragend: () => {
            const m = markerRef.current
            if (m) {
              const pos = m.getLatLng()
              onChange({ lat: pos.lat, lng: pos.lng })
            }
          },
        }}
      />
    </MapContainer>
  )
}
