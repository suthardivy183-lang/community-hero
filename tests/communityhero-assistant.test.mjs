import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = new URL('../src/App.tsx', import.meta.url)
const header = new URL('../src/components/layout/Header.tsx', import.meta.url)
const page = new URL('../src/pages/CommunityHeroAssistantPage.tsx', import.meta.url)

test('the persistent CommunityHero Assistant is a separate authenticated route', async () => {
  const [routes, navigation] = await Promise.all([readFile(app, 'utf8'), readFile(header, 'utf8')])
  assert.match(routes, /path="assistant" element={<RequireAuth><CommunityHeroAssistantPage \/><\/RequireAuth>}/)
  assert.match(navigation, /CommunityHero Assistant/)
  assert.match(navigation, /navigate\('\/assistant'\)/)
})

test('the assistant queries only the signed-in citizen’s complaints and produces factual status answers', async () => {
  const source = await readFile(page, 'utf8')
  assert.match(source, /useMyGrievanceSummaries\(session\?\.user\.id\)/)
  assert.match(source, /What happened to my pothole complaint\?/) 
  assert.match(source, /STATUS_META/)
  assert.match(source, /I can only answer from your saved grievance records/i)
  assert.doesNotMatch(source, /localStorage/)
})

test('the assistant reuses the established AI, voice, duplicate, location, and confirmed-submission flows', async () => {
  const source = await readFile(page, 'utf8')

  assert.match(source, /extractFromText/)
  assert.match(source, /useSpeechRecognition/)
  assert.match(source, /useSimilarIssues/)
  assert.match(source, /LocationPicker/)
  assert.match(source, /useCreatePublicGrievance/)
  assert.match(source, /Confirm & Report/)
  assert.match(source, /mutateAsync/)
  assert.match(source, /create\.mutateAsync/)
  assert.match(source, /possible similar active reports/i)
})
