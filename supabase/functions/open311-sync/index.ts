import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const allowedStatuses = new Set(['reported', 'community_verified', 'pending_information', 'acknowledged', 'in_progress', 'resolved', 'ai_validated', 'closed', 'reopened', 'rejected'])

/**
 * Protected inbound status adapter for a municipal Open311/311 integration.
 * Configure OPEN311_SYNC_SECRET in Supabase and send it in x-open311-secret.
 * We deliberately reject unauthenticated internet requests rather than expose
 * an endpoint that can alter citizen complaints.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('OPEN311_SYNC_SECRET')
  if (!secret || req.headers.get('x-open311-secret') !== secret) return json({ error: 'Unauthorized' }, 401)

  let body: { service_request_id?: string; status?: string; status_notes?: string; [key: string]: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  if (!body.service_request_id || !body.status || !allowedStatuses.has(body.status)) {
    return json({ error: 'service_request_id and a valid CommunityHero status are required' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data, error } = await supabase.rpc('import_open311_status', {
    p_external_reference: body.service_request_id,
    p_status: body.status,
    p_note: body.status_notes ?? null,
    p_payload: body,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ issue_id: data, imported: true })
})
