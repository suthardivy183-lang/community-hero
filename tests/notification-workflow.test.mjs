import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260805_role_notifications.sql', import.meta.url)
const queryPath = new URL('../src/features/notifications/queries.ts', import.meta.url)

test('status changes notify the reporter, including authority rejection', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /insert into public\.notifications/i)
  assert.match(sql, /new\.reporter_id is distinct from auth\.uid\(\)/i)
  assert.doesNotMatch(sql, /new\.status\s*<>\s*'rejected'/i)
  assert.match(sql, /Report rejected/i)
})

test('escalations notify the assigned authority and level-two superadmins once', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /p\.role\s*=\s*'authority'.*p\.department_id\s*=\s*r\.department_id/is)
  assert.match(sql, /v_target\s*>=\s*2.*p\.role\s*=\s*'superadmin'/is)
  assert.match(sql, /dedupe_key/i)
  assert.match(sql, /on conflict/i)
})

test('new escalations dispatch the department email function', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /net\.http_post/i)
  assert.match(sql, /notify-department/i)
  assert.match(sql, /'escalation'/i)
  assert.match(sql, /cron\.schedule/i)
})

test('notification realtime and frontend reads are scoped to the signed-in user', async () => {
  const [sql, query] = await Promise.all([
    readFile(migrationPath, 'utf8'),
    readFile(queryPath, 'utf8'),
  ])

  assert.match(sql, /alter publication supabase_realtime add table public\.notifications/i)
  assert.match(query, /\.eq\('user_id', userId\)/)
})
