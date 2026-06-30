import type { IssueContext } from './ai'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const HIGH_TRAFFIC = ['motorway', 'trunk', 'primary']
const MED_TRAFFIC = ['secondary', 'tertiary']

/**
 * Real contextual factors near a point from OpenStreetMap (free, no key):
 * nearby hospital/school + nearest road class → traffic proxy.
 * Returns an empty context on timeout/failure so scoring still works.
 */
export async function fetchContext(lat: number, lng: number): Promise<IssueContext> {
  const query = `[out:json][timeout:8];
(
  node(around:300,${lat},${lng})[amenity=hospital];
  way(around:300,${lat},${lng})[amenity=hospital];
  node(around:300,${lat},${lng})[amenity=clinic];
  node(around:300,${lat},${lng})[amenity=school];
  way(around:300,${lat},${lng})[amenity=school];
  node(around:300,${lat},${lng})[amenity=college];
  way(around:30,${lat},${lng})[highway];
);
out tags;`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 9000)
    const res = await fetch(OVERPASS, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return {}
    const data = await res.json()
    const els: Array<{ tags?: Record<string, string> }> = data.elements ?? []

    let nearHospital = false
    let nearSchool = false
    let roadClass: string | undefined
    for (const el of els) {
      const a = el.tags?.amenity
      if (a === 'hospital' || a === 'clinic') nearHospital = true
      if (a === 'school' || a === 'college') nearSchool = true
      if (!roadClass && el.tags?.highway) roadClass = el.tags.highway
    }
    const traffic = roadClass && HIGH_TRAFFIC.includes(roadClass)
      ? 'high'
      : roadClass && MED_TRAFFIC.includes(roadClass)
        ? 'medium'
        : 'low'
    return { nearHospital, nearSchool, roadClass, traffic }
  } catch {
    return {}
  }
}
