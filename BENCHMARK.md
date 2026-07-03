# Accuracy Benchmark

EasyDocs generates OpenAPI specs with an AI model, so the fair question is: **how accurate
is the spec?** This page answers it with a reproducible measurement, not a claim. The harness,
fixtures, ground-truth references, and scorer all live in [`apps/evals`](./apps/evals) — you
can run it yourself and get the same table.

## Results

Latest run — **2026-07-01**, 14 fixtures. Only providers with credentials on the run machine
are scored; the rest are listed as skipped, never silently dropped.

| Model | Mean | tags | responses | parameters | requestBody | security | responseSchema |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| `deepseek/deepseek-chat` | 1.000 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| `deepseek/deepseek-reasoner` | 1.000 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

_Skipped (no credentials on this run): `openai/gpt-4o-mini`, `openai/gpt-4o`,
`anthropic/claude-haiku-4-5-20251001`, `anthropic/claude-sonnet-4-6`, `ollama/llama3.1`,
`ollama/mistral`. Set the corresponding API keys (or run Ollama locally) and re-run to fill
those rows in._

Scores vary slightly run to run even at temperature 0; treat these as a point-in-time
snapshot, not a fixed constant. The CI accuracy gate (below) is what guards against
regressions over time.

## What is measured

Each fixture is a captured request/response pair. It's run through the exact same
`buildOperation()` the product uses, and the generated OpenAPI Operation is compared against a
hand-authored ground-truth spec (`apps/evals/ground-truth/<fixture>.json`). The overall score
is a weighted mean over the dimensions that apply to a given endpoint:

| Dimension | Weight | How it's scored |
| :-- | --: | :-- |
| `responses` | 2.0 | F1 over the set of status codes |
| `parameters` | 2.0 | 0.8 × F1 over `name\|in` keys + 0.2 × agreement on `required` |
| `responseSchema` | 2.0 | fraction of the success response's expected top-level properties present |
| `requestBody` | 1.5 | presence match (has body ⇔ should have body) |
| `security` | 1.5 | F1 over auth-scheme names (e.g. `bearerAuth`) |
| `tags` | 1.0 | F1 over the tag set |

Scoring is deterministic (`apps/evals/score.ts`) — no LLM-as-judge in the accuracy number, so
the measurement doesn't drift with model mood. A fixture passes at ≥ 0.7.

## What is NOT measured (limitations)

Read the number for what it is. The scorer checks **structural correctness** — the right
status codes, parameters, auth scheme, request-body presence, and the top-level shape of the
response — because those are what break API consumers. It does **not** grade:

- deep/nested response-schema fidelity beyond top-level property names,
- the quality of human-readable prose (`summary` / `description`),
- example values, or edge-case status codes the traffic didn't exercise.

The fixture set is small (14) and hand-curated. It mixes synthetic endpoints with **real
captures from public APIs** (GitHub, JSONPlaceholder — see
[`apps/evals/fixtures/real/SOURCES.md`](./apps/evals/fixtures/real/SOURCES.md)) so it isn't
only clean, easy data, but it is not a broad statistical sample. Contributions of harder
fixtures are the most useful way to make this benchmark meaner — see below.

## Reproduce it

```bash
# one provider is enough; set any of these keys (or run Ollama locally)
export DEEPSEEK_API_KEY=...      # or OPENAI_API_KEY / ANTHROPIC_API_KEY

pnpm --filter easydocs-evals matrix              # human-readable scoreboard
pnpm --filter easydocs-evals matrix --markdown   # the Markdown table above
pnpm --filter easydocs-evals eval                # the full promptfoo suite (extra assertions)
```

Models without credentials (or an unreachable Ollama at `localhost:11434`) are reported as
skipped, so the run works with whatever keys you have.

## The CI accuracy gate

Accuracy is also a merge gate, not just a report. `.github/workflows/eval.yml` runs
`matrix.ts --gate` on changes to `packages/core/**` or `apps/evals/**`, scoring one strong
model per cloud provider (DeepSeek, OpenAI, Anthropic) and failing if any tested provider's
mean drops below `GATE_THRESHOLD` (default **0.85**). Running across providers is deliberate:
it catches provider-compatibility breaks — e.g. a strict structured-output API rejecting our
schema — not just accuracy drift. With no keys available (forks), the gate skips and passes.

## Add a fixture

1. Drop a captured `{ method, path, query, params, body, response, status, headers }` payload
   in `apps/evals/fixtures/` (or `fixtures/real/` for real traffic, and record the source in
   `SOURCES.md`).
2. Add the hand-authored expected Operation in `apps/evals/ground-truth/` under the same
   filename.
3. Re-run the matrix. A fixture the current models get wrong is exactly what this benchmark
   wants.
