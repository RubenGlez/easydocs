---
name: implementation-plan
description: Implementation plan — deepen the PR spec diff with breaking-change classification and an optional fail-able CI check
metadata:
  type: project
---

# Implementation Plan

> **Status: shipped in v0.8.0 (2026-07-02).** Phase 1 below shipped as
> planned — see the `pr-spec-diff-deepened` feature spec and the QA report for the
> as-built details and verification. A follow-up added a black-box CLI test suite
> (`packages/cli/src/__tests__/diff-cli.test.ts`). Per the stop line in
> [[strategy]], this was the **last planned build phase**; the next work is
> distribution/reputation (launch blog post, outward-facing copy sweep,
> Optic-orphan outreach), not a new build phase. Everything remaining on the
> roadmap is demand-driven. The plan is retained below as the record of what was
> built.

Ships as one vertical slice touching core + cli + the repo-root composite Action
+ docs, in the same shape as the prior spec-version-history, pii-secret-detection
and github-actions-spec-diff features. It extends the comment-only spec diff
shipped in v0.7.0: adds breaking-change classification, richer grouped output,
and an opt-in build failure.

## Phase 1 — Breaking-change classification + fail-able check (single slice)

1. **Core — semantic layer.** In `packages/core/src/spec/diff.ts` (exported via
   the core barrel and the pure `@easydocs/core/spec/diff` subpath). Keep
   `diffSpecs`, `SpecDiff`, `renderDiff` and `isEmptyDiff` UNCHANGED — the
   dashboard and 11 existing tests depend on them. Add:
   - `classifyDiff(diff, before, after)` returning a severity per entry
     (`breaking | non-breaking | additive`) and entries grouped by endpoint.
     Endpoint keys come from the `paths.<path>.<method>...` flat-path prefix
     (`METHOD /path`); non-`paths.` entries fall under "Other".
   - a severity-aggregation helper (max severity / counts) for the exit-code
     decision.
   - an enriched Markdown renderer: a summary line + counts + a breaking
     callout, grouped-by-endpoint sections with severity badges, and `<details>`
     wrapping for large diffs. Keep the old renderer.
   Verify: new unit tests cover each severity rule + grouping + the empty diff;
   the existing dashboard build and diff tests still pass; the accuracy gate
   (`pnpm gate`, threshold 0.85) runs because `packages/core/**` changed — no
   accuracy impact expected (pure diff plumbing).

2. **CLI — `--fail-on` flag.** In `packages/cli/src/index.ts` add
   `--fail-on=none|breaking|any` (default `none`) to `easydocs diff`. Print the
   richer output, compute the aggregate severity, and honour this exit-code
   contract: `0` ok, `2` usage / unreadable file, `3` fail-on threshold exceeded
   (`breaking` = fail when any breaking change is present; `any` = fail when any
   change at all; `none` = never fail). Update the usage/help text. Verify: unit
   tests over fixture specs assert exit 0 with `--fail-on=none`, exit 3 with
   `--fail-on=breaking` on a breaking fixture, exit 0 with `--fail-on=breaking`
   on an additive-only fixture, and exit 2 on a missing file.

3. **Composite Action — pass-through + fail step.** In the repo-root
   `action.yml` add a `fail-on` input (default `none`) passed through to the CLI.
   Capture the CLI exit code WITHOUT aborting the step — do not let `set -e` kill
   it; use `... || CODE=$?` and stash `CODE` plus the Markdown in
   `$GITHUB_OUTPUT`. ALWAYS post/update the sticky PR comment first (the existing
   `<!-- easydocs-spec-diff -->` marker logic), THEN a final step fails the job
   only when the stored code is `3`. Document that `fail-on` defaults to
   comment-only (`none`) so existing adopters are unaffected. Verify: YAML is
   valid, lint/typecheck pass, and a local dry-run of
   `diff --markdown --fail-on=breaking` returns the right code and Markdown.

4. **Docs.** Update the README with the `--fail-on` flag and an action snippet
   showing `fail-on: breaking`. Verify: full
   `pnpm build && pnpm lint && pnpm typecheck && pnpm test` green.

## Out of scope (v1)

- Dashboard severity UI.
- An external OpenAPI-diff library (a zero-dep heuristic was chosen; see ADR
  0011).
- Per-schema-graph semantic analysis (flat-path heuristic only).
- CI providers other than GitHub Actions.
- Auto-regenerating the spec in CI.
