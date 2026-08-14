import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// Black-box like the diff tests: the CLI dispatches on import.
const CLI = resolve(process.cwd(), 'dist/index.js')

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 10_000 })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

// `parseInt('abc')` is NaN and `server.listen(NaN)` silently binds a random
// port, so a typo'd --port used to start the proxy somewhere unpredictable
// instead of reporting the mistake.
describe('--port validation', () => {
  it('rejects a non-numeric port', () => {
    const r = run('proxy', '--port=abc')
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('Invalid --port value')
  })

  it('rejects an out-of-range port', () => {
    expect(run('proxy', '--port=70000').code).toBe(2)
    expect(run('proxy', '--port=0').code).toBe(2)
    expect(run('proxy', '--port=-1').code).toBe(2)
  })

  it('rejects a fractional port', () => {
    expect(run('proxy', '--port=80.5').code).toBe(2)
  })
})
