# Architecture

## Overview

EasyDocs is a monorepo of independent npm packages. Each framework adapter shares a common core that handles AI processing, storage, and spec building. The dashboard is a separate app that any adapter can point to.

## Repository Structure

```
easydocs/
├── packages/
│   ├── core/          ← AI, storage, spec builder (no framework dependency)
│   ├── express/       ← Express middleware adapter
│   ├── fastify/       ← Fastify plugin adapter
│   ├── hono/          ← Hono middleware adapter
│   ├── h3/            ← h3 / Nitro / Nuxt middleware adapter
│   ├── elysia/        ← Elysia (Bun) plugin adapter
│   ├── nestjs/        ← NestJS module + interceptor adapter
│   ├── nextjs/        ← Next.js App Router + Pages Router adapter
│   └── cli/           ← Proxy + export CLI (no framework needed)
├── apps/
│   ├── dashboard/     ← Custom docs UI (Next.js), auto-served on port 4999
│   ├── test-api/      ← Fixture Express app used for manual testing
│   └── evals/         ← promptfoo eval harness for AI spec quality
└── docs/
    ├── adr/           ← Architecture Decision Records
    └── *.md           ← Project documentation
```

## Data Flow

```
Incoming request
      │
      ▼
Framework adapter (express/fastify/hono/nestjs/h3/elysia/nextjs)
      │  intercepts req + res
      ▼
buildCaptureEvent(RawCaptureInput)
      │  normalises loose framework types → strict CaptureEvent
      ▼
capture(event, config)
      │  filters routes, checks response-shape hash, enqueues async task
      ▼
packages/core — background queue
      ├── AI Provider (OpenAI / Anthropic / DeepSeek / Ollama)
      │     └── generateObject() → OperationSchema (OpenAPI 3.0 Operation)
      ├── DatabaseAdapter (SQLite default / Postgres opt-in)
      │     └── upsert endpoint spec
      └── buildFullSpec()
            └── assembles full OpenAPI 3.0 document from stored operations
      │
      ▼
Dashboard reads spec from storage → renders live docs
```

## packages/core

The framework-agnostic heart of the system. Key modules:

| Module | Role |
|--------|------|
| `capture.ts` | Entry point called by all adapters; route filtering, shape-hash dedup, queue dispatch |
| `queue.ts` | Serial async queue — one task at a time, errors are swallowed per-task |
| `event.ts` | `buildCaptureEvent(RawCaptureInput)` — normalises loose adapter types to strict `CaptureEvent` |
| `shape.ts` | `hashShape()` / `extractShape()` — structural fingerprint of a response, key-order-stable and null-safe |
| `types.ts` | All shared types as Zod schemas; `parseConfig()` validates config at adapter setup time |
| `storage/adapter.ts` | `DatabaseAdapter` interface + `createAdapter()` factory |
| `storage/sqlite.ts` | SQLite implementation via `@libsql/client` + Drizzle ORM |
| `storage/postgres.ts` | Postgres implementation via `postgres` + Drizzle ORM |
| `ai/provider.ts` | `resolveModel()` — picks Vercel AI SDK provider/model from config or env vars |
| `spec/builder.ts` | `buildOperation()` — calls AI via `generateObject()` with `OperationSchema` |
| `spec/schema.ts` | `OperationSchema` — Zod schema for an OpenAPI 3.0 Operation object |
| `spec/assemble.ts` | `buildFullSpec()` — assembles a complete OpenAPI 3.0 document from stored operations |

Core has zero framework dependencies. It can run in Node.js, Bun, or Deno.

### CaptureEvent

```ts
interface CaptureEvent {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string                        // normalised, no query string
  query: Record<string, string>
  params: Record<string, string>      // path params e.g. { id: '42' }
  body: unknown                       // request body
  response: unknown                   // response body
  status: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  durationMs: number
}
```

Adapters build this via `buildCaptureEvent(RawCaptureInput)`, which accepts loose types (headers as `unknown`, etc.) and normalises them.

