# @easydocs/fastify

EasyDocs plugin for [Fastify](https://fastify.dev/). Generate accurate OpenAPI 3.0 specs from your API's real traffic — local-first and self-hostable, with an offline mode (Ollama) where nothing leaves your machine.

## Install

```bash
npm install @easydocs/fastify
```

## Usage

```ts
import Fastify from 'fastify'
import { easydocs } from '@easydocs/fastify'

const app = Fastify()
await app.register(easydocs)

// Your routes — nothing changes here
app.get('/users', async () => ({ users: [] }))

await app.listen({ port: 3000 })
```

## Configuration

```ts
await app.register(easydocs, {
  ai: {
    provider: 'openai',
    model: 'gpt-4o',
  },
  capture: {
    ignoreRoutes: ['/health'],
  },
})
```

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard

# Or export to a file
npx easydocs export > openapi.json
```

See [@easydocs/core](../core) for the full configuration reference.
