# ADR 0007 — DatabaseAdapter Interface Seam

**Status:** Accepted  
**Date:** 2026-05-19

## Context

`packages/core/src/capture.ts` originally selected between SQLite and Postgres storage using an `isPostgres` boolean flag and `AnyDB` union type, then branched on it at every call site:

```ts
const db = isPostgres ? createPgDB(url) : createDB(path)
// then throughout:
if (isPostgres) {
  await pgFindOrCreateProject(db as ReturnType<typeof createPgDB>, slug)
} else {
  await findOrCreateProject(db as ReturnType<typeof createDB>, slug)
}
```

This meant:
- `capture.ts` had to know which storage backend was active
- Every new storage operation required a branch in capture logic
- Adding a third backend would require touching capture.ts
- Type casts (`as ReturnType<...>`) masked the branching

## Decision

Extract a `DatabaseAdapter` interface that both SQLite and Postgres implement:

```ts
interface DatabaseAdapter {
  findOrCreateProject(slug: string): Promise<string>
  getEndpointByPathMethod(projectId: string, path: string, method: HttpMethod): Promise<Endpoint | undefined>
  upsertEndpoint(projectId: string, path: string, method: HttpMethod, spec: Operation, responseHash: string): Promise<string>
  getAllProjects(): Promise<Project[]>
  getAllEndpoints(): Promise<Endpoint[]>
  getEndpointsByProject(projectId: string): Promise<Endpoint[]>
  deleteEndpointById(id: string): Promise<void>
  saveManualSpec(id: string, manualSpec: Operation): Promise<void>
  resolveConflict(id: string, keep: 'ai' | 'manual'): Promise<void>
}
```

A `createAdapter(storageConfig?)` factory returns the right implementation. `capture.ts` holds a module-level singleton and never sees SQLite or Postgres types directly.

## Consequences

- `capture.ts` has zero branching on storage type — it calls `adapter.method()` throughout
- Adding a third backend (e.g. MySQL, DynamoDB) requires only a new file implementing `DatabaseAdapter`; `capture.ts` is untouched
- The interface is the test surface — unit tests can pass a fake adapter without touching real storage
- `isPostgres` flag and `AnyDB` union type are deleted
