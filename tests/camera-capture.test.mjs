import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportPagePath = new URL('../src/pages/ReportPage.tsx', import.meta.url)

test('reporting offers separate rear-camera photo, video, and gallery inputs', async () => {
  const source = await readFile(reportPagePath, 'utf8')

  assert.match(source, /ref=\{photoCameraRef\}[\s\S]*?accept="image\/\*"[\s\S]*?capture="environment"/)
  assert.match(source, /ref=\{videoCameraRef\}[\s\S]*?accept="video\/\*"[\s\S]*?capture="environment"/)
  assert.match(source, /ref=\{galleryRef\}[\s\S]*?accept="image\/\*,video\/\*"/)
  assert.match(source, />\s*Take photo\s*</)
  assert.match(source, />\s*Record video\s*</)
  assert.match(source, />\s*Choose from gallery\s*</)
})

test('gallery input does not force camera capture', async () => {
  const source = await readFile(reportPagePath, 'utf8')
  const galleryInput = source.match(/<input[\s\S]*?ref=\{galleryRef\}[\s\S]*?\/>/)?.[0]

  assert.ok(galleryInput, 'gallery input should exist')
  assert.doesNotMatch(galleryInput, /capture=/)
})
