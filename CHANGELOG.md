# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
