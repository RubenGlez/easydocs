# Stack

## Monorepo Tooling

| Tool | Purpose |
|------|---------|
| **pnpm workspaces** | Monorepo package management |
| **TypeScript** | Shared types across all packages |
| **tsup** | Package bundling (produces ESM + CJS for each package) |
| **Vitest** | Unit and integration testing |
| **ESLint + typescript-eslint** | Linting across all packages |
| **Custom release script** | Synchronized version bumps, git tag, publish trigger |

## packages/core

| Tool | Purpose |
|------|---------|
| **Vercel AI SDK (`ai`)** | `generateObject()` with Zod schema — provider-agnostic AI layer |
| **`@ai-sdk/openai`** | OpenAI provider for Vercel AI SDK |
| **`@ai-sdk/anthropic`** | Anthropic provider for Vercel AI SDK |
| **`@ai-sdk/deepseek`** | DeepSeek provider for Vercel AI SDK |
| **`@libsql/client`** | Embedded SQLite storage (default, zero-config) |
| **`postgres`** | Postgres storage (opt-in, team use) |
| **Drizzle ORM** | Database schema and queries (both SQLite and Postgres) |
| **Zod** | `OperationSchema` for AI output typing; `EasyDocsConfigSchema` for runtime config validation |

## Framework Adapters

Each adapter has minimal dependencies — only what the target framework requires.

| Package | Runtime dependency |
|---------|--------------------|
| `@easydocs/express` | none (types only: `@types/express`) |
| `@easydocs/fastify` | none (types only: `fastify`) |
| `@easydocs/hono` | none (types only: `hono`) |
| `@easydocs/h3` | none (types only: `h3`) |
| `@easydocs/elysia` | none (types only: `elysia`) |
| `@easydocs/nestjs` | `@nestjs/common`, `rxjs` (peer deps) |
| `@easydocs/nextjs` | none (types only: `next`) |

## apps/dashboard

| Tool | Purpose |
|------|---------|
| **Next.js 15** | Dashboard application framework |
| **React 19** | UI rendering |
| **Tailwind CSS** | Styling |
| **CodeMirror 6** | JSON spec editor with syntax highlighting |
| **Zod** | Client-side spec validation in the editor (via `OperationSchema` from `@easydocs/core`) |
| **js-yaml** | YAML export |

## apps/evals

| Tool | Purpose |
|------|---------|
| **promptfoo** | Eval harness — runs `buildOperation()` against fixtures and grades AI output quality |

## Why These Choices

**Vercel AI SDK** — abstracts over every AI provider with a consistent interface. `generateObject()` with Zod schemas gives structured output without prompt engineering workarounds. Adding a new provider is a one-line change.

**Drizzle ORM** — works with both SQLite and Postgres from the same schema definition. Lightweight, TypeScript-first, no heavy runtime.

**`@libsql/client`** — async, embedded SQLite via libSQL. No server process, no connection string, works anywhere Node.js runs.

**tsup** — minimal config, produces dual ESM/CJS output that works across all Node.js versions and bundlers. Critical for a library package.

**Vitest** — fast, ESM-native, compatible with the same TypeScript config used across the monorepo.

**Custom release script** — all packages are versioned in sync (adapters have no independent release cycles yet). A simple script in `scripts/release.mjs` bumps all `package.json` versions, commits, tags, and pushes — triggering the publish workflow automatically.

## What Was Replaced

| Before | After | Reason |
|--------|-------|--------|
| Single Next.js app | Monorepo + packages | Distributable as npm packages |
| Proxy URL approach | Middleware packages | No URL changes, works transparently |
| OpenAI only | Multi-provider via Vercel AI SDK | No forced vendor lock-in |
| Postgres only | SQLite default + Postgres opt-in | Zero infra to get started |
| Swagger UI | Custom dashboard | Differentiator, better UX |
| TypeScript interfaces for config | Zod schemas + `parseConfig()` | Runtime validation with readable errors |
| Inline spec assembly per consumer | `buildFullSpec()` in core | Single source of truth for spec shape |
| `isPostgres` branching in capture | `DatabaseAdapter` interface | Storage details hidden behind a seam |
