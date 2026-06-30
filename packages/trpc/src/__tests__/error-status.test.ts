import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initTRPC, TRPCError } from '@trpc/server'
import { easydocs } from '../index.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createCapturer: vi.fn(() => ({ capture: vi.fn() })) }
})

const { createCapturer } = await import('@easydocs/core')

function getCaptureMock() {
  const results = (createCapturer as ReturnType<typeof vi.fn>).mock.results
  return results[results.length - 1].value.capture as ReturnType<typeof vi.fn>
}

function makeCaller() {
  const t = initTRPC.create()
  const base = t.procedure.use(easydocs())
  const router = t.router({
    unauth: base.query(() => {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }),
    teapot: base.query(() => {
      // A code not present in tRPC's table → exercises the `?? 500` fallback.
      throw new TRPCError({ code: 'IM_A_TEAPOT' as never })
    }),
    errbody: base.query(() => {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'nope' })
    }),
  })
  return t.createCallerFactory(router)({})
}

describe('trpc error-status mapping (QA)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a non-404 code (UNAUTHORIZED → 401)', async () => {
    await expect(makeCaller().unauth()).rejects.toThrow()
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/trpc/unauth', status: 401 })
    )
  })

  it('falls back to 500 for an unmapped code', async () => {
    await expect(makeCaller().teapot()).rejects.toThrow()
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/trpc/teapot', status: 500 })
    )
  })

  it('captures the error message as the response body', async () => {
    await expect(makeCaller().errbody()).rejects.toThrow()
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/trpc/errbody', status: 403, response: { message: 'nope' } })
    )
  })
})
