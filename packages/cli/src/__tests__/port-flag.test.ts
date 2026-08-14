import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// Black-box like the diff tests: the CLI dispatches on import.
const CLI = resolve(process.cwd(), 'dist/index.js')

// Each case boots a fresh Node process to run the bundle, which costs well over
// a second on a CI runner — comfortably past vitest's 5s default when several
// share one test. One case per `it`, with headroom.
const SPAWN_TIMEOUT_MS = 20_000

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

// `parseInt('abc')` is NaN and `server.listen(NaN)` silently binds a random
// port, so a typo'd --port used to start the proxy somewhere unpredictable
// instead of reporting the mistake.
describe('--port validation', () => {
  it.each([
    ['non-numeric', 'abc'],
    ['above the valid range', '70000'],
    ['zero', '0'],
    ['negative', '-1'],
    ['fractional', '80.5'],
  ])('rejects a %s port', (_label, value) => {
    const r = run('proxy', `--port=${value}`)
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('Invalid --port value')
  }, SPAWN_TIMEOUT_MS)
})
