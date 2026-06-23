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
