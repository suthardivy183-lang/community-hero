import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const assistant = new URL('../src/pages/CommunityHeroAssistantPage.tsx', import.meta.url)
const map = new URL('../src/pages/HomePage.tsx', import.meta.url)
const detail = new URL('../src/pages/IssueDetailPage.tsx', import.meta.url)

test('map and grievance detail routes open the assistant with useful context', async () => {
  const [mapSource, detailSource] = await Promise.all([readFile(map, 'utf8'), readFile(detail, 'utf8')])

  assert.match(mapSource, /\/assistant\?context=map/)
  assert.match(detailSource, /\/assistant\?issue=\$\{id\}/)
})

test('the assistant has a multi-turn intake, voice states, evidence handoff, and explicit duplicate choices', async () => {
  const source = await readFile(assistant, 'utf8')

  assert.match(source, /intakeStage/)
  assert.match(source, /askClarification/)
  assert.match(source, /Transcribing…/)
  assert.match(source, /Understanding…/)
  assert.match(source, /type="file"/)
  assert.match(source, /\/report\?assistantEvidence=true/)
  assert.match(source, /Create new report/)
  assert.match(source, /Support existing complaint/)
  assert.match(source, /context === 'map'/)
})
