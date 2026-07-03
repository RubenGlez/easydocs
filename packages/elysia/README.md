# @easydocs/elysia

EasyDocs plugin for [Elysia](https://elysiajs.com/) (Bun-native). Generate accurate OpenAPI 3.0 specs from your API's real traffic — local-first and self-hostable, with an offline mode (Ollama) where nothing leaves your machine.

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

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard

# Or export to a file
npx easydocs export > openapi.json
```

See [@easydocs/core](../core) for the full configuration reference.
