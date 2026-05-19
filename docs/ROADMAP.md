# Roadmap

## v1 — Foundation

Goal: a working monorepo that developers can install and use with zero infrastructure.

### packages/core
- [x] `CaptureEvent` interface and config types
- [x] AI provider abstraction (OpenAI, Anthropic, Ollama) via Vercel AI SDK
- [x] SQLite storage with Drizzle ORM + `@libsql/client`
- [x] OpenAPI 3.0 Operation spec builder and updater
- [x] Background processing queue (non-blocking captures)
- [x] Sampling logic (skip re-processing identical response shapes)

### Framework adapters
- [x] `@easydocs/express` — middleware adapter
- [x] `@easydocs/fastify` — plugin adapter
- [x] `@easydocs/hono` — middleware adapter
- [x] `@easydocs/nestjs` — module + interceptor adapter

### apps/dashboard
- [x] Custom endpoint explorer UI
- [x] Endpoint list with method badges and path display
- [x] Request/response schema viewer
- [x] Export spec as JSON
- [x] Export spec as YAML
- [x] Auto-starts as child process on first capture (dev mode)

### DX
- [x] `pnpm dev` starts everything in dev mode
- [x] Single env var to switch AI provider
- [x] Clear getting-started README per package

---

## v2 — Ecosystem Expansion

Goal: broader framework support and team collaboration features.

### Framework adapters
- [x] `@easydocs/nextjs` — `withEasydocs(handler)` wrapper for App Router and Pages Router
- [x] `@easydocs/h3` — h3/Nitro/Nuxt plugin
- [x] `@easydocs/elysia` — Bun-native Elysia plugin

### Storage
- [x] Postgres adapter for shared team storage
- [x] Conflict detection: flag when real traffic contradicts a manually-edited spec

### Dashboard
- [x] Manual spec editing — inline editor with conflict resolution UI
- [x] Authentication flow detection — AI detects and documents auth patterns

### DX
- [x] `@easydocs/cli` — proxy mode (`npx easydocs`) + spec export (`npx easydocs export`)
- [x] Multiple project support (separate spec per project/service)
- [x] Runtime config validation with readable error messages (`parseConfig`)
- [x] AI spec quality eval harness (`apps/evals` — promptfoo)

---

## v3 — Advanced Features

Goal: features that make EasyDocs the go-to tool for API documentation in teams.

- [ ] tRPC adapter
- [ ] Spec version history and diff view
- [ ] Webhook notifications when specs change
- [ ] GitHub Actions integration — post spec diffs to PRs
- [ ] Spec linting and validation suggestions
- [ ] Auto-generated code examples in dashboard
- [ ] Public shareable doc links
