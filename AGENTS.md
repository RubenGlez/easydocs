# EasyDocs

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

Read these for project context:

- `.harness/adr/0001-monorepo-structure.md`
- `.harness/adr/0002-middleware-first-distribution.md`
- `.harness/adr/0003-sqlite-default-storage.md`
- `.harness/adr/0004-multi-provider-ai.md`
- `.harness/adr/0005-custom-dashboard.md`
- `.harness/adr/0006-v1-framework-targets.md`
- `.harness/adr/0007-database-adapter-seam.md`
- `.harness/adr/0008-provider-agnostic-generation.md`
- `.harness/adr/0009-pii-secret-detection.md`
- `.harness/adr/0010-ci-spec-diff.md`
- `.harness/adr/0011-breaking-change-classification.md`
- `.harness/engineering/architecture.md`
- `.harness/engineering/features/github-actions-spec-diff.md`
- `.harness/engineering/features/pii-secret-detection.md`
- `.harness/engineering/features/pr-spec-diff-deepened.md`
- `.harness/engineering/features/spec-version-history.md`
- `.harness/engineering/features/trpc-adapter.md`
- `.harness/engineering/implementation-plan.md`
- `.harness/product/CONTEXT.md`
- `.harness/product/competitors.md`
- `.harness/product/idea.md`
- `.harness/product/product.md`
- `.harness/product/roadmap.md`
- `.harness/product/strategy.md`
- `.harness/product/ux.md`
- `.harness/qa/report.md`
<!-- doctier:end -->
