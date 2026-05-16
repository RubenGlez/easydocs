# @easydocs/nextjs

EasyDocs handler wrapper for [Next.js](https://nextjs.org/) App Router and Pages Router.

> Next.js middleware runs in the Edge runtime and cannot access response bodies.
> EasyDocs wraps individual route handlers instead — no URL changes needed.

## Install

```bash
npm install @easydocs/nextjs
```

## App Router

```ts
// app/api/users/route.ts
import { withEasydocs } from '@easydocs/nextjs'
import { NextResponse } from 'next/server'

export const GET = withEasydocs(async (req) => {
  return NextResponse.json({ users: [] })
})

// with config
export const POST = withEasydocs(
  async (req) => {
    const body = await req.json()
    return NextResponse.json({ created: true }, { status: 201 })
  },
  { ai: { provider: 'anthropic' } }
)
```

Dynamic routes expose params automatically:

```ts
// app/api/users/[id]/route.ts
export const GET = withEasydocs(async (req, { params }) => {
  const { id } = await params
  return NextResponse.json({ id })
})
```

## Pages Router

```ts
// pages/api/users.ts
import { withEasydocsPagesHandler } from '@easydocs/nextjs'

export default withEasydocsPagesHandler((req, res) => {
  res.json({ users: [] })
})
```

## Configuration

```ts
withEasydocs(handler, {
  ai: { provider: 'openai', model: 'gpt-4o' },
  storage: { url: 'file:./docs.sqlite' },
  capture: { ignoreRoutes: ['/api/health'] },
})
```
