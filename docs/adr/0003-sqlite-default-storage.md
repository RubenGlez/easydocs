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

Both backends implement the same `DatabaseAdapter` interface from `packages/core/src/storage/adapter.ts`, so switching is a one-line config change.

**Why Drizzle ORM:** works with both SQLite and Postgres from the same schema definition. Lightweight, TypeScript-first, no heavy runtime. A single schema file covers both dialects.

**Why `@libsql/client`:** async, embedded SQLite via libSQL. No server process, no connection string, works anywhere Node.js runs — unlike `better-sqlite3`, which is synchronous and requires native compilation.

## Consequences

- Zero infrastructure required to get started
- SQLite is local per-machine; teams wanting shared docs need to configure Postgres
- Drizzle ORM supports both dialects, so the schema and query code is shared
