# EasyDocs

**Add one line. Get OpenAPI docs for free.**

EasyDocs is a middleware-first API documentation tool. Add it to your server and it automatically generates accurate, up-to-date OpenAPI 3.0 specs from real traffic — no spec files to write, no annotations to maintain.

```ts
import { easydocs } from '@easydocs/express'

app.use(easydocs())
// your routes stay exactly the same
```

The docs dashboard runs at `http://localhost:4999`.

## How it works

1. EasyDocs middleware intercepts every request and response
2. A background queue feeds the captured data to an AI model
3. The AI generates or updates an OpenAPI 3.0 Operation spec
4. The spec is stored in a local SQLite database
5. The dashboard reads from that database and renders live docs

Nothing blocks your request. The capture is fire-and-forget.

## Packages

| Package | Framework |
|---------|-----------|
| [`@easydocs/express`](./packages/express) | Express |
| [`@easydocs/fastify`](./packages/fastify) | Fastify |
| [`@easydocs/hono`](./packages/hono) | Hono |
| [`@easydocs/nestjs`](./packages/nestjs) | NestJS |

## Quick start

### Express

```bash
npm install @easydocs/express
```

```ts
import express from 'express'
import { easydocs } from '@easydocs/express'

const app = express()
app.use(express.json())
app.use(easydocs())
```

### Fastify

```bash
npm install @easydocs/fastify
```

```ts
import Fastify from 'fastify'
import { easydocs } from '@easydocs/fastify'

const app = Fastify()
await app.register(easydocs)
```

### Hono

```bash
npm install @easydocs/hono
```

```ts
import { Hono } from 'hono'
import { easydocs } from '@easydocs/hono'

const app = new Hono()
app.use(easydocs())
```

### NestJS

```bash
npm install @easydocs/nestjs
```

```ts
import { EasyDocsModule } from '@easydocs/nestjs'

@Module({
  imports: [EasyDocsModule.forRoot()],
})
export class AppModule {}
```

## Configuration

```ts
easydocs({
  ai: {
    provider: 'openai',       // 'openai' | 'anthropic' | 'ollama'
    model: 'gpt-4o',          // optional, sensible defaults per provider
    apiKey: '...',            // optional, falls back to env vars
  },
  storage: {
    url: 'file:./docs.sqlite', // optional, defaults to ~/.easydocs/db.sqlite
  },
  capture: {
    ignoreRoutes: ['/health', '/metrics'],
  },
  dashboard: {
    autoStart: true,           // spawn dashboard server on first capture (dev only)
    port: 4999,
  },
})
```

### AI provider detection

EasyDocs auto-detects the provider from environment variables:

| Env var | Provider used |
|---------|---------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `OPENAI_API_KEY` | OpenAI GPT |
| neither | Ollama (localhost:11434) |

Set `ai.provider` in config to override.

## Dashboard

The dashboard is a Next.js app at `apps/dashboard`, served on port 4999.

**Run manually:**
```bash
pnpm --filter @easydocs/dashboard dev
```

**Auto-start on first capture:**
```ts
easydocs({ dashboard: { autoStart: true } })
```

## Repository structure

```
packages/
  core/       ← AI, storage, spec building (shared by all adapters)
  express/    ← @easydocs/express
  fastify/    ← @easydocs/fastify
  hono/       ← @easydocs/hono
  nestjs/     ← @easydocs/nestjs
apps/
  dashboard/  ← docs UI (port 4999)
docs/
  ARCHITECTURE.md
  MISSION.md
  ROADMAP.md
  STACK.md
  adr/        ← architecture decision records
```

## Development

```bash
pnpm install
pnpm dev        # runs all packages and dashboard in parallel
pnpm build      # builds all packages
pnpm typecheck  # type checks all packages
```

## Contributing

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## License

MIT
