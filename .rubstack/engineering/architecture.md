---
name: architecture
description: EasyDocs engineering architecture, stack, and CI/CD pipeline
metadata:
  type: project
---

# Architecture

## Overview

See `AGENTS.md` at the repo root for the detailed end-to-end flow, module inventory, and adapter pattern. This file covers operational architecture (CI/CD) and open engineering questions.

## Components

See `AGENTS.md` → "Architecture" and "packages/core internals" sections.

## Data flow

See `AGENTS.md` → "How it works end-to-end".

## Stack

- Language: TypeScript
- Runtime: Node.js ≥24
- Package manager: pnpm workspaces
- Framework adapters: Express, Fastify, Hono, NestJS, Next.js, h3, Elysia
- AI abstraction: Vercel AI SDK (`generateText`) — specs are generated as JSON and validated against `OperationSchema` with retry, for cross-provider compatibility
- Database/storage: SQLite via `@libsql/client` + Drizzle ORM (default); Postgres via `postgres` + Drizzle ORM (opt-in)
- Dashboard: Next.js (`apps/dashboard`)
- Testing: Vitest
- Evals: promptfoo (`apps/evals`)

## Privacy / PII detection

Deterministic PII/secret detection on captured payloads. Module: `packages/core/src/privacy/`.

- Pure detection: regex + key-name heuristics, NO AI and NO network, so it runs identically in fully-offline mode. Deliberate: detection must be deterministic because its job is to keep sensitive values away from hosted AI providers — you cannot use the AI to decide what to hide from the AI.
- Detector shape: `detect(event) -> { redactedEvent, sensitivePaths }`.
- Pipeline: runs in the capture path BEFORE `buildOperation` (`spec/builder.ts` / `capture.ts`). Flow: detect → redact values → AI builds the spec from the redacted event → post-process the returned `Operation` to stamp the OpenAPI vendor extension `x-easydocs-sensitive: true` on matching schema properties.
- Redaction applies only when the AI provider is HOSTED (openai / anthropic / deepseek). It is SKIPPED for Ollama, which is already local — seeing real values there helps spec accuracy and nothing leaves the machine.
- Constraint: `detectAuthSchemes` (`spec/auth.ts`) reads the Authorization header but matches only the scheme prefix (`Bearer `/`Basic `), not the token. Redaction must preserve the scheme prefix (e.g. `Bearer [REDACTED]`) rather than dropping the whole header, or auth detection breaks.
- Flags are stored as the `x-easydocs-sensitive` vendor extension on schema properties — NO new database table and no storage migration. The flags ride along with the spec through the dashboard and JSON/YAML export.
- Config: new `privacy` block in `EasyDocsConfigSchema` (`packages/core/src/types.ts`): `enabled` (default true), `customRules`, `allowlist`, `placeholder` (default `[REDACTED]`).

## CI spec-diff / GitHub Action

Posts field-level spec diffs as PR comments.

