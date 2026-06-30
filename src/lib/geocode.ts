/** Forward-geocode a place name → coords via the free OSM Nominatim search API. */
export async function geocodeSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'Accept-Language': 'en' } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const hit = Array.isArray(data) && data[0]
    if (!hit) return null
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
  } catch {
    return null
  }
}

/** Reverse-geocode lat/lng to a human address via the free OSM Nominatim API. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { 'Accept-Language': 'en' } },
    )
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.display_name === 'string' ? data.display_name : null
  } catch {
    return null
  }
}
