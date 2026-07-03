import { describe, it, expect } from 'vitest'
import { computeDrift, renderDrift, isEmptyDrift, driftCount } from '../spec/drift.js'

// "documented" = the spec you committed; "observed" = what EasyDocs saw in traffic.
const documented = {
  info: { title: 'My API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
}

const observed = {
  info: { title: 'API Documentation', version: '1.0.0' }, // metadata differs — must be ignored
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        responses: { '200': { description: 'Success' } }, // contradicts the docs
      },
    },
    '/orders': {
      post: { summary: 'Create an order' }, // seen in traffic, undocumented
    },
  },
}

describe('computeDrift', () => {
  it('flags endpoints observed in traffic but missing from the spec', () => {
    const report = computeDrift(documented, observed)
    expect(report.undocumented.some((f) => f.path.includes('/orders'))).toBe(true)
  })

  it('flags fields documented but contradicted by traffic', () => {
    const report = computeDrift(documented, observed)
    const mismatch = report.mismatch.find((f) => f.path.endsWith('200.description'))
    expect(mismatch?.documented).toBe('OK')
    expect(mismatch?.observed).toBe('Success')
  })

  it('flags endpoints documented but never observed', () => {
    // Drop /orders from the observed side: now it is documented-but-unobserved.
    const report = computeDrift(observed, documented)
    expect(report.unobserved.some((f) => f.path.includes('/orders'))).toBe(true)
  })

  it('ignores metadata differences outside the endpoint contract by default', () => {
    const report = computeDrift(documented, observed)
    const all = [...report.undocumented, ...report.unobserved, ...report.mismatch]
    expect(all.every((f) => f.path.startsWith('paths.'))).toBe(true)
    expect(all.some((f) => f.path.includes('info.title'))).toBe(false)
  })

  it('honors a custom scope of "" to compare the whole document', () => {
    const report = computeDrift(documented, observed, { scope: '' })
    expect(report.mismatch.some((f) => f.path.includes('info.title'))).toBe(true)
  })

  it('reports no drift for a spec that matches its traffic', () => {
    const report = computeDrift(documented, documented)
    expect(isEmptyDrift(report)).toBe(true)
    expect(driftCount(report)).toBe(0)
  })
})

describe('renderDrift', () => {
  it('renders a no-drift message in both modes', () => {
    const report = computeDrift(documented, documented)
    expect(renderDrift(report)).toContain('No API drift')
    expect(renderDrift(report, { markdown: true })).toContain('No API drift')
  })

  it('renders plain-text sections with a total count', () => {
    const txt = renderDrift(computeDrift(documented, observed))
    expect(txt).toMatch(/API drift: \d+ finding/)
    expect(txt).toContain('Undocumented')
    expect(txt).toContain('Mismatch')
    expect(txt).not.toContain('**')
  })

  it('renders markdown sections for PR comments', () => {
    const md = renderDrift(computeDrift(documented, observed), { markdown: true })
    expect(md).toContain('**API drift:')
    expect(md).toContain('**Undocumented')
    expect(md).toContain('→')
  })
})
