import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initTRPC } from '@trpc/server'
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
    // primitive (non-object) query input
    echo: base.input((v: unknown) => v as string).query(({ input }) => `got:${input}`),
    // mutation whose returned value should land in the response body
    create: base
      .input((v: unknown) => v as { name: string })
      .mutation(({ input }) => ({ id: '1', name: input.name })),
    // subscription must be skipped entirely
    onTick: base.subscription(async function* () {
      yield 1
    }),
  })
  return t.createCallerFactory(router)({})
}

describe('trpc middleware — QA coverage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('surfaces a primitive query input under an `input` key', async () => {
    await makeCaller().echo('hello')
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/trpc/echo', query: { input: 'hello' } })
    )
  })

  it('captures the mutation return value as the response body', async () => {
    await makeCaller().create({ name: 'Bob' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', response: { id: '1', name: 'Bob' } })
    )
  })

  it('does not capture subscriptions', async () => {
    const caller = makeCaller()
    const capture = getCaptureMock()
    const iterable = await caller.onTick()
    // consume one value so the procedure actually runs
    for await (const _ of iterable) break
    expect(capture).not.toHaveBeenCalled()
  })
})
