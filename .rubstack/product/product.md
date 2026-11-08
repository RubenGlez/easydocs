---
name: product
description: EasyDocs product vision, mission, values, and audience
metadata:
  type: project
---

# EasyDocs

## What it is

EasyDocs watches API traffic and uses AI to generate accurate, up-to-date OpenAPI 3.0 specs automatically. No spec files to write, no annotations to maintain. It sits as middleware inside your server, observes every real request and response, and builds documentation from what the API actually does — not what you thought it would do when you wrote it.

```
Your API server
  └── EasyDocs middleware (one line)
        ├── Intercepts request + response
        ├── Feeds real traffic to AI
        ├── Builds/updates OpenAPI spec
        └── Serves live docs dashboard
```

## Mission

Make API documentation effortless for every developer — generated from real behavior, always accurate, zero extra work.

## Vision

A world where API docs are never out of date because they are never written by hand. Developers build their APIs; EasyDocs writes the docs.

## The Problem

APIs change faster than their documentation. The standard workflow is broken:

1. Developer builds an endpoint
2. Developer writes a spec manually (or skips it)
3. The API evolves; the spec doesn't
4. Consumers hit undocumented behavior

Every existing solution asks developers to do more work: write annotations, maintain YAML files, keep Postman collections in sync. The docs are always chasing the code.

## Audience

- Backend developers who want OpenAPI docs without the overhead of maintaining them
- Teams whose APIs evolve faster than their specs
- Developers documenting third-party APIs they consume but don't control
- Open-source projects that want professional docs without professional effort

## Positioning

Zero-config, middleware-first API documentation generated from real traffic — not code annotations, not manual YAML, not Postman collections.

**Lead with trust and sovereignty, not the AI.** The headline is *the API spec you can actually trust — generated on your machine, from real traffic, never sent to anyone.* AI generation is *how* it works, not *why* you'd choose it; "AI-generated spec" makes a careful backend developer flinch, and it's also the one angle a funded rival could copy fastest. The durable, hard-to-copy edges are: **local-first / self-hostable** (no traffic leaves the machine, unlike Treblle/Levo/Postman Insights), **fully offline AI** (Ollama fallback, no model vendor sees the data), and **framework-native accuracy** (adapters recover `/users/:id` route templates where proxies only see `/users/123`). Positioning line: *Optic without the setup, Treblle without sending your traffic to the cloud, and the spec the doc-renderers wish they had.* See [[strategy]] for the North Star this positioning serves, and [[competitors]] for the full differentiation strategy.

Secondary use case: proxy mode for documenting third-party APIs the developer consumes but does not control.

## Direction Assessment

The strategic frame — EasyDocs is an OSS-tool-that-matters whose goal is reputation as an open-source builder, not revenue — lives in [[strategy]]. The values below serve that goal.

**Values guiding product decisions:**

- **Reputation over reach.** The tiebreaker on any decision is whether it makes EasyDocs the tool developers respect and recommend, not whether it makes the product bigger. The repo itself is the portfolio; its craft is a first-class deliverable.
- **Win Layer 1, refuse Layer 2.** EasyDocs competes only on turning real traffic into a trustworthy spec. It does not try to out-render Scalar, Redoc, or Mintlify — it exports cleanly into them. See [[strategy]] and [[competitors]].
- **Zero-config first.** Every decision defaults to the path that requires least setup. SQLite over Postgres. Auto-detected AI provider over explicit config. Auto-served dashboard over manual integration.
- **Accuracy over completeness.** A smaller spec that reflects real behavior is more useful than a comprehensive spec built from assumptions. Trust is the make-or-break; a stale-but-correct spec beats a fresh-but-wrong one.
- **Open-source always.** No SaaS lock-in, no paywalled features, no telemetry without consent. The core will always be free and self-hostable. No revenue goal means zero burn, which is the whole reason a lean OSS project endures where funded incumbents didn't.
- **Framework respect.** We adapt to how frameworks work, not the other way around. Express middleware, Fastify plugins, NestJS modules — each adapter uses idiomatic patterns for its ecosystem. Breadth of adapters is the distribution strategy.

## Key Risks

- AI output quality varies across providers and models; spec accuracy depends on model capability. This is the make-or-break risk — defended by the eval harness + CI accuracy gate, a public benchmark, and human-in-the-loop authority (see [[strategy]]).
- The AI differentiator is the most copyable part of the moat; a funded rival with existing traffic could add an LLM pass quickly. Mitigation: weight messaging and investment on the un-copyable combination (local-first + offline + OSS + framework-native), not the AI.
- SQLite per-machine model limits team collaboration (addressed by Postgres opt-in, though Postgres is a speculative surface until adoption asks for it — see [[roadmap]]).
- Keeping adapters current with breaking framework changes requires ongoing maintenance per framework supported.

*Resolved (was a risk):* the "dashboard as primary reading surface, competing on polish with Scalar/Redoc/Mintlify" bet is retired. The strategic decision to stay in Layer 1 removes that investment risk — the dashboard is now scoped as a good-enough local viewer, with clean export as the shippable path. See [[ux]].
