import { describe, it, expect } from 'vitest'
import { exceedsJsonSize } from '../size.js'

describe('exceedsJsonSize', () => {
  it('agrees with JSON.stringify on the decision, both ways', () => {
    const cases: unknown[] = [
      null,
      42,
      'hello',
      { a: 1, b: 'two', c: [1, 2, 3] },
      { nested: { deep: { deeper: Array.from({ length: 50 }, (_, i) => ({ i })) } } },
      Array.from({ length: 500 }, (_, i) => ({ id: i, name: 'x'.repeat(20) })),
    ]

    for (const value of cases) {
      const actual = JSON.stringify(value)?.length ?? 0
      // Well clear of the estimate's slack in both directions.
      expect(exceedsJsonSize(value, actual * 4 + 100)).toBe(false)
      expect(exceedsJsonSize(value, Math.floor(actual / 4))).toBe(actual > 0)
    }
  })

  it('treats null and undefined as tiny', () => {
    expect(exceedsJsonSize(null, 10)).toBe(false)
    expect(exceedsJsonSize(undefined, 10)).toBe(false)
  })

  // The point of the early exit: an oversized payload costs `limit` bytes of
  // work, not its full size.
  it('bails out early instead of walking the whole payload', () => {
    let visited = 0
    const huge = {
      items: Array.from({ length: 100_000 }, (_, i) => ({
        get id() {
          visited++
          return i
        },
      })),
    }

    expect(exceedsJsonSize(huge, 100)).toBe(true)
    expect(visited).toBeLessThan(1000)
  })

  it('terminates on a self-referential object', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(() => exceedsJsonSize(cyclic, 1000)).not.toThrow()
  })

  it('does not treat a repeated sibling value as a cycle', () => {
    const shared = { a: 'x'.repeat(100) }
    expect(exceedsJsonSize({ one: shared, two: shared }, 50)).toBe(true)
  })
})
