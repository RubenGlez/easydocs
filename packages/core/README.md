# @easydocs/core

Core engine for [EasyDocs](https://github.com/RubenGlez/easydocs) — AI spec generation, storage, and the capture queue.

You don't need to install this directly. Framework adapters (`@easydocs/express`, `@easydocs/fastify`, etc.) depend on it automatically.

## What it does

- Captures HTTP traffic from middleware adapters
- Runs a background queue so captures never block requests
- Detects response shape changes and only re-runs AI when needed (sampling)
- Generates OpenAPI 3.0 Operation objects via OpenAI, Anthropic, DeepSeek, or Ollama
- Stores specs in SQLite (default) or Postgres
- Detects auth schemes from request headers and documents them

## Direct usage

```ts
import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'

// At setup time — creates a Capturer with its own storage adapter and queue
const capturer = createCapturer(parseConfig({ project: 'my-api', ai: { provider: 'openai' } }))

// Per request — fire and forget, never await
capturer.capture(buildCaptureEvent({
  method: 'GET',
  path: '/users',
  query: { page: '1' },
  params: {},
  requestBody: null,
  responseBody: { data: [], total: 0 },
  status: 200,
  requestHeaders: {},
  responseHeaders: {},
  durationMs: 12,
}))
```

## Configuration

```ts
{
  project: 'my-api',           // project slug, default: 'default'
  ai: {
    provider: 'openai',        // 'openai' | 'anthropic' | 'deepseek' | 'ollama'
    model: 'gpt-4o',
    apiKey: '...',             // falls back to OPENAI_API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY
    baseUrl: '...',            // for custom OpenAI-compatible endpoints
  },
  storage: {
    type: 'sqlite',            // 'sqlite' | 'postgres'
    url: 'file:./docs.sqlite', // default: ~/.easydocs/db.sqlite
  },
  capture: {
    ignoreRoutes: ['/health'],
    includePaths: ['/api'],
    maxBodySize: 10_000,
  },
  dashboard: {
    autoStart: true,           // spawn dashboard on first capture (dev only)
    port: 4999,
  },
}
```

## AI provider detection

Auto-detection precedence (when no explicit `provider` is set):

| Environment variable | Provider used |
|----------------------|---------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `OPENAI_API_KEY` | OpenAI GPT-4o |
| none | Ollama at `localhost:11434` (fully offline) |
