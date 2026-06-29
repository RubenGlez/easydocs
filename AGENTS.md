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
per-provider/model accuracy scoreboard).
