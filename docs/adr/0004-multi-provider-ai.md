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
    provider: 'openai',      // 'openai' | 'anthropic' | 'ollama' | 'deepseek'
    model: 'gpt-4o',         // optional, defaults per provider
    apiKey: '...',           // optional, falls back to env vars
  }
})
```

Default provider resolution:
1. If `ai.provider` is set in config, use it
2. If `ai.apiKey` is set in config (but no explicit provider), use OpenAI
3. If `ANTHROPIC_API_KEY` env var is set, use Anthropic
4. If `DEEPSEEK_API_KEY` env var is set, use DeepSeek
5. Otherwise, use OpenAI (which will warn if `OPENAI_API_KEY` is not set)

Default models per provider: `gpt-4o` (OpenAI), `claude-3-5-sonnet-20241022` (Anthropic), `deepseek-chat` (DeepSeek), `llama3.2` (Ollama).

Supported providers: OpenAI, Anthropic, DeepSeek, Ollama.

**Why Vercel AI SDK:** consistent `generateObject()` interface across providers — no per-provider prompt engineering. `generateObject()` with a Zod schema (`OperationSchema`) enforces structured output at the type level, making provider-swapping transparent to the rest of the codebase. Adding a new provider is a one-line change in `ai/provider.ts`.

## Consequences

- No vendor lock-in — developers use the model they already have access to
- Ollama support enables fully local, free, private documentation generation
- Vercel AI SDK abstracts provider differences; adding new providers later is a one-line change in `ai/provider.ts`
- `generateObject()` with Zod schema ensures structured output regardless of provider
- Different models produce different quality specs; this is expected and documented