### Config

Config is validated at adapter setup time via `parseConfig()`, which throws a readable error on invalid input.

```ts
interface EasyDocsConfig {
  project?: string      // separate spec per service, default: 'default'
  ai?: {
    provider?: 'openai' | 'anthropic' | 'deepseek' | 'ollama'
    model?: string      // defaults per provider
    apiKey?: string     // falls back to env vars
    baseUrl?: string    // for Ollama
  }
  storage?: {
    type?: 'sqlite' | 'postgres'
    url?: string        // sqlite path or postgres connection string
    poolSize?: number   // postgres only
  }
  dashboard?: {
    autoStart?: boolean // spawn dashboard on first capture (dev only)
    port?: number       // default 4999
  }
  capture?: {
    ignoreRoutes?: string[]   // paths to skip e.g. ['/health', '/metrics']
    includePaths?: string[]   // allowlist (captures nothing else if set)
  }
}
```

## Framework Adapters

Each adapter's responsibility is narrow: intercept the framework's request/response lifecycle, call `buildCaptureEvent()` to normalise the data, call `core.capture()`. Nothing else. Config is parsed once at setup via `parseConfig()`.

### Express

Uses standard middleware signature `(req, res, next)`. Wraps `res.json()` to capture the response body.

### Fastify

Uses Fastify's `onSend` hook to capture after the response body is serialised.

### Hono

Uses Hono's middleware model, cloning the response body before it's consumed.

### h3 / Nitro / Nuxt

Uses h3's `onBeforeResponse` hook.

### Elysia (Bun)

Uses Elysia's `onAfterResponse` lifecycle hook.

### NestJS

Provides `EasyDocsModule.forRoot(config)` which registers a global `EasyDocsInterceptor`. The interceptor uses RxJS `tap` to capture response data after the handler completes. Also supports `@UseInterceptors(EasyDocsInterceptor)` per-controller or per-route.

### Next.js

Wraps route handlers for both App Router (`withEasyDocs(handler)`) and Pages Router (`withEasyDocsPages(handler)`).

## Dashboard

A separate Next.js application that:
- Reads the OpenAPI spec from the shared storage via `buildFullSpec()` from `@easydocs/core`
- Renders a custom endpoint explorer (not Swagger UI)
- Supports exporting the spec as JSON or YAML
- Shows a diff view when an endpoint's spec changes
- Can be auto-started as a child process by `core` when the first capture runs (`dashboard.autoStart: true`)

The dashboard connects to the same SQLite file (or Postgres instance) used by the middleware. No separate API layer is needed in local mode.

## Storage

SQLite is the default. No configuration required — the file lives at `~/.easydocs/db.sqlite`.

Postgres is available for teams who need shared, persistent storage across multiple instances.

Both backends implement `DatabaseAdapter` from `packages/core/src/storage/adapter.ts`. `createAdapter(storageConfig?)` returns the right implementation. `capture.ts` holds a module-level singleton — the adapter is initialised once on the first capture.

## AI Processing

`buildOperation(event, existingSpec, aiConfig)` receives a `CaptureEvent` and any existing spec for that endpoint. It returns an updated OpenAPI 3.0 Operation object validated against `OperationSchema`.

Processing is asynchronous and non-blocking — HTTP responses are never delayed. Capture events are queued and processed in the background via a serial `CaptureQueue`.

Provider selection order: explicit `config.ai.provider` → explicit `config.ai.apiKey` present (→ OpenAI) → `ANTHROPIC_API_KEY` env → `DEEPSEEK_API_KEY` env → Ollama fallback.

## Capture Strategy

Re-processing is skipped when the response shape hash for a `path + method` combination hasn't changed. `extractShape()` produces a structural fingerprint (field names and types, not values) that is key-order-stable and correctly distinguishes `null` from `undefined`. This keeps AI costs predictable in production — the AI only runs when something structurally new is observed.
