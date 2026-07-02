# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-07-02

### Changed
- Documentation and positioning refresh: package descriptions and framework
  adapter READMEs now lead with trust and sovereignty (local-first, self-hostable,
  offline-capable) rather than the AI. No functional changes.

## [0.8.0] - 2026-07-02

### Added
- Fail-able PR spec diffs: `easydocs diff` now classifies each change as breaking,
  additive, or non-breaking, groups them by endpoint, and renders a richer report
  (summary line, breaking-change callout, severity badges, collapsible sections for
  large diffs). A new `--fail-on=none|breaking|any` flag turns the diff into an
  optional CI gate (exit code 3 when the threshold is crossed; `none` stays
  comment-only). The GitHub Action gained a matching `fail-on` input (default
  `none`) — it always posts the sticky comment first, then fails the job only on a
  breaking change, so existing workflows are unaffected.

## [0.7.0] - 2026-07-01

### Added
- PII / secret detection: EasyDocs spots sensitive fields (passwords, tokens,
  emails, card numbers, secrets) in captured traffic and redacts their values
  before anything is sent to a hosted AI provider (OpenAI/Anthropic/DeepSeek),
  so secrets never leave your machine; with a local Ollama model nothing is
  redacted because nothing leaves the machine. Detected fields are flagged in
  the spec and shown with a "sensitive" badge in the dashboard. On by default;
  configurable via a `privacy` block (enable/disable, custom placeholder,
  allowlist, custom rules).
- Spec diffs on pull requests: a new `easydocs diff <before> <after>` command
  reports the field-level changes (added/removed/changed) between two OpenAPI
  spec files, reads JSON or YAML, and takes a `--markdown` flag for PR-ready
  output. A reusable GitHub Action wraps this for committed-spec workflows: it
  diffs your spec against the PR's base branch and posts the changes as a
  sticky pull-request comment (updated in place). It's informational only and
  never fails the build.
- tRPC adapter: a new `@easydocs/trpc` package brings EasyDocs to tRPC (v11+).
  Attach the middleware to your base procedure and every procedure built from it
  is documented: queries as `GET /trpc/<procedure>`, mutations as
  `POST /trpc/<procedure>`.

## [0.6.0] - 2026-06-30

### Added
- Spec version history and diff view: the dashboard tracks how each endpoint's
  spec evolves over time, with a field-level diff between any two versions.

### Fixed
- Auto-detection falls back to a local Ollama server when no AI key is set
  (previously defaulted to OpenAI and failed without a key).
- Bumped the vite dev dependency to clear a high-severity advisory (dev-only).

### Docs
- Documented DeepSeek as a supported AI provider.

## [0.5.5] - 2026-06-30

### Fixed
- Spec generation now works across all AI providers. OpenAI and Anthropic
  previously generated zero specs because their strict structured-output APIs
  reject EasyDocs's open-ended schema fields; generation now uses provider-
  agnostic JSON output with client-side validation and retry.

### Improved
- More accurate, deterministic specs: only observed response status codes are
  documented, every observed field is captured, and tags and parameter
  requiredness are derived deterministically rather than guessed.
- Better spec quality on local models (Ollama) via an output example in the prompt.

## [0.5.4] - 2026-06-07

### Changed
- Stability and security line (0.4.x–0.5.x): Next.js 16 dashboard compatibility,
  dependency CVE patches, and internal architecture hardening. No user-facing
  feature changes.

## [0.3.0] - 2026-05-19

### Added
- Dashboard: syntax highlighting in the spec editor and an improved endpoint detail view.

## [0.2.0] - 2026-05-19

### Added
- DeepSeek AI provider and an upgrade to AI SDK v6.

## [0.1.1] - 2026-05-17

Initial release.

### Added
- Automatic OpenAPI documentation generated from real API traffic via a one-line middleware integration.
- Adapter-based architecture with SQLite (default) and Postgres storage.
- Multiple-project support, auth detection, security schemes, and response-conflict detection.
- Dashboard for viewing and manually editing generated specs.
