import type { Database } from './database.types'

export type IssueStatus = Database['public']['Enums']['issue_status']
export type UserRole = Database['public']['Enums']['user_role']
export type AppLanguage = Database['public']['Enums']['app_language']

/** Row shape from the issues_view (lat/lng + joined names). */
export type IssueView = Database['public']['Views']['issues_view']['Row']

interface StatusMeta {
  label: string
  /** Tailwind text/bg color suffix mapped to a --color-status-* token. */
  tone: string
  description: string
  order: number
}

export const STATUS_META: Record<IssueStatus, StatusMeta> = {
  reported: { label: 'Reported', tone: 'status-reported', description: 'Awaiting community verification', order: 0 },
  community_verified: { label: 'Verified', tone: 'status-verified', description: 'Confirmed by neighbours', order: 1 },
  acknowledged: { label: 'Acknowledged', tone: 'status-acknowledged', description: 'Seen by the department', order: 2 },
  in_progress: { label: 'In Progress', tone: 'status-progress', description: 'Work underway', order: 3 },
  resolved: { label: 'Resolved', tone: 'status-resolved', description: 'Marked fixed — awaiting proof', order: 4 },
  ai_validated: { label: 'AI Validated', tone: 'status-validated', description: 'Fix confirmed by AI comparison', order: 5 },
  closed: { label: 'Closed', tone: 'status-closed', description: 'Resolved and closed', order: 6 },
  rejected: { label: 'Rejected', tone: 'status-rejected', description: 'Not actionable', order: 7 },
}

export const ALL_STATUSES = Object.keys(STATUS_META) as IssueStatus[]

/** Forward transitions an authority can move an issue through. */
export const NEXT_STATUSES: Partial<Record<IssueStatus, IssueStatus[]>> = {
  reported: ['acknowledged', 'rejected'],
  community_verified: ['acknowledged', 'rejected'],
  acknowledged: ['in_progress', 'rejected'],
  in_progress: ['resolved'],
  resolved: ['ai_validated', 'closed', 'in_progress'],
  ai_validated: ['closed'],
}

export function severityTone(severity: number): string {
  if (severity <= 3) return 'sev-low'
  if (severity <= 6) return 'sev-mid'
  return 'sev-high'
}

export function severityLabel(severity: number): string {
  if (severity <= 3) return 'Low'
  if (severity <= 6) return 'Moderate'
  if (severity <= 8) return 'High'
  return 'Critical'
}

/** 0–100 severity → label + design-token tone (reuses the sev-* ramp). */
export function severityScoreLevel(score: number): { label: string; tone: string } {
  if (score < 40) return { label: 'Low', tone: 'sev-low' }
  if (score < 70) return { label: 'Medium', tone: 'sev-mid' }
  if (score < 90) return { label: 'High', tone: 'sev-high' }
  return { label: 'Critical', tone: 'sev-high' }
}

export interface TrustTier {
  label: string
  /** Hex/oklch color for the tier badge. */
  color: string
}

/** 0–100 trust → Bronze / Silver / Gold / Hero. */
export function trustTier(score: number): TrustTier {
  if (score < 40) return { label: 'Bronze', color: 'oklch(58% 0.09 50)' }
  if (score < 70) return { label: 'Silver', color: 'oklch(72% 0.02 265)' }
  if (score < 85) return { label: 'Gold', color: 'oklch(78% 0.14 85)' }
  return { label: 'Hero', color: 'var(--color-primary)' }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Citizen',
  authority: 'Authority',
  volunteer: 'Volunteer Verifier',
  superadmin: 'Super Admin',
}

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
}
