import type { IssueView } from './issues'

export interface RepairEstimate {
  cost: number
  costLabel: string
  durationHours: number
  manpower: number
  team: string
  department: string
}

interface Base {
  cost: number
  hours: number
  crew: number
  team: string
}

// Per-category baselines (₹ / hours / crew). Tuned for an Indian municipal context.
const TABLE: Record<string, Base> = {
  pothole: { cost: 8000, hours: 4, crew: 2, team: 'Road Repair Team' },
  road_damage: { cost: 15000, hours: 6, crew: 3, team: 'Road Repair Team' },
  broken_footpath: { cost: 10000, hours: 5, crew: 2, team: 'Civil Works Team' },
  manhole: { cost: 6000, hours: 3, crew: 2, team: 'Road Repair Team' },
  water_leak: { cost: 9000, hours: 4, crew: 2, team: 'Water Maintenance Crew' },
  drainage: { cost: 20000, hours: 8, crew: 4, team: 'Drainage Crew' },
  streetlight: { cost: 3500, hours: 2, crew: 1, team: 'Electrical Team' },
  power_hazard: { cost: 5000, hours: 3, crew: 2, team: 'Electrical Team' },
  traffic_signal: { cost: 25000, hours: 6, crew: 3, team: 'Signals Team' },
  garbage: { cost: 2000, hours: 2, crew: 2, team: 'Sanitation Crew' },
  illegal_dumping: { cost: 8000, hours: 4, crew: 3, team: 'Sanitation Crew' },
  public_property: { cost: 12000, hours: 5, crew: 2, team: 'Maintenance Team' },
  tree: { cost: 7000, hours: 3, crew: 3, team: 'Parks Team' },
  other: { cost: 5000, hours: 3, crew: 2, team: 'General Maintenance' },
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/**
 * Deterministic, explainable repair estimate. Scales the category baseline by
 * the 0–100 severity score (bigger problem → more cost/time/crew).
 */
export function estimateRepair(issue: IssueView): RepairEstimate {
  const base = TABLE[issue.category_slug ?? 'other'] ?? TABLE.other
  const score = issue.severity_score ?? (issue.severity ?? 5) * 10
  const factor = 0.6 + (score / 100) * 0.8 // ~0.6x (minor) → ~1.4x (critical)
  const cost = Math.round((base.cost * factor) / 100) * 100
  const durationHours = Math.max(1, Math.round(base.hours * factor))
  const manpower = score >= 80 ? base.crew + 1 : base.crew
  return {
    cost,
    costLabel: inr(cost),
    durationHours,
    manpower,
    team: base.team,
    department: issue.department_name ?? 'General / Other',
  }
}
