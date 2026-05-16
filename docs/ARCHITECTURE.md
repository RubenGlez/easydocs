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
│   └── nestjs/        ← NestJS module + interceptor adapter
├── apps/
│   └── dashboard/     ← Custom docs UI (Next.js), auto-served on port 4999
└── docs/
    ├── adr/           ← Architecture Decision Records
    └── *.md           ← Project documentation
```

## Data Flow

```
Incoming request
      │
      ▼
Framework adapter (express/fastify/hono/nestjs)
      │  intercepts req + res
      ▼
CaptureEvent { method, path, query, body, response, status, headers, durationMs }
      │
      ▼
packages/core
      ├── AI Provider (OpenAI / Anthropic / Ollama)
      │     └── generateObject() → OperationSchema (OpenAPI 3.0 Operation)
      ├── Storage (SQLite default / Postgres opt-in)
      │     └── upsert endpoint spec
      └── Spec Builder
            └── assembles full OpenAPI 3.0 document from stored operations
      │
      ▼
Dashboard reads spec from storage → renders live docs
```

## packages/core

The framework-agnostic heart of the system. Exposes:

- **`CaptureEvent`** — the common interface all adapters produce
- **`capture(event: CaptureEvent, config: EasyDocsConfig)`** — main entry point called by adapters
- **`AIProvider`** — abstraction over OpenAI / Anthropic / Ollama
- **`StorageAdapter`** — abstraction over SQLite / Postgres
- **`SpecBuilder`** — assembles full OpenAPI 3.0 document from stored operations

Core has zero framework dependencies. It can run in Node.js, Bun, or Deno.

### CaptureEvent

```ts
interface CaptureEvent {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string           // normalized, no query string
  query: Record<string, string>
  params: Record<string, string>   // path params e.g. :id
  body: unknown
  response: unknown
  status: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  durationMs: number
}
```

### Config

```ts
interface EasyDocsConfig {
  ai: {
    provider: 'openai' | 'anthropic' | 'ollama'
    model?: string       // defaults per provider
    apiKey?: string      // falls back to env vars
    baseUrl?: string     // for Ollama
  }
  storage?: {
    type: 'sqlite' | 'postgres'
    path?: string        // sqlite: default ~/.easydocs/db.sqlite
    url?: string         // postgres: DATABASE_URL
  }
  dashboard?: {
    port?: number        // default 4999
    enabled?: boolean    // default true in dev, false in production
  }
  capture?: {
    ignoreRoutes?: string[]   // paths to skip e.g. ['/health', '/metrics']
    includePaths?: string[]   // allowlist (captures nothing else if set)
    maxBodySize?: number      // default 10kb
  }
}
```

## Framework Adapters

Each adapter's responsibility is narrow: intercept the framework's request/response lifecycle, build a `CaptureEvent`, call `core.capture()`. Nothing else.

### Express

```ts
import { easydocs } from '@easydocs/express'
app.use(easydocs(config))
```

Uses standard Express middleware signature `(req, res, next)`. Wraps `res.json()` to capture the response body after it's set.

### Fastify

```ts
import { easydocs } from '@easydocs/fastify'
fastify.register(easydocs, config)
```

Uses Fastify's `onResponse` hook to capture after the response is sent.

### Hono

```ts
import { easydocs } from '@easydocs/hono'
app.use(easydocs(config))
```

Uses Hono's middleware model, cloning the response body before it's consumed.

### NestJS

```ts
import { EasyDocsModule } from '@easydocs/nestjs'

@Module({
  imports: [EasyDocsModule.forRoot(config)],
})
export class AppModule {}
```

Provides a global `EasyDocsInterceptor` that uses NestJS's `NestInterceptor` interface and RxJS `tap` to capture response data. Also supports per-controller and per-route via `@UseInterceptors(EasyDocsInterceptor)`.

## Dashboard

A separate Next.js application that:
- Reads the OpenAPI spec from the shared storage
- Renders a custom endpoint explorer (not Swagger UI)
- Supports exporting the spec as JSON or YAML
- Shows a diff view when an endpoint's spec changes
- Is auto-started as a child process by `core` when the first capture runs (dev mode only)

The dashboard connects to the same SQLite file (or Postgres instance) used by the middleware. No separate API layer needed in local mode.

## Storage

SQLite is the default. No configuration required — the file lives at `~/.easydocs/db.sqlite` or a project-local path.

Postgres is available for teams who need shared, persistent storage across multiple instances.

Both adapters implement the same `StorageAdapter` interface from `core`.

## AI Processing

The AI layer receives a `CaptureEvent` and any existing spec for that endpoint. It returns an updated OpenAPI 3.0 Operation object (the `OperationSchema` Zod type).

Processing is asynchronous and non-blocking — the actual HTTP response is never delayed waiting for AI. Capture events are queued and processed in the background.

Provider selection is explicit in config, with automatic fallback to environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Capture Strategy

Capture is **sampling-based** in production mode: the same `path + method` combination is only re-processed when a structurally new response is observed (new fields, new status code). This keeps AI costs predictable.

In development mode, every request is captured and processed.
