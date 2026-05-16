# ADR 0002 — Middleware-First Distribution

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The original EasyDocs used a **proxy model**: developers change their API URLs to route through EasyDocs (`?endpoint=https://real-api.com/users`). This approach has significant friction:

- Every API call URL must be changed in client code
- Adds a double network hop (latency)
- Breaks existing tooling that depends on real URLs
- Cannot be used transparently alongside production traffic

## Decision

The primary distribution model is **middleware packages**. Developers add one import and one `app.use()` (or framework equivalent) to their existing server. No URLs change.

```ts
import { easydocs } from '@easydocs/express'
app.use(easydocs())
```

The proxy approach is retained as a secondary use case for documenting **third-party APIs** the developer consumes but does not control. This will be delivered as a CLI tool in v2 (`npx easydocs proxy`).

## Consequences

- Zero friction for own-API documentation — the primary use case
- Adapters must handle each framework's specific request/response lifecycle (more implementation work than a single proxy)
- Proxy use case is deferred but not abandoned
- Middleware approach allows conditional enabling (dev-only via `NODE_ENV` checks)
