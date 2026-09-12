# EasyDocs

## Product boundary

The dashboard is the local, producer-side cockpit for the generated spec. It is deliberately not a hosted, consumer-facing docs portal (no multi-tenant hosting, custom domains, theming, public try-it-out); that space is ceded to ReadMe/Mintlify/Scalar. Dashboard work serves the developer producing the spec, not the external API consumer.

## Capture pipeline invariants

- `capture()` runs synchronously inside the host app's response path: never throw, stay cheap. Anything expensive belongs in the queue; only bounded, early-exit work is acceptable there (why `size.ts` exists instead of `JSON.stringify().length`).
- Bodies arrive as live objects, not JSON text, so anything that walks them needs cycle protection. `JSON.stringify` throwing is not a safety net.
- Framework adapters must not consume a request/response body the handler also owns. Cloning a `Request`/`Response` after it has been read throws, and awaiting `.json()` on a stream never resolves: check content type first, clone before the handler runs.
- The `ollama` provider must use `client.chat(model)`; the AI SDK's default OpenAI model targets `/v1/responses`, which Ollama and most OpenAI-compatible gateways do not implement.
- Default model IDs in `ai/provider.ts` get reviewed every release; providers retire IDs, which breaks users who never pinned `ai.model`.
- Postgres is an optional peer dependency loaded via dynamic import so SQLite installs never pay for it. Don't re-export it from the package root.

## Release conventions

- Publishing is local (npm auth on the release machine); the repo is not set up for CI-triggered publish.
- All packages share one version, even when only one changed.
- `apps/evals` is `private` and never published; it holds the AI spec-accuracy eval harness. Published results live in `BENCHMARK.md`; regenerating it is a deliberate trust/reputation move (see `.harness/product/strategy.md`).

## CI

The accuracy gate on `packages/core/**`/`apps/evals/**` scores one strong model per cloud provider; running across providers is deliberate, it catches provider-compatibility breaks, not just accuracy drift. It needs repo secrets `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; with none set (e.g. forks) it skips and passes rather than failing the build.

<!-- doctier:begin -->
## Project context

Managed by doctier — do not edit between the markers.

Entry points (read these first):

- `.harness/engineering/architecture.md`
- `.harness/engineering/implementation-plan.md`
- `.harness/product/product.md`

Further docs, by directory:

- `.harness/adr/` (11 docs)
- `.harness/engineering/` (1 docs)
- `.harness/engineering/features/` (5 docs)
- `.harness/product/` (6 docs)
- `.harness/qa/` (2 docs)
<!-- doctier:end -->
