import type { IssueView } from './issues'

export interface PriorityResult {
  score: number
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  tone: string
  reasons: string[]
}

const EMERGENCY = new Set(['power_hazard', 'manhole', 'traffic_signal', 'water_leak'])

function ageDays(iso: string | null): number {
  if (!iso) return 0
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

/**
 * Deterministic, fully-explainable priority (0–100) from severity, community
 * signal, reporter trust, surroundings, age and emergency risk. Returns the
 * score, level, and human-readable ✓ reasoning bullets.
 */
export function computePriority(issue: IssueView): PriorityResult {
  const severity = issue.severity_score ?? (issue.severity ?? 5) * 10
  const votes = issue.vote_count ?? 0
  const confirms = issue.confirm_count ?? 0
  const trust = issue.reporter_trust ?? 50
  const days = ageDays(issue.created_at)

  let score = 0
  const reasons: string[] = []

  score += severity * 0.4
  if (severity >= 70) reasons.push(`✓ High severity (${severity}/100)`)

  const community = Math.min(1, (votes + confirms) / 20) * 20
  score += community
  if (confirms > 0) reasons.push(`✓ ${confirms} community confirmation${confirms > 1 ? 's' : ''}`)
  if (votes > 0) reasons.push(`✓ ${votes} upvote${votes > 1 ? 's' : ''}`)

  score += (trust / 100) * 10
  if (trust >= 70) reasons.push('✓ Reported by a trusted citizen')

  if (issue.near_hospital) { score += 10; reasons.push('✓ Near a hospital') }
  if (issue.near_school) { score += 6; reasons.push('✓ Near a school') }

  if (issue.road_class && ['motorway', 'trunk', 'primary'].includes(issue.road_class)) {
    score += 6; reasons.push('✓ On a major / high-traffic road')
  } else if (issue.road_class && ['secondary', 'tertiary'].includes(issue.road_class)) {
    score += 3
  }

  score += Math.min(1, days / 7) * 8
  if (days >= 3) reasons.push(`✓ Open for ${Math.round(days)} days`)

  if (issue.category_slug && EMERGENCY.has(issue.category_slug)) {
    score += 10; reasons.push('✓ Emergency category — high accident/safety risk')
  }

  const final = Math.min(100, Math.max(0, Math.round(score)))
  const level: PriorityResult['level'] =
    final < 40 ? 'Low' : final < 70 ? 'Medium' : final < 90 ? 'High' : 'Critical'
  const tone = final < 40 ? 'sev-low' : final < 70 ? 'sev-mid' : 'sev-high'
  if (reasons.length === 0) reasons.push('✓ Routine maintenance item')
  return { score: final, level, tone, reasons }
}
