# @easydocs/fastify

EasyDocs plugin for [Fastify](https://fastify.dev/).

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
