# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Hono and Next.js App Router lost every request body.** Both read the body
  after the route handler had already consumed it, which throws — so `requestBody`
  was silently documented as `null` on every POST/PUT/PATCH. Hono now reads through
  its own body cache; Next.js clones the request before invoking the handler.
- **Streaming responses hung the request.** The Hono, Next.js, and Elysia adapters
  awaited `.json()` on a clone of the response before returning it; on an open SSE
  stream that never resolves, so the client received nothing. All three now check
  the response content type first, and non-JSON responses no longer create an
  endpoint row.
- **Offline mode and the no-API-key fallback never worked.** The Ollama provider
  was built with the AI SDK's default OpenAI model, which targets `/v1/responses`;
  Ollama (and most OpenAI-compatible gateways) only implement
  `/v1/chat/completions`, so every generation failed.
- **The failure circuit breaker never reopened.** Five consecutive generation
  failures disabled capture for the lifetime of the process, so a transient
  provider outage silently stopped all documentation until the next deploy. It now
  retries after a 60s cooldown.
- **NestJS never documented error responses.** The interceptor used `tap()`, which
  only fires on success, so every response produced by an exception filter went
  unrecorded. Errors are now captured with the exception's own status and body.
- **Next.js Pages Router documented one endpoint per dynamic id.** Route params
  were not separated from the query string, so `/api/users/1` and `/api/users/2`
  became separate rows, each costing its own AI call.
- Concurrent writes (cluster mode, multiple replicas) no longer collide on the
  unique endpoint index after the AI call has already been paid for; project and
  endpoint writes are now atomic upserts.
- `capture()` can no longer throw into the host app's response path, and
  self-referential bodies terminate instead of overflowing the stack.
- The dashboard no longer opens a new database client and re-runs the schema DDL
  on every request to three of its API routes.
- `--port` now rejects non-numeric and out-of-range values instead of silently
  binding a random port.

### Changed
- **Capture is bounded by default.** `capture.maxBodySize` now defaults to 256 KB.
  Previously there was no cap unless configured, so a stalled provider could let
  the pending-capture queue retain unbounded payloads in the host app's heap.
- Repeated payload shapes are now dropped synchronously, before entering the
  queue, so steady-state traffic neither retains bodies nor queues behind an
  in-flight generation. The queue also processes endpoints in parallel (still one
  shape at a time per endpoint).
- An endpoint stops regenerating once 50 distinct payload shapes are documented.
  The previous FIFO eviction meant highly variable payloads regenerated forever.
- `spec_versions` is capped at the 50 most recent snapshots per endpoint.
- Request bodies are trimmed like responses before being sent to the model, so a
  bulk payload is no longer billed in full.
- Default models updated to current, non-retired ones (`claude-sonnet-5`,
  `gpt-5.4-mini-2026-03-17`). A rejected model ID now produces an explicit
  "pin `ai.model`" error rather than an opaque provider 404. Pin `ai.model`
  yourself for stability.
- Capturers expose `flush()`, and adapters drain the queue on shutdown where the
  framework provides a hook (Fastify `onClose`, Elysia `onStop`, NestJS
  `onApplicationShutdown`). Elsewhere the returned middleware carries `.flush()`.

### Performance
- The `maxBodySize` check no longer serializes the whole payload; it stops as soon
  as the limit is exceeded (~2ms → microseconds on a 1 MB body).
- Privacy rules (allowlist, key names, custom regexes) are compiled once per
  config instead of on every captured request.
- The Express adapter sends the response before doing capture work.

### Breaking
- The Postgres helpers (`createPgDB`, `pgGetAll`, `pgGetAllProjects`,
  `pgGetEndpointsByProject`, `pgDeleteById`, `pgSaveManualSpec`) moved from the
  package root to `@easydocs/core/storage/postgres`. The root re-export pulled the
  `postgres` driver into every SQLite install; it is now loaded on demand and
  declared as an optional peer dependency, so Postgres users must install
  `postgres` themselves. Configuring `storage.type: 'postgres'` is unchanged.

## [0.9.0] - 2026-07-03

### Added
- Drift demo: `pnpm demo:drift` shows docs-vs-reality drift end to end in one
  command — no API key, no setup. It seeds a throwaway database with sample
  observed traffic, writes a committed `openapi.json` that has drifted from it,
  and prints the report, so the flagship check is visible before wiring up a real
  API.
