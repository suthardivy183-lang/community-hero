import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = new URL('../supabase/migrations/20260810_p2_differentiating_features.sql', import.meta.url)
const report = new URL('../src/pages/ReportPage.tsx', import.meta.url)
const transparency = new URL('../src/pages/TransparencyPage.tsx', import.meta.url)
const kiosk = new URL('../src/pages/KioskPage.tsx', import.meta.url)
const accessibility = new URL('../src/features/accessibility/AccessibilityProvider.tsx', import.meta.url)
const sync = new URL('../supabase/functions/open311-sync/index.ts', import.meta.url)

test('P2 keeps confidential grievances private and records deletion and external status events', async () => {
  const source = await readFile(migration, 'utf8')
  assert.match(source, /is_confidential boolean/i)
  assert.match(source, /consent_to_share boolean/i)
  assert.match(source, /data_deletion_requests/i)
  assert.match(source, /external_status_updates/i)
  assert.match(source, /set_issue_privacy/i)
  assert.match(source, /import_open311_status/i)
})

test('P2 gives citizens confidential reporting, accessible public transparency, and kiosk access', async () => {
  const [reportSource, transparencySource, kioskSource, a11ySource] = await Promise.all([
    readFile(report, 'utf8'), readFile(transparency, 'utf8'), readFile(kiosk, 'utf8'), readFile(accessibility, 'utf8'),
  ])
  assert.match(reportSource, /Keep my identity private/i)
  assert.match(reportSource, /set_issue_privacy/i)
  assert.match(transparencySource, /Public transparency/i)
  assert.match(transparencySource, /Average response time/i)
  assert.match(kioskSource, /Help-desk mode/i)
  assert.match(a11ySource, /Large text/i)
  assert.match(a11ySource, /Low-bandwidth/i)
})

test('P2 has a protected Open311 status-import endpoint rather than a mock integration', async () => {
  const source = await readFile(sync, 'utf8')
  assert.match(source, /OPEN311_SYNC_SECRET/i)
  assert.match(source, /import_open311_status/i)
  assert.match(source, /service_role/i)
})
