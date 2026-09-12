# EasyDocs

## Product direction

See `ROADMAP.md` for the wedge and pillars. One boundary matters when touching
the dashboard: it is the **local, producer-side cockpit** for the generated
spec (review/edit/approve, version history + diff, sensitive-field badges,
docs-vs-reality drift). It is deliberately **not** a hosted, consumer-facing
docs portal — no multi-tenant hosting, custom domains, theming, or a published
"try it out" aimed at your API's external consumers (that is ceded to
ReadMe/Mintlify/Scalar). Keep dashboard work serving the developer producing
the spec, not the external API consumer.

## Capture pipeline invariants

These are load-bearing and easy to undo by accident:

- `capture()` runs **synchronously inside the host app's response path**. It must
  never throw and must stay cheap — anything expensive belongs in the queue. Only
  bounded, early-exit work is acceptable there (that is why `size.ts` exists
  instead of `JSON.stringify().length`).
- Bodies arrive as **live objects, not JSON text**, so anything that walks them
  needs cycle protection. `JSON.stringify` throwing is not a safety net.
- Framework adapters must not consume a request or response body the handler also
  owns. Cloning a `Request`/`Response` after it has been read throws, and awaiting
  `.json()` on a stream never resolves — check the content type first, and clone
  before the handler runs, not after.
- The `ollama` provider must use `client.chat(model)`. The AI SDK's default
  OpenAI model targets `/v1/responses`, which Ollama and most OpenAI-compatible
  gateways do not implement.
- Default model IDs in `ai/provider.ts` get reviewed every release. Providers
  retire IDs, which breaks every user who never pinned `ai.model`.
- Postgres is an **optional peer dependency**, loaded via dynamic import so
  SQLite installs never pay for it. Don't re-export it from the package root.

## Release

Run `pnpm release` (or `release:minor` / `release:major`). The script
(`scripts/release.mjs`) requires a clean tree on `main` in sync with origin,
runs build + lint + typecheck + test + `pnpm audit --audit-level=high --prod`,
then bumps every package to one shared version, commits, tags `vX.Y.Z`, pushes
`main` + tag, and publishes all `packages/*` plus `@easydocs/dashboard` to npm.

Versioning is unified: all packages share one version, even when only one
changed. Publishing happens locally (npm auth on the release machine); the repo
is not set up for CI-triggered publish.

`apps/evals` is `private` and never published; it holds the AI spec-accuracy
eval harness (`pnpm --filter easydocs-evals eval`, and `pnpm matrix` for the
per-provider/model accuracy scoreboard). The published, human-readable results
live in `BENCHMARK.md` at the repo root; regenerate its table with
`pnpm --filter easydocs-evals matrix --markdown`. Publishing the benchmark is a
deliberate trust/reputation move — see `.harness/product/strategy.md`.

## CI

`.github/workflows/ci.yml` runs build + lint + typecheck + test + audit on every
push/PR. `.github/workflows/eval.yml` runs the accuracy gate (`pnpm gate`, i.e.
`matrix.ts --gate`) on changes to `packages/core/**` or `apps/evals/**`: it scores
one strong model per cloud provider and fails if any tested provider's mean drops
below `GATE_THRESHOLD` (default 0.85, env-overridable). Running across providers is
deliberate — it catches provider-compatibility breaks, not just accuracy drift.

The gate needs repo secrets `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
With none set (e.g. forks), it skips and passes rather than failing the build.

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
