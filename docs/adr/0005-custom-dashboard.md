# ADR 0005 — Custom Dashboard over Swagger UI

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The original EasyDocs used `swagger-ui-react` to render documentation. Swagger UI is functional and familiar to developers, but it has significant limitations as a differentiator:

- Generic appearance identical to every other Swagger-based tool
- No support for custom features (diff view, version history, export controls)
- No ability to surface EasyDocs-specific metadata (capture time, traffic count, spec confidence)
- Poor mobile experience
- Cannot be extended without forking

For a project positioned on developer experience, the docs UI is the product surface that developers and their API consumers interact with most.

## Decision

Build a custom dashboard application (`apps/dashboard`) from the start, rather than using Swagger UI.

The dashboard is a Next.js application that:
- Reads specs directly from EasyDocs storage (SQLite or Postgres)
- Renders a custom endpoint explorer with EasyDocs-specific context
- Supports export to JSON and YAML
- Shows a diff view when endpoint specs change between captures
- Is auto-started as a child process by `packages/core` in development mode

Swagger UI may still be used internally as a rendered preview panel for the raw OpenAPI spec, but the primary interface is custom.

## Consequences

- Higher initial build investment compared to dropping in Swagger UI
- Full control over UX — can surface AI confidence, capture history, spec diffs
- The UI itself becomes a reason to choose EasyDocs over alternatives
- Must maintain the dashboard as a first-class part of the project
- No dependency on the Swagger UI release cycle or its limitations
