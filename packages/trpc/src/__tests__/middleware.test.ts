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

function makeCaller(config?: object) {
  const t = initTRPC.create()
  const base = t.procedure.use(easydocs(config as never))
  const router = t.router({
    getUser: base
      .input((v: unknown) => v as { id: string })
      .query(({ input }) => ({ id: input.id, name: 'Alice' })),
    createUser: base
      .input((v: unknown) => v as { name: string })
      .mutation(({ input }) => ({ created: true, name: input.name })),
    missing: base.query(() => {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }),
  })
  return t.createCallerFactory(router)({})
}

describe('trpc middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures a query as GET /trpc/<proc> with input as query params', async () => {
    await makeCaller().getUser({ id: '42' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/trpc/getUser',
        query: { id: '42' },
        status: 200,
      })
    )
  })

  it('captures the returned value as the response body', async () => {
    await makeCaller().getUser({ id: '42' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ response: { id: '42', name: 'Alice' } })
    )
  })

  it('captures a mutation as POST with input as the request body', async () => {
    await makeCaller().createUser({ name: 'Bob' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/trpc/createUser',
        body: { name: 'Bob' },
        status: 200,
      })
    )
  })

  it('maps a TRPCError to its HTTP status', async () => {
    await expect(makeCaller().missing()).rejects.toThrow()
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/trpc/missing', status: 404 })
    )
  })

  it('passes config to createCapturer', () => {
    makeCaller({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(expect.objectContaining({ project: 'my-api' }))
  })
})
