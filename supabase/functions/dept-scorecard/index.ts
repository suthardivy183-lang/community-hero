import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://asli-solution-challenge.web.app'
const since = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

interface DepartmentScorecard {
  department_id: string
  department: string
  to: string | null
  new: number
  resolved: number
  avg_resolution_hours: number | null
  ai_genuine_rate: number | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (secret && req.headers.get('x-webhook-secret') !== secret) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const weekStart = since()
  const [{ data: departments, error: departmentError }, { data: issues, error: issueError }, { data: validations, error: validationError }] = await Promise.all([
    admin.from('departments').select('id, name, contact_email'),
    admin.from('issues').select('id, department_id, created_at, resolved_at').or(`created_at.gte.${weekStart},resolved_at.gte.${weekStart}`),
    admin.from('validations').select('issue_id, verdict, created_at').gte('created_at', weekStart),
  ])
  if (departmentError || issueError || validationError) return json({ error: (departmentError ?? issueError ?? validationError)?.message }, 500)

  const issueById = new Map((issues ?? []).map((issue) => [issue.id, issue]))
  const scorecards: DepartmentScorecard[] = (departments ?? []).map((department) => {
    const departmentIssues = (issues ?? []).filter((issue) => issue.department_id === department.id)
    const resolved = departmentIssues.filter((issue) => issue.resolved_at && issue.resolved_at >= weekStart)
    const genuineValidations = (validations ?? []).filter((validation) => validation.verdict === 'genuine' && issueById.get(validation.issue_id)?.department_id === department.id)
    const departmentValidations = (validations ?? []).filter((validation) => issueById.get(validation.issue_id)?.department_id === department.id)
    const resolutionHours = resolved.map((issue) => (new Date(issue.resolved_at!).getTime() - new Date(issue.created_at).getTime()) / 3600000).filter(Number.isFinite)
    return {
      department_id: department.id,
      department: department.name,
      to: department.contact_email,
      new: departmentIssues.filter((issue) => issue.created_at >= weekStart).length,
      resolved: resolved.length,
      avg_resolution_hours: resolutionHours.length ? Math.round((resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) * 10) / 10 : null,
      ai_genuine_rate: departmentValidations.length ? Math.round((genuineValidations.length / departmentValidations.length) * 1000) / 10 : null,
    }
  })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const sent: Array<{ department: string; to: string | null; sent: boolean }> = []
  for (const scorecard of scorecards) {
    if (!resendKey || !scorecard.to) { sent.push({ department: scorecard.department, to: scorecard.to, sent: false }); continue }
    const subject = `Weekly CommunityHero scorecard · ${scorecard.department}`
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto"><h2>Weekly department scorecard</h2><p>${scorecard.department}, here is your last-7-days performance summary:</p><ul><li>New reports: <b>${scorecard.new}</b></li><li>Resolved: <b>${scorecard.resolved}</b></li><li>Average resolution: <b>${scorecard.avg_resolution_hours == null ? '—' : `${scorecard.avg_resolution_hours} hours`}</b></li><li>AI-genuine validation rate: <b>${scorecard.ai_genuine_rate == null ? '—' : `${scorecard.ai_genuine_rate}%`}</b></li></ul><p><a href="${APP_URL}/dashboard">Open the authority dashboard →</a></p></div>`
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('RESEND_FROM') ?? 'Community Hero <onboarding@resend.dev>', to: [scorecard.to], subject, html }) })
    sent.push({ department: scorecard.department, to: scorecard.to, sent: response.ok })
  }
  return json({ since: weekStart, mock: !resendKey, scorecards, sent })
})
