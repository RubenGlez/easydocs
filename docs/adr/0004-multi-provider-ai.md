# ADR 0004 — Multi-Provider AI via Vercel AI SDK

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The original EasyDocs was hardcoded to `openai("gpt-4-turbo")`. This forces every developer to have an OpenAI API key and pay OpenAI rates — a blocker for:

- Developers who prefer Anthropic Claude
- Teams running local models via Ollama (no API cost, no data leaving the network)
- Any developer without an OpenAI account

## Decision

Use the **Vercel AI SDK** as the AI abstraction layer. It provides a consistent `generateObject()` interface across providers. EasyDocs exposes a single `ai` config block:

```ts
easydocs({
  ai: {
    provider: 'openai',      // 'openai' | 'anthropic' | 'ollama'
    model: 'gpt-4o',         // optional, defaults per provider
    apiKey: '...',           // optional, falls back to env vars
  }
})
```

Default provider resolution:
1. If `ai.provider` is set in config, use it
2. If `OPENAI_API_KEY` is set, use OpenAI
3. If `ANTHROPIC_API_KEY` is set, use Anthropic
4. If neither, attempt Ollama on `localhost:11434`

Supported providers at v1: OpenAI, Anthropic, Ollama.

## Consequences

- No vendor lock-in — developers use the model they already have access to
- Ollama support enables fully local, free, private documentation generation
- Vercel AI SDK abstracts provider differences; adding new providers later is a one-line change
- `generateObject()` with Zod schema ensures structured output regardless of provider
- Different models produce different quality specs; this is expected and documented
