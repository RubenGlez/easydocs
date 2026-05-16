# ADR 0006 — v1 Framework Targets

**Status:** Accepted  
**Date:** 2026-05-16

## Context

To be adopted, EasyDocs must support the frameworks developers are actually using. Supporting too few means low reach; supporting too many at launch means shallow, buggy adapters.

The JS ecosystem has many HTTP frameworks, but adoption is heavily concentrated.

## Decision

**v1 ships adapters for four frameworks:**

| Framework | Rationale |
|-----------|-----------|
| **Express** | Most widely used Node.js framework. Massive legacy footprint. Standard `app.use()` middleware model. |
| **Fastify** | Modern Node.js standard. Growing adoption. Known for performance. Plugin/hook model. |
| **Hono** | Edge-native. Works on Cloudflare Workers, Bun, Deno, and Node. Popular in modern serverless stacks. |
| **NestJS** | Dominant in enterprise TypeScript. Uses interceptors and decorators — requires a proper NestJS module, not just Express middleware. |

These four cover the majority of production Node.js APIs being built today.

**v2 adds:**

| Framework | Notes |
|-----------|-------|
| **Next.js API routes** | App Router and Pages Router have different models; requires more implementation work. |
| **h3 / Nitro** | Powers Nuxt. Worth adding for the Vue ecosystem. |
| **Elysia** | Bun-native, fast-growing. |
| **tRPC** | Different interception model (procedure-level, not HTTP middleware). |

## Implementation Notes

NestJS is the outlier. Unlike Express, Fastify, and Hono (which all use a request/response middleware pattern), NestJS uses:
- **Interceptors** (`NestInterceptor`) as the idiomatic interception point
- **Modules** (`@Module`) for dependency injection and configuration
- **RxJS observables** for async response handling

The `@easydocs/nestjs` package must implement a proper `EasyDocsModule.forRoot(config)` that registers a global interceptor, rather than adapting an Express-style middleware.

## Consequences

- v1 reaches the majority of the JS backend ecosystem
- NestJS requires significantly more implementation work than the other three adapters
- v2 frameworks are explicitly documented as planned, not abandoned
- Developers on unsupported frameworks can fall back to the proxy CLI (v2)
