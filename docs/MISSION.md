# Mission, Vision & Values

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

## The Idea

Flip the model. Instead of generating docs from code you write, generate them from requests that actually happen.

EasyDocs sits as middleware inside your server. It observes every real request and response. An AI layer interprets that traffic and builds an OpenAPI 3.0 spec automatically — updating it each time new patterns appear.

The result: documentation that reflects what your API actually does, not what you thought it would do when you wrote it.

## Core Concept

```
Your API server
  └── EasyDocs middleware (one line)
        ├── Intercepts request + response
        ├── Feeds real traffic to AI
        ├── Builds/updates OpenAPI spec
        └── Serves live docs dashboard
```

No proxy URLs. No spec files to maintain. No CI step to write. One import, one `app.use()`.

## Values

**Zero-config first.** Every decision defaults to the path that requires least setup. SQLite over Postgres. Auto-detected AI provider over explicit config. Auto-served dashboard over manual integration.

**Accuracy over completeness.** A smaller spec that reflects real behavior is more useful than a comprehensive spec built from assumptions.

**Open-source always.** No SaaS lock-in, no paywalled features, no telemetry without consent. The core will always be free and self-hostable.

**Developer experience is the product.** If setup takes more than two minutes, we've failed. The install-to-value path is as important as the feature set.

**Framework respect.** We adapt to how frameworks work, not the other way around. Express middleware, Fastify plugins, NestJS modules — each adapter uses idiomatic patterns for its ecosystem.

## Who It's For

- Backend developers who want OpenAPI docs without the overhead of maintaining them
- Teams whose APIs evolve faster than their specs
- Developers documenting third-party APIs they consume but don't control
- Open-source projects that want professional docs without professional effort
