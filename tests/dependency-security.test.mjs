import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('dependencies have no high-severity audit findings', () => {
  let status = 0

  try {
    execFileSync('npm', ['audit', '--audit-level=high', '--json'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
  } catch (error) {
    status = error.status ?? 1
  }

  assert.equal(status, 0, 'npm audit found high-severity dependency issues')
})
