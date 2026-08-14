import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'
import type { AIConfig } from '../types.js'

// Defaults are mid-tier models: spec generation is one call per newly-seen
// payload shape, so the flagship tier is not worth its cost here. Providers
// retire model IDs, which silently breaks every user who never set `ai.model` —
// so these get reviewed each release, and `buildOperation` turns an unknown-model
// error into an explicit "pin ai.model" message rather than a bare 404.
export const DEFAULT_MODELS = {
  openai: 'gpt-5.4-mini-2026-03-17',
  anthropic: 'claude-sonnet-5',
  ollama: 'llama3.2',
  deepseek: 'deepseek-chat',
}

export type Provider = 'openai' | 'anthropic' | 'ollama' | 'deepseek'

// Precedence when no explicit provider is set:
//   1. ANTHROPIC_API_KEY → anthropic
//   2. DEEPSEEK_API_KEY  → deepseek
//   3. OPENAI_API_KEY    → openai
//   4. no key            → ollama (fully offline against a local server)
// If the caller supplied an explicit apiKey without a provider, assume openai.
function detectProvider(hasExplicitApiKey: boolean): Provider {
  if (hasExplicitApiKey) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'ollama'
}

/** The hosted providers that receive captured data over the network. Ollama is local. */
export function isHostedProvider(provider: Provider): boolean {
  return provider !== 'ollama'
}

/**
 * Resolve which provider a config maps to, mirroring resolveModel's selection.
 * In `offline` mode the provider is pinned to the local Ollama model (env keys are
 * ignored), and an explicitly configured hosted provider is a hard error — nothing
 * captured may ever leave the machine.
 */
export function resolveProvider(config?: AIConfig, offline?: boolean): Provider {
  if (offline) {
    if (config?.provider && isHostedProvider(config.provider)) {
      throw new Error(
        `[EasyDocs] privacy.offline is enabled but ai.provider is "${config.provider}", a hosted provider. ` +
        'In offline mode EasyDocs only uses a local Ollama model so nothing leaves the machine. ' +
        'Remove ai.provider or set it to "ollama".'
      )
    }
    return 'ollama'
  }
  return config?.provider ?? detectProvider(!!config?.apiKey)
}

export function resolveModel(config?: AIConfig, offline?: boolean): LanguageModel {
  const provider: Provider = resolveProvider(config, offline)
  const model = config?.model ?? DEFAULT_MODELS[provider]

  // A configured baseUrl is honored for every hosted provider (e.g. pointing
  // OpenAI/Anthropic at an internal gateway). Passing undefined lets each SDK use
  // its own default endpoint.
  switch (provider) {
    case 'anthropic': {
      const client = createAnthropic({
        apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
        baseURL: config?.baseUrl,
      })
      return client(model)
    }
    case 'deepseek': {
      const client = createDeepSeek({
        apiKey: config?.apiKey ?? process.env.DEEPSEEK_API_KEY,
        baseURL: config?.baseUrl,
      })
      return client(model)
    }
    case 'ollama': {
      const client = createOpenAI({
        baseURL: config?.baseUrl ?? 'http://localhost:11434/v1',
        apiKey: 'ollama',
      })
      // `client(model)` returns a Responses-API model (POST /v1/responses).
      // Ollama's OpenAI-compatible surface only implements /v1/chat/completions,
      // as do most OpenAI-compatible gateways — so every generation 404'd,
      // tripped the circuit breaker, and produced no docs. That silently broke
      // both the no-API-key fallback and privacy.offline, which are pinned here.
      return client.chat(model)
    }
    default: {
      const client = createOpenAI({
        apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
        baseURL: config?.baseUrl,
      })
      return client(model)
    }
  }
}
