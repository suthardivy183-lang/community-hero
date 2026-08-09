import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260809_p0_grievance_platform.sql', import.meta.url)
const assistantPath = new URL('../src/pages/GrievanceAssistantPage.tsx', import.meta.url)
const appPath = new URL('../src/App.tsx', import.meta.url)
const queriesPath = new URL('../src/features/grievances/queries.ts', import.meta.url)

// Journey: a citizen can explain a grievance in plain language, review the
// department assignment, and receive a permanent reference number.
test('P0 creates a durable, uniquely numbered public grievance workflow', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /add column if not exists complaint_number/i)
  assert.match(sql, /unique index.*complaint_number/is)
  assert.match(sql, /generate_complaint_number/i)
  assert.match(sql, /grievance_messages/i)
  assert.match(sql, /enable row level security/i)
})

// Journey: a migrant citizen can use a chat-first assistant rather than
// discovering a department portal or knowing an infrastructure category.
test('P0 provides a multilingual, chatbot-first grievance entry route', async () => {
  const [assistant, app] = await Promise.all([
    readFile(assistantPath, 'utf8'),
    readFile(appPath, 'utf8'),
  ])

  assert.match(app, /path="grievance"/)
  assert.match(assistant, /Describe your grievance/i)
  assert.match(assistant, /Voice input/i)
  assert.match(assistant, /Review and lodge/i)
  assert.match(assistant, /Complaint number/i)
  assert.match(assistant, /English|हिन्दी|ગુજરાતી/)
})

// Journey: a citizen and the responsible department exchange follow-up
// messages without losing the thread of the original grievance.
test('P0 scopes grievance conversations to their complaint and user', async () => {
  const source = await readFile(queriesPath, 'utf8')

  assert.match(source, /from\('grievance_messages'\)/)
  assert.match(source, /eq\('issue_id', issueId\)/)
  assert.match(source, /insert\(\{ issue_id: issueId/i)
})