- Docs-vs-reality drift detection: a new `easydocs drift <spec>` command compares
  a committed OpenAPI spec against the spec EasyDocs derives from real traffic and
  reports where documentation has diverged from reality — endpoints/fields observed
  but undocumented, documented but never observed, and values that contradict what
  traffic shows. With one argument it reads observed traffic from the local capture
  DB; with two it compares spec files directly. Takes `--project` and `--markdown`
  (for PR comments), and, like `diff`, is informational and never fails the build.
  The engine is exported from `@easydocs/core` (`computeDrift` / `renderDrift`, also
  at the `@easydocs/core/spec/drift` subpath).
- Dashboard drift view: the dashboard now surfaces docs-vs-reality drift. It reads
  the committed spec from `EASYDOCS_SPEC_PATH` (default `./openapi.json`), compares
  it against observed traffic, badges each drifted endpoint in the sidebar, and
  shows a panel breaking down undocumented / mismatch / unobserved findings. Served
  by a new local `/api/drift` route — the comparison never leaves the machine.
- Strict offline mode (`privacy.offline: true`): a hard local-first guarantee for
  regulated / air-gapped setups. EasyDocs pins itself to a local Ollama model,
  ignores any hosted API keys present in the environment, and fails fast at startup
  if a hosted provider is explicitly configured — so no captured payload can ever
  reach a third-party service. `isHostedProvider` is exported from `@easydocs/core`.
- Redaction audit: EasyDocs can now show exactly which fields it protects. A new
  `collectSensitiveFields` helper (exported from `@easydocs/core` and the pure
  `@easydocs/core/privacy/audit` subpath) reads the `x-easydocs-sensitive` markers
  back out of a spec, and the dashboard surfaces them in a "Sensitive fields" panel
  grouped by endpoint — making the PII-safe promise provable, not just a claim.
  A new `easydocs audit` command lists the same inventory from the terminal (with
  `--project` and `--markdown`), so a pipeline can assert what is being protected.

### Fixed
- Endpoint identity is now a stable OpenAPI route template across every adapter.
  h3, Elysia, and both Next.js wrappers previously stored concrete URLs
  (`/users/123`), exploding into one endpoint row and one AI generation per unique
  URL; they now collapse to `/users/{id}`. Express/NestJS mounted routers keep
  their mount prefix, and exported specs use `{param}` templating (valid OpenAPI),
  so `drift` compares like-with-like.
- The capture gate now tracks a bounded set of seen request/response shapes per
  endpoint (keyed by status class), so an endpoint that alternates 200/404 — or
  gains a new request field — no longer regenerates on every request or silently
  skips re-documentation.
- The CLI proxy no longer crashes the process on an unreachable upstream: handler
  rejections return `502`, capture errors can't reach the response path, and
  hop-by-hop headers are stripped.
- Generation is now bounded — a per-attempt timeout (`ai.timeoutMs`, default 30s),
  a capped capture queue (drop-oldest), and a circuit breaker that stops after
  repeated failures — so a hung or unreachable provider can't stall capture,
  exhaust memory, or spam the logs forever.
- "Keep mine" conflict resolution no longer renders the endpoint blank in the
  dashboard (single `activeSpec` helper). Read paths (`export`/`drift`/`audit`,
  dashboard) resolve a project without creating it — a typo reports "Unknown
  project" instead of inserting a junk row. Deleting an endpoint also removes its
  spec versions. Schema init is awaited before the first query.
- Fastify skips requests with no matched route (404s, scanner probes); capture
  skips HEAD/OPTIONS and binary/non-JSON bodies; oversized bodies honor
  `capture.maxBodySize`. The diff classifier no longer reports parameter
  reorderings as changes and parses routes containing dots correctly. Next.js
  reuses one capturer per config. `ai.baseUrl` is honored for every provider, the
  no-key warning is provider-specific, and tRPC object query inputs keep their
  shape.

### Security
- PII embedded in a request path (e.g. a proxy capturing `/users/alice@example.com`
  or `/verify/<jwt>`) is redacted before the event reaches a hosted provider.
  Value-based detection now also catches credit-card numbers sent as JSON numbers.
- The dashboard binds to `127.0.0.1` by default (`next dev`/`start` no longer
  listen on all interfaces); set `EASYDOCS_DASHBOARD_HOST` to widen exposure
  deliberately.

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
