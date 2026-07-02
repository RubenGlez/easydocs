# @easydocs/trpc

EasyDocs middleware for [tRPC](https://trpc.io/) (v11+). Generate accurate OpenAPI 3.0 specs from your API's real traffic — local-first and self-hostable, with an offline mode (Ollama) where nothing leaves your machine.

## Install

```bash
npm install @easydocs/trpc
```

## Usage

Attach the middleware to your base procedure. Every procedure built from it is
captured.

```ts
import { initTRPC } from '@trpc/server'
import { easydocs } from '@easydocs/trpc'

const t = initTRPC.create()

// Build your procedures from this base
export const publicProcedure = t.procedure.use(easydocs())

export const appRouter = t.router({
  getUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => getUser(input.id)),
})
```

Queries are documented as `GET /trpc/<procedure>` and mutations as
`POST /trpc/<procedure>`; subscriptions are skipped.

## Configuration

```ts
export const publicProcedure = t.procedure.use(easydocs({
  ai: {
    provider: 'ollama',
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
  },
}))
```

## View your docs

```bash
npm install -D @easydocs/dashboard
npx easydocs dashboard

# Or export to a file
npx easydocs export > openapi.json
```

See [@easydocs/core](../core) for the full configuration reference.
