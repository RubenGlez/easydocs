# Stack

## Monorepo Tooling

| Tool | Purpose |
|------|---------|
| **pnpm workspaces** | Monorepo package management |
| **TypeScript** | Shared types across all packages |
| **tsup** | Package bundling (produces ESM + CJS for each package) |
| **Vitest** | Unit and integration testing |
| **Changesets** | Versioning and changelog generation |

## packages/core

| Tool | Purpose |
|------|---------|
| **Vercel AI SDK (`ai`)** | `generateObject()` with Zod schema — provider-agnostic AI layer |
| **`@ai-sdk/openai`** | OpenAI provider for Vercel AI SDK |
| **`@ai-sdk/anthropic`** | Anthropic provider for Vercel AI SDK |
| **`ollama-ai-provider`** | Ollama provider for Vercel AI SDK |
| **`better-sqlite3`** | Embedded SQLite storage (default, zero-config) |
| **`postgres`** | Postgres storage (opt-in, team use) |
| **Drizzle ORM** | Database schema and queries (both SQLite and Postgres) |
| **Zod** | OpenAPI OperationSchema validation and AI output typing |

## Framework Adapters

Each adapter has minimal dependencies — only what the target framework requires.

| Package | Runtime dependency |
|---------|--------------------|
| `@easydocs/express` | none (types only: `@types/express`) |
| `@easydocs/fastify` | none (types only: `@fastify/types`) |
| `@easydocs/hono` | none (types only: `hono`) |
| `@easydocs/nestjs` | `@nestjs/common`, `rxjs` (peer deps) |

## apps/dashboard

| Tool | Purpose |
|------|---------|
| **Next.js 15** | Dashboard application framework |
| **React 19** | UI rendering |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | Component primitives |
| **js-yaml** | YAML export |

## Why These Choices

**Vercel AI SDK** — abstracts over every AI provider with a consistent interface. `generateObject()` with Zod schemas gives structured output without prompt engineering workarounds. Adding a new provider is a one-line change.

**Drizzle ORM** — works with both SQLite and Postgres from the same schema definition. Lightweight, TypeScript-first, no heavy runtime.

**better-sqlite3** — synchronous, embedded, zero-config. No server process, no connection string, works anywhere Node.js runs.

**tsup** — minimal config, produces dual ESM/CJS output that works across all Node.js versions and bundlers. Critical for a library package.

**Vitest** — fast, ESM-native, compatible with the same TypeScript config used across the monorepo.

**Changesets** — standard for monorepo package versioning. Enables independent versioning of each adapter package.

## What Was Replaced

| Before | After | Reason |
|--------|-------|--------|
| Single Next.js app | Monorepo + packages | Distributable as npm packages |
| Proxy URL approach | Middleware packages | No URL changes, works transparently |
| OpenAI only | Multi-provider via Vercel AI SDK | No forced vendor lock-in |
| Postgres only | SQLite default + Postgres opt-in | Zero infra to get started |
| Swagger UI | Custom dashboard | Differentiator, better UX |
