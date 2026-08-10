import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = new URL('../src/App.tsx', import.meta.url)
const header = new URL('../src/components/layout/Header.tsx', import.meta.url)
const assistant = new URL('../src/pages/GrievanceAssistantPage.tsx', import.meta.url)
const speech = new URL('../src/hooks/useSpeechRecognition.ts', import.meta.url)

test('the public grievance page is positioned as structured report intake, not a chatbot', async () => {
  const [routes, navigation] = await Promise.all([readFile(app, 'utf8'), readFile(header, 'utf8')])
  const page = await readFile(assistant, 'utf8')
  assert.match(routes, /path="grievance" element={<GrievanceAssistantPage \/>}/)
  assert.match(navigation, /nav\.report/i)
  assert.match(page, /Report a grievance/i)
  assert.doesNotMatch(page, /Multilingual AI chatbot/i)
})

test('the reporting assistant supports read-aloud AI analysis and regional voice languages', async () => {
  const [page, voice] = await Promise.all([readFile(assistant, 'utf8'), readFile(speech, 'utf8')])
  assert.match(page, /speechSynthesis/i)
  assert.match(page, /AI analysis/i)
  assert.match(page, /मराठी|বাংলা|தமிழ்/)
  assert.match(voice, /mr: 'mr-IN'/)
  assert.match(voice, /bn: 'bn-IN'/)
  assert.match(voice, /ta: 'ta-IN'/)
})
