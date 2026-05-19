# Contributing

## Setup

```bash
git clone https://github.com/RubenGlez/easydocs
cd easydocs
pnpm install
```

## Repository Structure

```
packages/   ← publishable npm packages
apps/       ← internal apps (dashboard, test-api, evals)
docs/       ← project documentation and ADRs
```

## Working on a Package

```bash
# run tests for a specific package
pnpm --filter @easydocs/core test

# run tests for all packages
pnpm test

# type check
pnpm typecheck

# build all packages
pnpm build

# run AI quality evals (requires API key in .env)
pnpm eval
```

## Adding a New Framework Adapter

1. Create `packages/<framework>/` with its own `package.json`
2. Add `@easydocs/core` as a dependency
3. Implement the adapter — it must:
   - Call `parseConfig(config)` at setup time (throws on invalid config immediately)
   - Hook into the framework's request/response lifecycle
   - Call `buildCaptureEvent({ method, path, query, params, requestBody, responseBody, status, requestHeaders, responseHeaders, durationMs })` to normalise the data
   - Call `capture(event, parsedConfig)` — fire and forget, never await
4. Write integration tests using a real instance of the framework; mock only `capture` from `@easydocs/core` using the `importOriginal` pattern
5. Add an ADR documenting any framework-specific design decisions
6. Update `docs/ROADMAP.md` to move the framework from planned to done

## Adding a New AI Provider

1. Add the provider package from Vercel AI SDK (e.g. `@ai-sdk/groq`)
2. Update `packages/core/src/ai/provider.ts` — add the provider to `detectProvider()` and the `switch` in `resolveModel()`
3. Update the `AIConfigSchema` in `packages/core/src/types.ts` to include the new provider name in the `provider` enum
4. Add a test with a mocked provider response
5. Update `docs/adr/0004-multi-provider-ai.md`

## Architecture Decisions

Any significant technical decision should be recorded as an ADR in `docs/adr/`. Use the existing files as a template. Number sequentially.

## Commit Convention

```
feat: add fastify adapter
fix: handle empty response body in express adapter
docs: update roadmap with h3 adapter status
chore: bump vercel ai sdk to 5.x
```

## Pull Requests

- One concern per PR
- Tests required for new adapters and core changes
- ADR required for any decision that changes architecture or defaults
