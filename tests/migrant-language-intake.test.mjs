import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('the assistant recognises Gujarati written in English letters', () => {
  const language = read('src/lib/language.ts')
  const edge = read('supabase/functions/ai-extract-text/index.ts')
  const migrantExample = 'marvel homes ni samne moto khado padyo chhe ek accident pan thay gayu chhe'

  assert.match(language, /detectTransliteratedGujarati/)
  assert.match(language, /moto|khado|padyo|thay|chhe/)
  assert.match(edge, /detectTransliteratedGujarati/)
  assert.match(edge, /same language style, including Gujarati written in English letters/i)
  assert.match(migrantExample, /khado/)
})

test('the conversational intake preserves the original language across follow-up answers', () => {
  const page = read('src/pages/CommunityHeroAssistantPage.tsx')

  assert.match(page, /intakeReplyLanguage/)
  assert.match(page, /setIntakeReplyLanguage/)
  assert.match(page, /replyLanguage: replyLanguage ?? aiReplyLanguage/)
  assert.match(page, /askClarification(trimmed)/)
})

test('the AI prompt asks only for missing location and immediate-safety details before report review', () => {
  const edge = read('supabase/functions/ai-extract-text/index.ts')

  assert.match(edge, /Ask only for information that is missing/i)
  assert.match(edge, /exact location.*landmark.*pincode/i)
  assert.match(edge, /immediate danger or injury/i)
  assert.match(edge, /Do not ask again for facts already stated/i)
})
