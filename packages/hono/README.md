# @easydocs/hono

EasyDocs middleware for [Hono](https://hono.dev/). Works on Node.js, Cloudflare Workers, Bun, and Deno. Generate accurate OpenAPI 3.0 specs from your API's real traffic — local-first and self-hostable, with an offline mode (Ollama) where nothing leaves your machine.

## Install

```bash
npm install @easydocs/hono
```

## Usage

```ts
import { Hono } from 'hono'
import { easydocs } from '@easydocs/hono'

const app = new Hono()
app.use(easydocs())

// Your routes — nothing changes here
app.get('/users', (c) => c.json({ users: [] }))

export default app
```

## Configuration

```ts
app.use(easydocs({
  ai: {
    provider: 'ollama',
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
  },
}))
```

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard

# Or export to a file
npx easydocs export > openapi.json
```

See [@easydocs/core](../core) for the full configuration reference.
