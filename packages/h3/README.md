# @easydocs/h3

EasyDocs plugin for [h3](https://h3.unjs.io/), [Nitro](https://nitro.unjs.io/), and [Nuxt](https://nuxt.com/).

## Install

```bash
npm install @easydocs/h3
```

## h3

```ts
import { createApp } from 'h3'
import { easydocs } from '@easydocs/h3'

const app = createApp()
app.use(easydocs())

// your routes stay the same
```

## Nitro / Nuxt

Create `server/plugins/easydocs.ts`:

```ts
import { easydocs } from '@easydocs/h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.h3App.use(easydocs())
})
```

## Configuration

```ts
app.use(easydocs({
  ai: { provider: 'anthropic' },
  capture: { ignoreRoutes: ['/health'] },
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
