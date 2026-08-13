import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('a first incident message stays in clarification instead of opening the report review', () => {
  const page = read('src/pages/CommunityHeroAssistantPage.tsx')

  assert.ok(page.includes("type IntakeStep = 'initial' | 'followup'"))
  assert.ok(page.includes("intakeStep: IntakeStep = 'initial'"))
  assert.ok(page.includes("if (intakeStep === 'initial')"))
  assert.ok(page.includes("setIntakeStage('clarifying')"))
  assert.ok(page.includes("intakeStep === 'followup' && confidence >= minimumAutoFillConfidence"))
})

test('the text extraction contract tells the assistant whether it is an initial message or follow-up', () => {
  const client = read('src/lib/ai.ts')
  const edge = read('supabase/functions/ai-extract-text/index.ts')

  assert.ok(client.includes("intakeStep?: 'initial' | 'followup'"))
  assert.ok(edge.includes("intakeStep?: 'initial' | 'followup'"))
  assert.match(edge, /Always ask at least one focused follow-up question before report review/i)
})
