import { describe, it, expect } from 'vitest'
import { extractShape, hashShape } from '../shape.js'

describe('extractShape', () => {
  it('maps primitives to their type name', () => {
    expect(extractShape(1)).toBe('number')
    expect(extractShape('hello')).toBe('string')
    expect(extractShape(true)).toBe('boolean')
  })

  it('maps null to "null" — not "object"', () => {
    expect(extractShape(null)).toBe('null')
  })

  it('maps undefined to "undefined"', () => {
    expect(extractShape(undefined)).toBe('undefined')
  })

  it('maps arrays to a single-element array of the first item shape', () => {
    expect(extractShape([1, 2, 3])).toEqual(['number'])
    expect(extractShape(['a', 'b'])).toEqual(['string'])
  })

  it('maps an empty array to ["undefined"]', () => {
    expect(extractShape([])).toEqual(['undefined'])
  })

  it('maps objects recursively', () => {
    expect(extractShape({ id: 1, name: 'foo' })).toEqual({ id: 'number', name: 'string' })
  })

  it('sorts object keys so insertion order does not affect shape', () => {
    const a = extractShape({ b: 1, a: 2 })
    const b = extractShape({ a: 2, b: 1 })
    expect(a).toEqual(b)
  })

  it('distinguishes a null field from a nested object field', () => {
    const withNull = extractShape({ user: null })
    const withObject = extractShape({ user: { id: 1 } })
    expect(withNull).not.toEqual(withObject)
  })
})

describe('hashShape', () => {
  it('returns the same hash for structurally identical objects regardless of key order', () => {
    expect(hashShape({ b: 1, a: 2 })).toBe(hashShape({ a: 1, b: 2 }))
  })

  it('returns different hashes for different shapes', () => {
    expect(hashShape({ id: 1 })).not.toBe(hashShape({ id: 'one' }))
    expect(hashShape({ user: null })).not.toBe(hashShape({ user: { id: 1 } }))
  })

  it('returns the same hash for arrays of the same element type regardless of length', () => {
    expect(hashShape([1])).toBe(hashShape([1, 2, 3]))
  })
})
