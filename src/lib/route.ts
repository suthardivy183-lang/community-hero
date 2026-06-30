export interface RouteStop {
  id: string
  lat: number
  lng: number
  title: string
  priority: number
  repairHours: number
}

export interface OptimizedRoute {
  ordered: RouteStop[]
  line: [number, number][]
  travelMinutes: number
  repairHours: number
  completionHours: number
  source: 'osrm' | 'estimate'
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Greedy nearest-neighbour ordering, seeded at the highest-priority stop. */
export function orderStops(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 2) return [...stops]
  const remaining = [...stops]
  remaining.sort((a, b) => b.priority - a.priority)
  const ordered: RouteStop[] = [remaining.shift()!]
  while (remaining.length) {
    const last = ordered[ordered.length - 1]
    let bestIdx = 0
    let bestD = Infinity
    remaining.forEach((s, i) => {
      const d = haversineKm(last, s)
      if (d < bestD) { bestD = d; bestIdx = i }
    })
    ordered.push(remaining.splice(bestIdx, 1)[0])
  }
  return ordered
}

/** Real driving route + duration via OSRM; falls back to straight lines + estimate. */
export async function buildRoute(stops: RouteStop[]): Promise<OptimizedRoute> {
  const ordered = orderStops(stops)
  const repairHours = ordered.reduce((sum, s) => sum + s.repairHours, 0)

  if (ordered.length >= 2) {
    try {
      const coords = ordered.map((s) => `${s.lng},${s.lat}`).join(';')
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        const route = data.routes?.[0]
        if (route) {
          const line: [number, number][] = (route.geometry.coordinates as [number, number][]).map(
            ([lng, lat]) => [lat, lng],
          )
          const travelMinutes = Math.round(route.duration / 60)
          return { ordered, line, travelMinutes, repairHours, completionHours: repairHours + travelMinutes / 60, source: 'osrm' }
        }
      }
    } catch {
      // fall through to estimate
    }
  }

  // Estimate: straight segments + ~25 km/h average urban speed.
  let km = 0
  for (let i = 1; i < ordered.length; i++) km += haversineKm(ordered[i - 1], ordered[i])
  const travelMinutes = Math.round((km / 25) * 60)
  const line = ordered.map((s) => [s.lat, s.lng] as [number, number])
  return { ordered, line, travelMinutes, repairHours, completionHours: repairHours + travelMinutes / 60, source: 'estimate' }
}
