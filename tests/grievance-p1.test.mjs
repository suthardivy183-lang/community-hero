import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = new URL('../supabase/migrations/20260810_p1_administration_accountability.sql', import.meta.url)
const triage = new URL('../src/components/admin/TriageBoard.tsx', import.meta.url)
const detail = new URL('../src/pages/IssueDetailPage.tsx', import.meta.url)
const app = new URL('../src/App.tsx', import.meta.url)

test('P1 protects officer assignment, supervisor escalation, documents, and appeals in the database', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /add value if not exists 'supervisor'/i)
  assert.match(sql, /create table if not exists public\.issue_assignments/i)
  assert.match(sql, /create table if not exists public\.issue_appeals/i)
  assert.match(sql, /add value if not exists 'audio'/i)
  assert.match(sql, /add value if not exists 'document'/i)
  assert.match(sql, /assign_issue_officer/i)
  assert.match(sql, /appeal_issue_resolution/i)
  assert.match(sql, /role = 'supervisor'/i)
})

test('P1 gives departments an accountable queue with officer, urgency, location, age, pending, and overdue controls', async () => {
  const source = await readFile(triage, 'utf8')
  assert.match(source, /Assign officer/i)
  assert.match(source, /Urgency/i)
  assert.match(source, /Location/i)
  assert.match(source, /Overdue/i)
  assert.match(source, /Pending/i)
  assert.match(source, /useAssignOfficer/i)
})

test('P1 lets citizens attach supporting records and appeal an unresolved completion', async () => {
  const [source, routes] = await Promise.all([readFile(detail, 'utf8'), readFile(app, 'utf8')])
  assert.match(source, /Supporting documents/i)
  assert.match(source, /audio\//i)
  assert.match(source, /Appeal to supervisor/i)
  assert.match(source, /useAppealIssueResolution/i)
  assert.match(routes, /supervisor/)
})
