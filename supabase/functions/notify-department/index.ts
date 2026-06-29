import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

// Emails the responsible department when an issue is reported or escalated.
// Called by Postgres pg_net triggers. Mock-safe: if RESEND_API_KEY is unset it
// logs and returns sent:false instead of failing.

interface Body {
  type: 'new_issue' | 'escalation'
  issue_id: string
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://communityhero-theta.vercel.app'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Optional shared-secret gate (enforced only if WEBHOOK_SECRET is set).
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: issue } = await admin.from('issues_view').select('*').eq('id', body.issue_id).single()
  if (!issue) return json({ error: 'issue not found' }, 404)

  let deptEmail: string | null = null
  let deptName = 'the responsible department'
  if (issue.department_id) {
    const { data: dept } = await admin
      .from('departments')
      .select('contact_email, name')
      .eq('id', issue.department_id)
      .single()
    deptEmail = dept?.contact_email ?? null
    deptName = dept?.name ?? deptName
  }

  const escalated = body.type === 'escalation'
  const trackUrl = `${APP_URL}/issue/${body.issue_id}`
  const subject = escalated
    ? `[ESCALATED] ${issue.title}`
    : `New civic report: ${issue.title}`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#3b3f9e">${escalated ? '⚠️ Escalated civic issue' : '📍 New civic report'}</h2>
      <p>Dear ${deptName},</p>
      <p>A citizen has ${escalated ? 'an unresolved issue that has been escalated' : 'reported an issue routed to your department'} via Community Hero:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 8px;color:#666">Issue</td><td style="padding:4px 8px"><b>${issue.title}</b></td></tr>
        <tr><td style="padding:4px 8px;color:#666">Category</td><td style="padding:4px 8px">${issue.category_name ?? '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Severity</td><td style="padding:4px 8px">${issue.severity}/10</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Location</td><td style="padding:4px 8px">${issue.address ?? `${issue.lat}, ${issue.lng}`}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Reported</td><td style="padding:4px 8px">${new Date(issue.created_at as string).toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:12px">${issue.description ?? ''}</p>
      <p><a href="${trackUrl}" style="background:#3b3f9e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">View & update status →</a></p>
      <p style="color:#999;font-size:12px;margin-top:16px">Sent by Community Hero · citizen-submitted report. Map: ${trackUrl}</p>
    </div>`

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey || !deptEmail) {
    console.log('notify-department mock:', { subject, to: deptEmail, hasKey: !!resendKey })
    return json({ sent: false, reason: !resendKey ? 'RESEND_API_KEY not set' : 'no department email', subject, to: deptEmail })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Community Hero <onboarding@resend.dev>',
      to: [deptEmail],
      subject,
      html,
    }),
  })
  const detail = await res.text()
  return json({ sent: res.ok, to: deptEmail, subject, status: res.status, detail: res.ok ? undefined : detail.slice(0, 200) })
})
