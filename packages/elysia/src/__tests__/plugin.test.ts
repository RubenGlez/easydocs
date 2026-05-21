import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Elysia } from 'elysia'
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

function makeApp(config?: object) {
  return new Elysia()
    .use(easydocs(config as never))
    .get('/users', () => ({ data: [] }))
    .get('/users/:id', ({ params }) => ({ id: params.id }))
    .post('/users', () => ({ created: true }))
}

describe('elysia plugin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await makeApp().handle(new Request('http://localhost/users'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 })
    )
  })

  it('captures query params', async () => {
    await makeApp().handle(new Request('http://localhost/users?page=2&limit=10'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } })
    )
  })

  it('captures path params', async () => {
    await makeApp().handle(new Request('http://localhost/users/42'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } })
    )
  })

  it('captures response body', async () => {
    await makeApp().handle(new Request('http://localhost/users'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } })
    )
  })

  it('passes config to createCapturer', async () => {
    makeApp({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'my-api' })
    )
  })
})
