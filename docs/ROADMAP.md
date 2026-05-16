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
- [ ] `@easydocs/nextjs` — App Router and Pages Router support
- [ ] `@easydocs/h3` — h3/Nitro/Nuxt support
- [ ] `@easydocs/elysia` — Bun-native Elysia support
- [ ] `@easydocs/trpc` — tRPC procedure interceptor

### Storage
- [ ] Postgres adapter for shared team storage
- [ ] Conflict detection: flag when real traffic contradicts existing spec

### Dashboard
- [ ] Diff view: show what changed between spec versions
- [ ] Spec version history
- [ ] Manual spec editing with merge conflict UI
- [ ] Authentication flow detection and documentation

### DX
- [ ] `npx easydocs` CLI — proxy mode for documenting third-party APIs
- [ ] `npx easydocs export` — export spec from CLI without running the server

---

## v3 — Advanced Features

Goal: features that make EasyDocs the go-to tool for API documentation in teams.

- [ ] Multiple project support (separate spec per project/service)
- [ ] Webhook notifications when specs change
- [ ] GitHub Actions integration — post spec diffs to PRs
- [ ] Spec linting and validation suggestions
- [ ] Auto-generated code examples in dashboard
- [ ] Public shareable doc links
