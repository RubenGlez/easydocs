# @easydocs/elysia

EasyDocs plugin for [Elysia](https://elysiajs.com/) (Bun-native).

## Install

```bash
bun add @easydocs/elysia
```

## Usage

```ts
import { Elysia } from 'elysia'
import { easydocs } from '@easydocs/elysia'

const app = new Elysia()
  .use(easydocs())
  .get('/users', () => ({ users: [] }))
  .listen(3000)
```

## Configuration

```ts
app.use(easydocs({
  ai: { provider: 'openai', model: 'gpt-4o' },
  capture: { ignoreRoutes: ['/health'] },
}))
```
