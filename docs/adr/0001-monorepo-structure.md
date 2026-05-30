# ADR 0001 — Monorepo Structure

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The original EasyDocs was a single Next.js application. To support multiple JS frameworks as independent, installable npm packages, the project needs a structure that allows:
- Independent versioning of each adapter
- Shared core logic without duplication
- A separate dashboard app that isn't bundled with framework packages

## Decision

Adopt a pnpm workspaces monorepo with the following layout:

```
packages/
  core/
  express/
  fastify/
  hono/
  nestjs/
  nextjs/
  h3/
  elysia/
  cli/
apps/
  dashboard/
  evals/
  test-api/
```

Each package under `packages/` is a publishable npm package with its own `package.json`, versioning, and changelog. `apps/dashboard` is not published — it's bundled into the local installation flow.

## Consequences

- Developers install only what they need (`@easydocs/express`, not the whole project)
- Core logic is written once and shared via a real dependency, not copy-paste
- Independent versioning allows `@easydocs/nestjs` to ship a breaking change without forcing all users to upgrade
- CI must test each package independently
- Adds overhead: workspace setup, cross-package type resolution, release tooling (Changesets)
