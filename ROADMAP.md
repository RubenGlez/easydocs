# EasyDocs Roadmap

> This is a direction document, not a backlog. It states the wedge we are
> betting on, the pillars that defend it (in priority order), and — just as
> importantly — what we will deliberately **not** build. Tactical issues should
> trace back to a pillar here; anything that doesn't, we say no to.

## North Star

**The OpenAPI spec you never have to write, and never have to trust a cloud with.**

EasyDocs generates accurate, always-current OpenAPI from real traffic, entirely
on your own infrastructure. We own the *source-of-truth generation* layer — the
accurate spec — and let everyone else own presentation and codegen.

## The gap we are filling

Look at the field and almost every competitor lands in one of two camps, and
**nobody covers the intersection**:

- **Spec consumers** — Speakeasy, Fern, ReadMe, Mintlify, Scalar, Stoplight.
  They assume you already have a correct OpenAPI file. They don't generate it.
  Their blind spot: *the input spec is usually stale or missing.*
- **Traffic-based SaaS** — Postman (Akita), Treblle, Optic Cloud. They capture
  traffic, but **your traffic leaves your machine**. Their blind spot:
  *anyone who cannot ship production traffic to someone else's cloud* — health,
  fintech, public sector, on-prem, air-gapped.

The empty intersection is: **generate the spec from real traffic, accurately,
without the data ever leaving your infrastructure.** That is exactly what
EasyDocs already is. The strategy is not to invent a new direction — it is to
*refuse to dilute this one* by chasing features from either camp.

## Pillars, in priority order

The order is the strategy. When two efforts compete for the same week, the
higher pillar wins.

### 1. Privacy / local-first — the defensible base (C)

The one thing SaaS competitors **cannot copy without cannibalizing their own
business model.** Postman and Treblle will not stop being cloud. This is our
terrain, and it is what unlocks the regulated segment (health, fintech, gov,
on-prem) that is structurally locked out of the alternatives.

Today: PII/secret detection + redaction before anything reaches a hosted
provider; fully offline path via Ollama; deterministic, offline detection.

Direction: make "nothing leaves the machine" a *provable*, first-class product
promise — not a bullet point. Audit trails of what was redacted, stronger
guarantees and defaults, and positioning aimed squarely at teams that cannot use
a traffic SaaS at all.

### 2. Drift: docs-vs-reality — the feature only we can build (A)

Every competitor diffs **spec-against-spec**. We are the only ones who hold, at
the same time, **the committed spec *and* the observed production traffic.**
That enables something no one else can offer:

> Your `openapi.json` says X, but your API in production actually does Y.

This is not "did the spec change?" — it is "is the spec still true?" It is
uniquely enabled by having both halves, and it composes directly with what
already exists (traffic capture + `easydocs diff` + the GitHub Action).

Direction: turn the existing traffic capture and diff machinery into a
drift detector — compare committed spec vs. observed reality and surface where
documentation has diverged, in the dashboard and in CI as an informational
signal.

### 3. Measurable accuracy — the moat that makes 1 and 2 credible (B)

Replacing a hand-written spec, and claiming "your docs are wrong," both require
*trust*. Trust comes from being **demonstrably** the most accurate generator of
OpenAPI from traffic. We already have the scaffolding: `apps/evals` and the
cross-provider accuracy `gate`.

Direction: double down on the eval harness as a moat, not a test. Expand
fixtures and the accuracy scoreboard, keep the cross-provider gate honest, and
make accuracy a number we can publish and defend.

### 4. Interoperable upstream — the distribution (D)

We are the source of truth; others are the presentation. Do not build a walled
garden — feed the ecosystem. EasyDocs should produce the clean OpenAPI that
Scalar / ReadMe / Speakeasy / Fern consume.

Direction: first-class, frictionless export and integrations *into* those tools,
so adopting EasyDocs upstream is the obvious choice regardless of which docs
portal or SDK generator a team already uses.

## Where the dashboard fits

The local dashboard is the **producer-side cockpit for the source-of-truth
layer**, not a consumer-facing docs site. It runs on your machine, reads from
your database, and is where you review, edit, and approve generated specs, see
version history and field-level diffs, and inspect what was flagged as
sensitive. It is the surface where the pillars become visible: redaction badges
make pillar 1's "nothing leaves the machine" promise tangible, and docs-vs-reality
drift (pillar 2) needs exactly this kind of surface to render. Keeping it local
and producer-facing reinforces the wedge; letting it drift toward a hosted,
consumer-facing portal would cross the anti-goal below.

## What we will deliberately NOT do

Saying no here is what keeps the wedge sharp.

- **No hosted, consumer-facing docs portal.** No multi-tenant hosting, custom
  domains, theming, or a published "try it out" aimed at your API's external
  consumers. Cede that to ReadMe / Mintlify / Scalar — integrate with them
  (pillar 4) instead of competing. This is **not** the local dashboard (see
  below), which stays and is central to the wedge.
- **No SDK / client generation.** That is Speakeasy / Fern territory. Be their
  input, not their rival.
- **No build-blocking CI gatekeeping** for breaking changes. Crowded (Optic,
  Bump.sh). Our diff stays informational; our differentiated CI signal is
  *drift* (pillar 2), not gating.

## Phasing

Rough sequencing, anchored to the pillars above rather than to dates.

- **Now** — Harden pillar 1 (privacy as a provable promise) and pillar 3 (grow
  the eval harness / accuracy scoreboard). These are the foundation the rest
  stands on.
- **Next** — Ship pillar 2 (docs-vs-reality drift) on top of the existing
  capture + diff + Action, since accuracy (3) is what makes its signal
  trustworthy.
- **Later** — Broaden pillar 4 (export/integrations into the docs & SDK
  ecosystem) and extend framework/language coverage where it serves the wedge.

## How we measure the direction is working

- Regulated / on-prem teams adopting *because* traffic never leaves — a segment
  the SaaS camp cannot serve.
- Drift detection surfacing real doc-vs-reality divergences that spec-to-spec
  tools structurally cannot see.
- A published, defensible cross-provider accuracy number.
- EasyDocs specs feeding downstream tools (Scalar/ReadMe/Speakeasy/Fern) as the
  common upstream.
