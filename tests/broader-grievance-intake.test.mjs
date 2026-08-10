import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('grievance intake detects mixed languages and guards AI autofill by confidence', () => {
  const page = read('src/pages/GrievanceAssistantPage.tsx')
  assert.match(page, /detectLanguage\(message\)/)
  assert.match(page, /minimumAutoFillConfidence = 0\.72/)
  assert.match(page, /if \(confidence < minimumAutoFillConfidence\) return/)
  assert.match(page, /Mixed language detected/)
  assert.match(page, /mixed:\$\{detectedLanguage\.languages\.join\('\+'\)\}/)
  const marathiMarker = /(?:^|[\s\p{P}])(आहे|आणि|माझा|माझी|माझे|कृपया|झाले|करा|करून)(?:$|[\s\p{P}])/u
  assert.equal(marathiMarker.test('माझी तक्रार आहे'), true)
})

test('duplicate reports remain individual records and may be grouped under an incident', () => {
  const report = read('src/pages/ReportPage.tsx')
  const migration = read('supabase/migrations/20260811000100_broader_grievance_intake.sql')
  assert.match(report, /link_issue_to_infrastructure_incident/)
  assert.match(report, /own complaint number/)
  assert.match(migration, /infrastructure_incidents/)
  assert.match(migration, /unique \(issue_id\)/)
  assert.match(migration, /Only the reporter can group this complaint/)
})

test('edge intake returns language-aware clarification data', () => {
  const edge = read('supabase/functions/ai-extract-text/index.ts')
  assert.match(edge, /detectedLanguages/)
  assert.match(edge, /clarificationQuestions/)
  assert.match(edge, /confidence is below 0\.72/)
  assert.match(edge, /FALLBACK_COPY/)
  assert.match(edge, /same language mix/)
  assert.match(edge, /modelReply \|\| \(confidence < 0\.72 \? clarificationCopy\(replyLanguage\)\.reply/)
})
