import { useCallback, useState } from 'react'

export interface Coords {
  lat: number
  lng: number
}

interface GeolocationState {
  coords: Coords | null
  loading: boolean
  error: string | null
  locate: () => void
}

// Sensible default center (used until the user shares location): Vadodara, IN.
export const DEFAULT_CENTER: Coords = { lat: 22.3072, lng: 73.1812 }

export function useGeolocation(): GeolocationState {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported on this device.')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      (err) => {
        setError(err.message || 'Could not get your location.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  return { coords, loading, error, locate }
}
