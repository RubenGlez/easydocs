# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # watch-build all packages and apps in parallel
pnpm build            # build all packages then apps (order matters)
pnpm test             # run vitest across all packages
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # eslint across all packages
pnpm eval             # run promptfoo AI quality evals (requires API key in .env)
```

Run a single package's tests or typecheck:
```bash
pnpm --filter @easydocs/core test
pnpm --filter @easydocs/express typecheck
```

Run a specific test file:
```bash
node_modules/.bin/vitest run packages/core/src/__tests__/shape.test.ts
```

**Node.js version**: the workspace requires Node >=24. Use `nvm use 24` if the default is older — pnpm will refuse to run on v20.

## Architecture

### How it works end-to-end

1. A framework adapter (e.g. `@easydocs/express`) intercepts requests and responses
2. At setup time, the adapter calls `parseConfig(config)` then `createCapturer(parsedConfig)` from `@easydocs/core` to get a `Capturer` instance — storage adapter and queue are initialised here
3. Per request, the adapter calls `buildCaptureEvent()` to normalise raw framework data into a `CaptureEvent`, then `capturer.capture(event)` — fire and forget
4. The `Capturer` filters routes, checks response-shape hash to skip re-processing unchanged endpoints, then enqueues an async task
5. The background task calls `buildOperation(event, existingSpec, aiConfig)` — this is the AI call
6. The result is upserted into the `DatabaseAdapter` (SQLite or Postgres)
7. The dashboard (`apps/dashboard`) reads from the same database and renders live docs

### `packages/core` internals

The heart of the system. Key modules:

| File | Role |
|------|------|
| `capture.ts` | `createCapturer(config)` factory — returns a `Capturer` (`{ capture(event) }`) with per-instance adapter, queue, and warning state; filtering, shape-hash dedup, queue dispatch |
| `queue.ts` | `CaptureQueue` — serial async queue, one task at a time, swallows errors per-task; `flush()` drains deterministically |
| `event.ts` | `buildCaptureEvent(RawCaptureInput)` — normalises loose adapter types to strict `CaptureEvent` |
| `shape.ts` | `hashShape()` + `extractShape()` — structural fingerprint of a response body, key-order-stable, null-safe |
| `types.ts` | All shared types as Zod schemas; `parseConfig()` validates config at adapter setup time |
| `storage/adapter.ts` | `DatabaseAdapter` interface + `createAdapter()` factory — the seam between core and SQLite/Postgres |
| `storage/sqlite.ts` | SQLite implementation via `@libsql/client` + Drizzle ORM |
| `storage/postgres.ts` | Postgres implementation via `postgres` + Drizzle ORM |
| `ai/provider.ts` | `resolveModel()` — picks the Vercel AI SDK provider/model from config or env vars |
| `spec/auth.ts` | `AuthSchemeName` union, `SECURITY_SCHEME_DEFS`, `isAuthSchemeName()` type guard, `detectAuthSchemes()` — single source of truth for auth scheme logic |
| `spec/builder.ts` | `buildOperation()` — calls AI via `generateObject()` with `OperationSchema` |
| `spec/schema.ts` | `OperationSchema` — Zod schema for an OpenAPI 3.0 Operation object |
| `spec/assemble.ts` | `buildFullSpec()` — assembles a complete OpenAPI 3.0 document from stored operations |

### Adding a new framework adapter

Each adapter is ~50 lines. The pattern (see `packages/express/src/index.ts`):
1. Call `parseConfig(config)` at setup time — throws on invalid config immediately
2. Call `createCapturer(parsedConfig)` at setup time — initialises storage adapter and queue once
3. Hook into the framework's response lifecycle to capture method, path, query, params, body, response, status, headers, timing
4. Per request: call `buildCaptureEvent({ ... })` to normalise everything, then `capturer.capture(event)` — fire and forget, never await

### `vi.mock` pattern in adapter tests

Adapter tests mock `@easydocs/core` using `importOriginal` so that `parseConfig` and `buildCaptureEvent` remain functional — only `createCapturer` is mocked. It returns `{ capture: vi.fn() }` so tests can inspect individual capture calls:

```ts
vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createCapturer: vi.fn(() => ({ capture: vi.fn() })) }
})
const { createCapturer } = await import('@easydocs/core')

function getCaptureMock() {
  const results = (createCapturer as ReturnType<typeof vi.fn>).mock.results
  return results[results.length - 1].value.capture as ReturnType<typeof vi.fn>
}
```

"Passes config" assertions check `createCapturer` was called with the right options; per-request assertions call `getCaptureMock()` to get the `capture` spy for the most recent capturer instance.

### Storage

`DatabaseAdapter` (defined in `storage/adapter.ts`) is the interface both SQLite and Postgres implement. `createAdapter(storageConfig?)` returns the right implementation. Each `Capturer` instance (from `createCapturer()`) owns its own `DatabaseAdapter`, initialised at creation time — there is no module-level singleton.

### AI provider detection

`resolveModel(aiConfig?)` in `ai/provider.ts` picks the provider in this order: explicit `config.ai.provider` → explicit `config.ai.apiKey` present (→ OpenAI) → `ANTHROPIC_API_KEY` env → `DEEPSEEK_API_KEY` env → Ollama fallback.

### Evals

`apps/evals/` uses promptfoo to test AI output quality against fixtures. It loads the API key from the workspace root `.env` via `dotenvPath: ../../.env` in `promptfooconfig.yaml` and also via `process.loadEnvFile` in `provider.ts` for the provider subprocess. Run with `pnpm eval` from the workspace root.

## Release

```bash
pnpm release          # patch bump
pnpm release:minor
pnpm release:major
```

All packages are versioned in sync. The script in `scripts/release.mjs` bumps every `package.json`, commits, tags, and pushes — the publish CI workflow fires from the tag.
