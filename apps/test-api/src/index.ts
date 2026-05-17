import express from 'express'
import { easydocs } from '@easydocs/express'

const app = express()
const PORT = parseInt(process.env.PORT ?? '4001', 10)

app.use(express.json())
app.use(easydocs({ project: 'test-api' }))

// ─── In-memory data ────────────────────────────────────────────────────────────

type User = { id: string; name: string; email: string; role: 'admin' | 'user'; createdAt: string }
type Product = { id: string; name: string; category: string; price: number; stock: number }
type Order = { id: string; userId: string; items: { productId: string; qty: number; unitPrice: number }[]; status: string; total: number; createdAt: string }

const users: User[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15T10:00:00Z' },
  { id: '2', name: 'Bob Jones', email: 'bob@example.com', role: 'user', createdAt: '2024-02-20T14:30:00Z' },
  { id: '3', name: 'Carol White', email: 'carol@example.com', role: 'user', createdAt: '2024-03-05T09:15:00Z' },
]

const products: Product[] = [
  { id: 'p1', name: 'Widget Pro', category: 'electronics', price: 49.99, stock: 120 },
  { id: 'p2', name: 'Gadget Plus', category: 'electronics', price: 29.99, stock: 45 },
  { id: 'p3', name: 'Basic Tool', category: 'tools', price: 9.99, stock: 200 },
]

const orders: Order[] = [
  {
    id: 'o1',
    userId: '1',
    items: [{ productId: 'p1', qty: 2, unitPrice: 49.99 }],
    status: 'delivered',
    total: 99.98,
    createdAt: '2024-04-01T08:00:00Z',
  },
]

// ─── Auth helper ───────────────────────────────────────────────────────────────

function authenticate(req: express.Request, res: express.Response): User | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return null
  }
  // Tokens are "token-<userId>" for demo purposes
  const userId = auth.replace('Bearer token-', '')
  const user = users.find((u) => u.id === userId) ?? null
  if (!user) res.status(401).json({ error: 'Invalid token' })
  return user
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }
  const user = users.find((u) => u.email === email)
  if (!user || password !== 'secret') {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  return res.json({ token: `token-${user.id}`, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

app.post('/auth/logout', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  res.json({ message: 'Logged out successfully' })
})

// ─── Users ─────────────────────────────────────────────────────────────────────

app.get('/users', (req, res) => {
  const page = parseInt(String(req.query.page ?? '1'), 10)
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10), 100)
  const role = req.query.role as string | undefined
  const search = req.query.search as string | undefined

  let results = [...users]
  if (role) results = results.filter((u) => u.role === role)
  if (search) results = results.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))

  const total = results.length
  const data = results.slice((page - 1) * limit, page * limit)

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
})

app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json(user)
})

app.post('/users', (req, res) => {
  const { name, email, role = 'user' } = req.body ?? {}
  if (!name || !email) {
    return res.status(422).json({ error: 'name and email are required', fields: ['name', 'email'] })
  }
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email already in use' })
  }
  const user: User = { id: String(users.length + 1), name, email, role, createdAt: new Date().toISOString() }
  users.push(user)
  return res.status(201).json(user)
})

app.put('/users/:id', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  const target = users.find((u) => u.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  const { name, email } = req.body ?? {}
  if (name) target.name = name
  if (email) target.email = email
  return res.json(target)
})

app.delete('/users/:id', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  const idx = users.findIndex((u) => u.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'User not found' })
  users.splice(idx, 1)
  return res.status(204).send()
})

// ─── Me ───────────────────────────────────────────────────────────────────────

app.get('/me', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  res.json({ user, orders: orders.filter((o) => o.userId === user.id).length })
})

// ─── Products ─────────────────────────────────────────────────────────────────

app.get('/products', (req, res) => {
  const category = req.query.category as string | undefined
  const minPrice = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined
  const maxPrice = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined
  const inStock = req.query.inStock === 'true'

  let results = [...products]
  if (category) results = results.filter((p) => p.category === category)
  if (minPrice !== undefined) results = results.filter((p) => p.price >= minPrice)
  if (maxPrice !== undefined) results = results.filter((p) => p.price <= maxPrice)
  if (inStock) results = results.filter((p) => p.stock > 0)

  res.json({ data: results, total: results.length })
})

app.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  return res.json(product)
})

// ─── Orders ───────────────────────────────────────────────────────────────────

app.post('/orders', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return

  const { items } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ error: 'items must be a non-empty array' })
  }

  const orderItems: Order['items'] = []
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return res.status(422).json({ error: `Product ${item.productId} not found` })
    if (product.stock < item.qty) return res.status(422).json({ error: `Insufficient stock for ${product.name}` })
    orderItems.push({ productId: product.id, qty: item.qty, unitPrice: product.price })
    product.stock -= item.qty
  }

  const total = orderItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
  const order: Order = { id: `o${orders.length + 1}`, userId: user.id, items: orderItems, status: 'pending', total, createdAt: new Date().toISOString() }
  orders.push(order)
  return res.status(201).json(order)
})

app.get('/orders', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  const status = req.query.status as string | undefined
  let results = orders.filter((o) => o.userId === user.id)
  if (status) results = results.filter((o) => o.status === status)
  res.json({ data: results, total: results.length })
})

app.get('/orders/:id', (req, res) => {
  const user = authenticate(req, res)
  if (!user) return
  const order = orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.userId !== user.id && user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  return res.json(order)
})

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`[test-api] Running on http://localhost:${PORT}`)
  console.log(`[test-api] Proxy via: npx easydocs proxy --project=test-api --port=3999`)
  console.log(`[test-api]   then hit: http://localhost:3999?target=http://localhost:${PORT}/users`)
})
