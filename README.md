# EasyDocs

**Add one line. Get OpenAPI docs from real traffic.**

EasyDocs watches your API traffic and uses AI to generate accurate, up-to-date OpenAPI 3.0 specs — automatically. No spec files to write, no annotations to maintain.

## Two ways to get started

### Option A — Zero code changes (proxy)

Route your requests through the EasyDocs proxy. Nothing to install in your project.

```bash
npx @easydocs/cli proxy --project=my-api --port=3999
```

Then send requests through the proxy:

```
http://localhost:3999?target=https://api.example.com/users
```

### Option B — Middleware (one line)

```bash
npm install @easydocs/express
```

```ts
import { easydocs } from '@easydocs/express'

app.use(easydocs({ project: 'my-api' }))
// all your existing routes stay the same
```

---

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard
# → http://localhost:4999
```

Or export to a file:

```bash
npx easydocs export > openapi.json
npx easydocs export --yaml > openapi.yaml
```

---

## How it works

1. Middleware (or proxy) intercepts every request and response
2. A background queue feeds the captured data to an AI model — nothing blocks your request
3. The AI generates or updates an OpenAPI 3.0 Operation object for that endpoint
4. Response-shape hashing skips re-processing when the structure hasn't changed
5. Specs are stored in SQLite (default) or Postgres
6. The dashboard reads from that database and renders live docs

---

## Framework adapters

| Package | Framework |
|---------|-----------|
| [`@easydocs/express`](./packages/express) | Express |
| [`@easydocs/fastify`](./packages/fastify) | Fastify |
| [`@easydocs/hono`](./packages/hono) | Hono |
| [`@easydocs/nestjs`](./packages/nestjs) | NestJS |
| [`@easydocs/nextjs`](./packages/nextjs) | Next.js (App Router + Pages Router) |
| [`@easydocs/h3`](./packages/h3) | h3 / Nitro / Nuxt |
| [`@easydocs/elysia`](./packages/elysia) | Elysia (Bun) |
| [`@easydocs/cli`](./packages/cli) | Proxy + export (no framework needed) |

---

## AI provider setup

Set one environment variable:

```bash
# OpenAI (default)
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# DeepSeek
DEEPSEEK_API_KEY=sk-...

# Ollama (local, no key needed)
# configure in code: easydocs({ ai: { provider: 'ollama' } })
```

EasyDocs auto-detects the provider from your environment. If no key is set, it falls back to Ollama at `localhost:11434`.

---

## Configuration

```ts
easydocs({
  project: 'my-api',          // separate spec per service, default: 'default'
  ai: {
    provider: 'openai',       // 'openai' | 'anthropic' | 'ollama' | 'deepseek'
    model: 'gpt-4o',
    apiKey: '...',            // optional, falls back to env vars
  },
  storage: {
    type: 'sqlite',           // 'sqlite' | 'postgres'
    url: 'file:./docs.sqlite',
  },
  capture: {
    ignoreRoutes: ['/health', '/metrics'],
    includePaths: ['/api'],
  },
  dashboard: {
    autoStart: true,          // spawn dashboard on first capture (dev only)
    port: 4999,
  },
})
```

---

## Multiple projects

Scope traffic from different services to separate specs:

```ts
// service-a
app.use(easydocs({ project: 'users-service' }))

// service-b
app.use(easydocs({ project: 'orders-service' }))
```

Switch between projects in the dashboard or scope the export:

```bash
npx easydocs export --project=users-service > users.json
```

---

## Repository structure

```
packages/
  core/       ← AI, storage, spec building (shared by all adapters)
  express/    ← @easydocs/express
  fastify/    ← @easydocs/fastify
  hono/       ← @easydocs/hono
  nestjs/     ← @easydocs/nestjs
  nextjs/     ← @easydocs/nextjs
  h3/         ← @easydocs/h3
  elysia/     ← @easydocs/elysia
  cli/        ← @easydocs/cli
apps/
  dashboard/  ← @easydocs/dashboard (docs UI)
  test-api/   ← fixture Express app for testing
evals/        ← promptfoo eval harness for AI spec quality
docs/
  ARCHITECTURE.md
  CICD.md
  MISSION.md
  ROADMAP.md
  STACK.md
```

## Development

```bash
pnpm install
pnpm dev        # runs all packages and dashboard in parallel
pnpm build      # builds all packages
pnpm lint       # lint all packages
pnpm typecheck  # typecheck all packages
pnpm test       # runs tests across all packages
pnpm eval       # runs AI spec quality evals (requires API key)
```

## Release

```bash
pnpm release           # patch bump → tag → publish
pnpm release:minor     # minor bump
pnpm release:major     # major bump
```

## License

MIT
