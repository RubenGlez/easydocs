import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'
import type { AIConfig } from '../types.js'

const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
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

/** Resolve which provider a config maps to, mirroring resolveModel's selection. */
export function resolveProvider(config?: AIConfig): Provider {
  return config?.provider ?? detectProvider(!!config?.apiKey)
}

export function resolveModel(config?: AIConfig): LanguageModel {
  const provider: Provider = resolveProvider(config)
  const model = config?.model ?? DEFAULT_MODELS[provider]

  switch (provider) {
    case 'anthropic': {
      const client = createAnthropic({ apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY })
      return client(model)
    }
    case 'deepseek': {
      const client = createDeepSeek({ apiKey: config?.apiKey ?? process.env.DEEPSEEK_API_KEY })
      return client(model)
    }
    case 'ollama': {
      const client = createOpenAI({
        baseURL: config?.baseUrl ?? 'http://localhost:11434/v1',
        apiKey: 'ollama',
      })
      return client(model)
    }
    default: {
      const client = createOpenAI({ apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY })
      return client(model)
    }
  }
}