- Single source of truth: `diffSpecs` and the `SpecDiff` type live in `packages/core/src/spec/diff.ts` — a PURE module with no storage/AI deps — moved there from `apps/dashboard/src/lib/diff.ts` (the old dashboard file is removed). They are exposed BOTH via the core barrel and a dedicated subpath export `@easydocs/core/spec/diff`. The module also exports `renderDiff` (terminal + Markdown). The dashboard's client component imports `diffSpecs` from the `@easydocs/core/spec/diff` SUBPATH, not the barrel.
- Architectural rule: client-bundled code (anything in the Next.js dashboard's client components) must import runtime values from a leaf subpath, never the `@easydocs/core` barrel — the barrel re-exports node-only storage deps (`@libsql/client`, `postgres`) that break the browser bundle.
- New CLI command `easydocs diff <before> <after> [--markdown]` reads two committed OpenAPI spec files (JSON or YAML, auto-detected), runs `diffSpecs`, and prints a human-readable summary or (with `--markdown`) a PR-comment-ready Added/Removed/Changed report. Stateless: pure file IO, no database, no AI provider — deterministic and needs no provider key in CI.
- Repo-root composite Action (`action.yml`) wraps it for PRs: fetches the base branch's version of the committed spec file, runs `easydocs diff` against the PR's version, and upserts a single sticky PR comment (marker-based update-in-place) via `actions/github-script` with `GITHUB_TOKEN`. Requires `pull-requests: write`. The CI model is "compare the committed spec file, base vs PR" — NOT capturing live traffic in CI.
- No data-model change, no migration.

### PR spec-diff, deepened (breaking-change gating + grouped output)

Deepens the CI spec-diff so the check can optionally fail the build on breaking changes and emit richer, per-Endpoint diff output. Everything is layered ON TOP of the existing pure module; nothing existing changes.

- Backward compatibility is load-bearing: `diffSpecs(before, after): SpecDiff` and the `SpecDiff` type in `packages/core/src/spec/diff.ts` stay UNCHANGED. The dashboard version-history view and the 11 existing unit tests depend on the flat-path `SpecDiff` shape, so the new work is a separate semantic layer rather than an edit to the existing contract.
- New semantic layer, all in the same pure module (exported via both the barrel and the `@easydocs/core/spec/diff` subpath):
  - `classifyDiff(diff, before, after)` — assigns each flat-path diff entry a severity (`breaking | non-breaking | additive`) and groups entries by Endpoint key `METHOD /path`, parsed from the `paths.<path>.<method>...` flat-path prefix. Entries not under `paths.` fall into an "Other" group.
  - An enriched Markdown renderer for PR comments: a summary line with counts and a breaking-change callout, changes grouped by Endpoint with severity badges, and collapsible `<details>` blocks for large diffs. The existing plain `renderDiff` (terminal + `--markdown`) stays available; this is an additional renderer, not a replacement.
  - A severity-aggregation helper the CLI uses to decide the exit code.
- Severity heuristics (v1, deterministic, zero-dep, operating on flat leaf paths). "Side" is read from the flat path: `.requestBody` / `.parameters` = request side, `.responses` = response side.
  - Breaking: removed Operation (whole path/method gone); removed response-side field; a newly-required request field/param; a `type` change on any schema field.
  - Additive: added Operation; added optional request field; added response field.
  - Non-breaking: description / summary / example / deprecated / cosmetic changes; removed request-side field.
  - This is a pragmatic heuristic, not a full OpenAPI semantic differ — it reasons over flat leaf paths, not the per-schema graph. The limitation is accepted deliberately for v1 (see non-goals).
- CLI exit-code contract for `easydocs diff` (new `--fail-on` flag): `0` = ok / no fail condition met, `2` = usage or unreadable-file error, `3` = fail-on threshold exceeded.
- Action flow (why the ordering matters): the composite action must ALWAYS post the sticky PR comment even when the build is going to fail. So the CLI step captures the exit code WITHOUT aborting (drop `set -e` for that step / `|| CODE=$?`), the comment is upserted first, and only then does the job fail — and only when the captured code is `3`. A new action input `fail-on` (default `none`) is passed straight through to the CLI `--fail-on`.
- Non-goals for v1: no dashboard severity UI; no external OpenAPI-diff library (the zero-dep heuristic is chosen deliberately to preserve the local-first / offline ethos); no per-schema-graph semantic analysis (flat-path heuristic only).

## CI/CD

### CI — `.github/workflows/ci.yml`

Runs on every push and PR to `main` on Node 24:

1. `pnpm install --frozen-lockfile`
2. Build all packages
3. Lint all packages
4. Typecheck all packages
5. Run tests

No secrets required.

### Eval gate — `.github/workflows/eval.yml`

Runs the cross-provider spec-accuracy gate (`pnpm gate`) on changes to `packages/core` or `apps/evals`. Needs repo secrets `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`; if none are set the gate skips (passes). See `apps/evals` for the ground-truth scoring harness and provider/model matrix.

### Publishing — local, no workflow

There is no publish workflow. Releases are cut locally from a machine with `NPM_TOKEN` in its environment, via the release script (`scripts/release.mjs`):

```sh
pnpm release           # patch bump
pnpm release:minor     # minor bump
pnpm release:major     # major bump
```

The script bumps all packages to one shared version, commits, tags `vX.Y.Z`, pushes, then `pnpm publish`es every package. No provenance attestations.

## Key decisions

See `.rubstack/adr/` for all Architecture Decision Records.

## Open questions / Future additions

### Dashboard deploy

Vercel GitHub integration (free Hobby tier) is the simplest option — import the repo, set root directory to `apps/dashboard`. Requires a Postgres database (Neon/Supabase free tier) since Vercel has no persistent filesystem for SQLite.

### Redaction scope for local Ollama

Whether PII/secret redaction should also apply when the AI provider is local Ollama. Current decision: no — values never leave the machine and real values improve spec accuracy. Revisit if local providers ever proxy to remote backends.

### CI spec-diff

Base spec absent on the base branch (first adoption) is handled as all-added rather than an error. The flat-path `SpecDiff` remains the storage/history shape; per-Endpoint grouping and breaking-change severity are now provided by the semantic layer (`classifyDiff` + enriched renderer) rather than by changing `SpecDiff`. Remaining follow-ups: surfacing severity in the dashboard UI, and moving from the flat-path heuristic to per-schema-graph semantic analysis.

### Changesets

Once packages have independent release cycles, adopt [Changesets](https://github.com/changesets/changesets) for automated changelog generation and per-package version bumps. For now, the custom release script (`scripts/release.mjs`) handles synchronized version bumps across all packages.
