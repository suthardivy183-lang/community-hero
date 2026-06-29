import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

// Open311 GeoReport v2 read API (public).
//   GET /open311                 -> service_requests
//   GET /open311?type=services   -> service list (categories)
// Compliant-shaped JSON so any Open311 client / 311 system can ingest reports.

const CLOSED = ['resolved', 'ai_validated', 'closed']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const wantServices = url.searchParams.get('type') === 'services' || url.pathname.endsWith('/services')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const base = Deno.env.get('SUPABASE_URL')!

  if (wantServices) {
    const { data, error } = await supabase.from('categories').select('slug, name')
    if (error) return json({ error: error.message }, 500)
    return json(
      (data ?? []).map((c) => ({
        service_code: c.slug,
        service_name: c.name,
        description: `Report a ${c.name.toLowerCase()} issue`,
        metadata: false,
        type: 'realtime',
        keywords: c.name,
        group: 'civic',
      })),
    )
  }

  const { data: issues, error } = await supabase
    .from('issues_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return json({ error: error.message }, 500)

  const ids = (issues ?? []).map((i) => i.id)
  const mediaMap = new Map<string, string>()
  if (ids.length) {
    const { data: media } = await supabase
      .from('issue_media')
      .select('issue_id, storage_path')
      .eq('kind', 'original')
      .in('issue_id', ids)
    for (const m of media ?? []) {
      if (!mediaMap.has(m.issue_id)) mediaMap.set(m.issue_id, m.storage_path)
    }
  }

  const requests = (issues ?? []).map((i) => ({
    service_request_id: i.id,
    status: i.status && CLOSED.includes(i.status) ? 'closed' : 'open',
    status_notes: i.status,
    service_name: i.category_name,
    service_code: i.category_slug,
    description: i.description ? `${i.title} — ${i.description}` : i.title,
    agency_responsible: i.department_name,
    requested_datetime: i.created_at,
    updated_datetime: i.resolved_at ?? i.acknowledged_at ?? i.created_at,
    address: i.address,
    lat: i.lat,
    long: i.lng,
    media_url: mediaMap.has(i.id)
      ? `${base}/storage/v1/object/public/issue-media/${mediaMap.get(i.id)}`
      : undefined,
    extended_attributes: { severity: i.severity, confirmations: i.confirm_count, votes: i.vote_count },
  }))

  return json({ service_requests: requests, generated_at: new Date().toISOString() })
})
