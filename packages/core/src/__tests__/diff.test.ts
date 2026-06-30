import { describe, it, expect } from 'vitest'
import { diffSpecs, renderDiff, isEmptyDiff } from '../spec/diff.js'

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
