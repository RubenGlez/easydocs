import { describe, it, expect } from 'vitest'
import {
  diffSpecs,
  renderDiff,
  isEmptyDiff,
  classifyDiff,
  shouldFail,
  renderClassifiedDiff,
} from '../spec/diff.js'

const before = {
  paths: {
    '/users': {
      post: {
        summary: 'Create a user',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
}

const after = {
  paths: {
    '/users': {
      post: {
        summary: 'Register a user',
        responses: { '200': { description: 'OK' } },
        parameters: [{ name: 'email', in: 'query' }],
      },
    },
  },
}

describe('diffSpecs', () => {
  it('detects changed leaf fields', () => {
    const diff = diffSpecs(before, after)
    const summary = diff.changed.find((c) => c.path.endsWith('summary'))
    expect(summary?.before).toBe('Create a user')
    expect(summary?.after).toBe('Register a user')
  })

  it('detects added fields', () => {
    const diff = diffSpecs(before, after)
    expect(diff.added.some((a) => a.path.includes('parameters') && a.value === 'email')).toBe(true)
  })

  it('detects removed fields', () => {
    const diff = diffSpecs(after, before)
    expect(diff.removed.some((r) => r.path.includes('parameters'))).toBe(true)
  })

  it('reports an empty diff for identical specs', () => {
    const diff = diffSpecs(before, before)
    expect(isEmptyDiff(diff)).toBe(true)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.changed).toHaveLength(0)
  })

  it('treats a missing baseline as all-added', () => {
    const diff = diffSpecs({}, after)
    expect(diff.added.length).toBeGreaterThan(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.changed).toHaveLength(0)
  })
})

describe('renderDiff', () => {
  it('renders a no-changes message in both modes', () => {
    const empty = diffSpecs(before, before)
    expect(renderDiff(empty)).toContain('No API spec changes')
    expect(renderDiff(empty, { markdown: true })).toContain('No API spec changes')
  })

  it('renders markdown sections for added/changed', () => {
    const md = renderDiff(diffSpecs(before, after), { markdown: true })
    expect(md).toContain('**Added')
    expect(md).toContain('**Changed')
    expect(md).toContain('`')
    expect(md).toContain('→')
  })

  it('renders a plain-text summary by default', () => {
    const txt = renderDiff(diffSpecs(before, after))
    expect(txt).toMatch(/Added \(\d+\):/)
    expect(txt).toMatch(/Changed \(\d+\):/)
    expect(txt).not.toContain('**')
  })
})

// ─── Semantic classification ──────────────────────────────────────────────────

const classify = (a: unknown, b: unknown) => classifyDiff(diffSpecs(a, b), a, b)

// A response schema with the given properties on GET /users.
const respWith = (props: Record<string, unknown>) => ({
  paths: {
    '/users': {
      get: { responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: props } } } } } },
    },
  },
})

// A POST /users request body with the given `required` list.
const reqWith = (required: string[]) => ({
  paths: {
    '/users': {
      post: {
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, name: { type: 'string' } }, required } } },
        },
      },
    },
  },
})

describe('classifyDiff — severity', () => {
  it('flags a removed operation as breaking', () => {
    const withDelete = { paths: { '/users/{id}': { delete: { responses: { '204': { description: 'No Content' } } } } } }
    const cd = classify(withDelete, { paths: {} })
    expect(cd.severity).toBe('breaking')
    expect(cd.counts.breaking).toBeGreaterThan(0)
  })

  it('flags a removed response field as breaking', () => {
    const cd = classify(respWith({ id: { type: 'string' }, name: { type: 'string' } }), respWith({ id: { type: 'string' } }))
    expect(cd.severity).toBe('breaking')
  })

  it('flags a newly-required request field as breaking', () => {
    const cd = classify(reqWith(['email']), reqWith(['email', 'name']))
    expect(cd.severity).toBe('breaking')
  })

  it('flags a type change as breaking', () => {
    const cd = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'integer' } }))
    expect(cd.severity).toBe('breaking')
  })

  it('treats an added operation as additive', () => {
    const b = { paths: { '/users': { get: { responses: { '200': { description: 'OK' } } } } } }
    const a = { paths: { '/users': { get: { responses: { '200': { description: 'OK' } } }, post: { responses: { '201': { description: 'Created' } } } } } }
    const cd = classify(b, a)
    expect(cd.severity).toBe('additive')
    expect(cd.counts.breaking).toBe(0)
  })

  it('treats an added optional response field as additive', () => {
    const cd = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'string' }, name: { type: 'string' } }))
    expect(cd.severity).toBe('additive')
  })

  it('treats a description change as non-breaking', () => {
    const b = { paths: { '/users': { get: { summary: 'List users', responses: { '200': { description: 'OK' } } } } } }
    const a = { paths: { '/users': { get: { summary: 'List all users', responses: { '200': { description: 'OK' } } } } } }
    const cd = classify(b, a)
    expect(cd.severity).toBe('non-breaking')
    expect(cd.counts.breaking).toBe(0)
  })
})

describe('classifyDiff — grouping', () => {
  it('groups changes by METHOD /path and routes non-path changes to Other', () => {
    const b = { info: { title: 'API' }, paths: { '/users': { get: { summary: 'a' }, post: { summary: 'b' } } } }
    const a = { info: { title: 'My API' }, paths: { '/users': { get: { summary: 'aa' }, post: { summary: 'bb' } } } }
    const cd = classify(b, a)
    const names = cd.groups.map((g) => g.endpoint)
    expect(names).toContain('GET /users')
    expect(names).toContain('POST /users')
    expect(names).toContain('Other')
  })
})

describe('shouldFail', () => {
  const additive = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'string' }, name: { type: 'string' } }))
  const breaking = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'integer' } }))

  it('never fails under "none"', () => {
    expect(shouldFail(additive, 'none')).toBe(false)
    expect(shouldFail(breaking, 'none')).toBe(false)
  })

  it('fails under "breaking" only when a breaking change is present', () => {
    expect(shouldFail(additive, 'breaking')).toBe(false)
    expect(shouldFail(breaking, 'breaking')).toBe(true)
  })

  it('fails under "any" on any change', () => {
    expect(shouldFail(additive, 'any')).toBe(true)
    expect(shouldFail(breaking, 'any')).toBe(true)
  })
})

describe('renderClassifiedDiff', () => {
  it('reports no changes for an identical spec', () => {
    const cd = classify(before, before)
    expect(renderClassifiedDiff(cd, { markdown: true })).toContain('No API spec changes')
  })

  it('renders a breaking callout, grouping, and badges in markdown', () => {
    const cd = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'integer' } }))
    const md = renderClassifiedDiff(cd, { markdown: true })
    expect(md).toContain('⚠️')
    expect(md).toContain('breaking')
    expect(md).toContain('GET /users')
    expect(md).toContain('🔴')
    expect(md).toContain('`')
  })

  it('collapses a large endpoint group into <details>', () => {
    const many: Record<string, unknown> = {}
    for (let i = 0; i < 12; i++) many[`field${i}`] = { type: 'string' }
    const cd = classify(respWith({}), respWith(many))
    expect(renderClassifiedDiff(cd, { markdown: true })).toContain('<details>')
  })

  it('renders a plain-text summary without markdown', () => {
    const cd = classify(respWith({ id: { type: 'string' } }), respWith({ id: { type: 'integer' } }))
    const txt = renderClassifiedDiff(cd)
    expect(txt).not.toContain('**')
    expect(txt).toMatch(/change/)
  })
})
