import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The CLI runs on import (top-level dispatch + process.exit), so it is tested
// black-box: spawn the built bundle and assert exit codes / output. This also
// exercises the bundled output, where a module-load ordering bug once slipped
// past static checks and unit tests.

const CLI = resolve(process.cwd(), 'dist/index.js')

let dir: string
const base = { openapi: '3.0.0', paths: { '/users': { get: { summary: 'List', responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } } } } } } } } }
// A response field's type changes string → integer: a breaking change.
const breaking = { openapi: '3.0.0', paths: { '/users': { get: { summary: 'List', responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } } } } } } }
// A new optional response field: additive only.
const additive = { openapi: '3.0.0', paths: { '/users': { get: { summary: 'List', responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } } } } } } } }

function p(name: string) { return join(dir, name) }
function run(...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, 'diff', ...args], { encoding: 'utf8' })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'easydocs-cli-'))
  writeFileSync(p('base.json'), JSON.stringify(base))
  writeFileSync(p('breaking.json'), JSON.stringify(breaking))
  writeFileSync(p('additive.json'), JSON.stringify(additive))
  // YAML variant of `additive` to prove the loader auto-detects YAML.
  writeFileSync(p('additive.yaml'), 'openapi: 3.0.0\npaths:\n  /users:\n    get:\n      summary: List\n      responses:\n        "200":\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  id:\n                    type: string\n                  name:\n                    type: string\n')
})

afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('easydocs diff — exit codes', () => {
  it('has a built bundle to test', () => {
    expect(existsSync(CLI)).toBe(true)
  })

  it('exits 0 for a breaking change under --fail-on=none (default comment-only)', () => {
    expect(run(p('base.json'), p('breaking.json'), '--fail-on=none').code).toBe(0)
  })

  it('exits 3 for a breaking change under --fail-on=breaking', () => {
    expect(run(p('base.json'), p('breaking.json'), '--fail-on=breaking').code).toBe(3)
  })

  it('exits 0 for an additive-only change under --fail-on=breaking', () => {
    expect(run(p('base.json'), p('additive.json'), '--fail-on=breaking').code).toBe(0)
  })

  it('exits 3 for any change under --fail-on=any', () => {
    expect(run(p('base.json'), p('additive.json'), '--fail-on=any').code).toBe(3)
  })

  it('exits 2 on a missing file', () => {
    expect(run(p('base.json'), p('nope.json'), '--fail-on=breaking').code).toBe(2)
  })

  it('exits 2 on an invalid --fail-on value', () => {
    expect(run(p('base.json'), p('breaking.json'), '--fail-on=bogus').code).toBe(2)
  })

  it('exits 2 on missing positional arguments', () => {
    expect(run('--markdown').code).toBe(2)
  })
})

describe('easydocs diff — output', () => {
  it('renders a grouped markdown report with a breaking callout and badge', () => {
    const { stdout } = run(p('base.json'), p('breaking.json'), '--markdown')
    expect(stdout).toContain('⚠️')
    expect(stdout).toContain('breaking')
    expect(stdout).toContain('GET /users')
    expect(stdout).toContain('🔴')
  })

  it('reports no changes for identical specs and exits 0', () => {
    const r = run(p('base.json'), p('base.json'), '--fail-on=any')
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('No API spec changes')
  })

  it('reads YAML input (additive change → exit 0 under --fail-on=breaking)', () => {
    expect(run(p('base.json'), p('additive.yaml'), '--fail-on=breaking').code).toBe(0)
  })
})
