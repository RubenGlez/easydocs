# ADR 0003 — SQLite as Default Storage

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The original EasyDocs required a Postgres instance via `POSTGRES_URL` env variable. This creates a hard prerequisite before any value is delivered — the developer must provision a database, get a connection string, and configure it before running the tool.

For a developer tool with a "zero-config" positioning, this is a critical blocker to adoption.

## Decision

SQLite is the default storage backend. No configuration required.

- Default path: `~/.easydocs/db.sqlite`
- No server process, no connection string, no signup
- Works anywhere Node.js runs

Postgres remains available as an opt-in for teams who need shared storage across multiple service instances:

```ts
easydocs({
  storage: { type: 'postgres', url: process.env.DATABASE_URL }
})
```

Both backends implement the same `StorageAdapter` interface from `packages/core`, so switching is a one-line config change.

## Consequences

- Zero infrastructure required to get started
- `better-sqlite3` is a native module — requires compilation on install (acceptable tradeoff)
- SQLite is local per-machine; teams wanting shared docs need to configure Postgres
- Drizzle ORM supports both dialects, so the schema and query code is shared
