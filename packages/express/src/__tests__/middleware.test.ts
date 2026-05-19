import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { easydocs } from '../index.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, capture: vi.fn() }
})

const { capture } = await import('@easydocs/core')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(easydocs())
  app.get('/users', (_req, res) => res.json({ data: [] }))
  app.get('/users/:id', (req, res) => res.json({ id: req.params.id }))
  app.post('/users', (req, res) => res.status(201).json(req.body))
  return app
}

describe('express middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await request(makeApp()).get('/users')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 }),
      {}
    )
  })

  it('captures query params', async () => {
    await request(makeApp()).get('/users?page=2&limit=10')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } }),
      {}
    )
  })

  it('captures path params', async () => {
    await request(makeApp()).get('/users/42')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } }),
      {}
    )
  })

  it('captures request body on POST', async () => {
    await request(makeApp()).post('/users').send({ name: 'Alice' })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' }, status: 201 }),
      {}
    )
  })

  it('captures response body', async () => {
    await request(makeApp()).get('/users')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } }),
      {}
    )
  })

  it('passes config to capture', async () => {
    const app = express()
    app.use(express.json())
    app.use(easydocs({ project: 'my-api' }))
    app.get('/ping', (_req, res) => res.json({ ok: true }))
    await request(app).get('/ping')
    expect(capture).toHaveBeenCalledWith(expect.anything(), { project: 'my-api' })
  })
})
