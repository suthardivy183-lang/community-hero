import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mutations = new URL('../src/features/grievances/mutations.ts', import.meta.url)
const page = new URL('../src/pages/GrievanceAssistantPage.tsx', import.meta.url)

test('grievance lodging falls back to the available issue RPC when the richer intake RPC is not deployed', async () => {
  const source = await readFile(mutations, 'utf8')
  assert.match(source, /error\.code === 'PGRST202'/)
  assert.match(source, /error\.hint\?\.includes\('public\.create_issue'\)/)
  assert.match(source, /rpc\('create_issue'/)
  assert.match(source, /referenceLabel: 'Grievance ID'/)
})

test('the confirmation screen labels a fallback identifier honestly', async () => {
  const source = await readFile(page, 'utf8')
  assert.match(source, /referenceLabel/)
  assert.match(source, /\{created\.referenceLabel\}/)
})
