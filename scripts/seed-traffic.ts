/**
 * Seed script — fires a realistic spread of requests against the test-api so
 * EasyDocs captures traffic and the AI generates OpenAPI specs for every endpoint.
 *
 * Usage:
 *   1. Start the test-api:  pnpm --filter @easydocs/test-api dev
 *   2. Run this script:     pnpm seed
 *
 * The test-api middleware captures every request automatically; no proxy needed.
 * AI processing is async — allow a few seconds after the script finishes before
 * checking the dashboard.
 */

const BASE = process.env.TEST_API_URL ?? 'http://localhost:4001'

let passed = 0
let failed = 0

async function req(
  label: string,
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string>; expectedStatus?: number } = {},
) {
  const { body, headers = {}, expectedStatus } = opts
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  try {
    const res = await fetch(`${BASE}${path}`, init)
    const ok = expectedStatus ? res.status === expectedStatus : res.ok || res.status < 500
    const icon = ok ? '✓' : '✗'
    console.log(`  ${icon} ${method.padEnd(6)} ${path.padEnd(30)} → ${res.status}  ${label}`)
    if (ok) { passed++ } else { failed++ }
    return res
  } catch (err) {
    console.log(`  ✗ ${method.padEnd(6)} ${path.padEnd(30)} → ERR  ${label}`)
    console.log(`    ${err}`)
    failed++
    return null
  }
}

async function main() {
  console.log(`\nSeeding traffic against ${BASE}\n`)

  // ── Health ──────────────────────────────────────────────────────────────────
  console.log('Health')
  await req('health check', 'GET', '/health')

  // ── Auth ────────────────────────────────────────────────────────────────────
  console.log('\nAuth')
  const loginRes = await req('login as Alice (admin)', 'POST', '/auth/login', {
    body: { email: 'alice@example.com', password: 'secret' },
    expectedStatus: 200,
  })
  const { token: aliceToken } = loginRes ? await loginRes.json() : { token: null }
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  const bobLoginRes = await req('login as Bob', 'POST', '/auth/login', {
    body: { email: 'bob@example.com', password: 'secret' },
    expectedStatus: 200,
  })
  const { token: bobToken } = bobLoginRes ? await bobLoginRes.json() : { token: null }

  await req('login — wrong password (401)', 'POST', '/auth/login', {
    body: { email: 'alice@example.com', password: 'wrong' },
    expectedStatus: 401,
  })
  await req('login — missing fields (400)', 'POST', '/auth/login', {
    body: { email: 'alice@example.com' },
    expectedStatus: 400,
  })
  await req('logout', 'POST', '/auth/logout', {
    headers: auth(aliceToken),
    expectedStatus: 200,
  })

  // ── Users ───────────────────────────────────────────────────────────────────
  console.log('\nUsers')
  await req('list all', 'GET', '/users')
  await req('filter by role=admin', 'GET', '/users?role=admin')
  await req('filter by role=user', 'GET', '/users?role=user')
  await req('search by name', 'GET', '/users?search=alice')
  await req('paginate page=1 limit=2', 'GET', '/users?page=1&limit=2')
  await req('get by id', 'GET', '/users/1')
  await req('get by id — not found (404)', 'GET', '/users/999', { expectedStatus: 404 })

  const createRes = await req('create user', 'POST', '/users', {
    body: { name: 'Dana Lee', email: 'dana@example.com', role: 'user' },
    expectedStatus: 201,
  })
  const newUser = createRes ? await createRes.json() : null

  await req('create user — duplicate email (409)', 'POST', '/users', {
    body: { name: 'Dup', email: 'alice@example.com' },
    expectedStatus: 409,
  })
  await req('create user — missing fields (422)', 'POST', '/users', {
    body: { name: 'No Email' },
    expectedStatus: 422,
  })

  if (aliceToken) {
    await req('update user (authenticated)', 'PUT', '/users/2', {
      headers: auth(aliceToken),
      body: { name: 'Bob Updated' },
      expectedStatus: 200,
    })
  }

  await req('update user — no auth (401)', 'PUT', '/users/1', {
    body: { name: 'X' },
    expectedStatus: 401,
  })

  if (newUser?.id && aliceToken) {
    await req('delete user (authenticated)', 'DELETE', `/users/${newUser.id}`, {
      headers: auth(aliceToken),
      expectedStatus: 204,
    })
  }
  await req('delete user — no auth (401)', 'DELETE', '/users/1', { expectedStatus: 401 })

  // ── Me ──────────────────────────────────────────────────────────────────────
  console.log('\nMe')
  if (aliceToken) {
    await req('get own profile', 'GET', '/me', { headers: auth(aliceToken) })
  }
  await req('get own profile — no auth (401)', 'GET', '/me', { expectedStatus: 401 })

  // ── Products ─────────────────────────────────────────────────────────────────
  console.log('\nProducts')
  await req('list all', 'GET', '/products')
  await req('filter by category', 'GET', '/products?category=electronics')
  await req('filter in stock', 'GET', '/products?inStock=true')
  await req('filter by price range', 'GET', '/products?minPrice=10&maxPrice=50')
  await req('get by id', 'GET', '/products/p1')
  await req('get by id — not found (404)', 'GET', '/products/p999', { expectedStatus: 404 })

  // ── Orders ───────────────────────────────────────────────────────────────────
  console.log('\nOrders')
  if (aliceToken) {
    const orderRes = await req('create order', 'POST', '/orders', {
      headers: auth(aliceToken),
      body: { items: [{ productId: 'p2', qty: 1 }] },
      expectedStatus: 201,
    })
    const newOrder = orderRes ? await orderRes.json() : null

    await req('list own orders', 'GET', '/orders', { headers: auth(aliceToken) })
    await req('list orders — filter by status', 'GET', '/orders?status=pending', {
      headers: auth(aliceToken),
    })

    if (newOrder?.id) {
      await req('get order by id', 'GET', `/orders/${newOrder.id}`, {
        headers: auth(aliceToken),
      })
    }
    await req('get order — not found (404)', 'GET', '/orders/o999', {
      headers: auth(aliceToken),
      expectedStatus: 404,
    })
  }

  await req('create order — no auth (401)', 'POST', '/orders', {
    body: { items: [{ productId: 'p1', qty: 1 }] },
    expectedStatus: 401,
  })

  if (bobToken) {
    await req('create order — insufficient stock (422)', 'POST', '/orders', {
      headers: auth(bobToken),
      body: { items: [{ productId: 'p3', qty: 9999 }] },
      expectedStatus: 422,
    })
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n${total} requests — ${passed} captured, ${failed} unexpected failures`)
  console.log('AI is processing the queue in the background.')
  console.log('Check the dashboard in a few seconds: http://localhost:4001\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
