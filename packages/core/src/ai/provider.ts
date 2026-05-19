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

export function resolveModel(config?: AIConfig): LanguageModel {
  const provider = config?.provider

  if (provider === 'anthropic' || (!provider && !config?.apiKey && process.env.ANTHROPIC_API_KEY)) {
    const client = createAnthropic({ apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY })
    return client(config?.model ?? DEFAULT_MODELS.anthropic)
  }

  if (provider === 'deepseek' || (!provider && !config?.apiKey && process.env.DEEPSEEK_API_KEY)) {
    const client = createDeepSeek({ apiKey: config?.apiKey ?? process.env.DEEPSEEK_API_KEY })
    return client(config?.model ?? DEFAULT_MODELS.deepseek)
  }

  if (provider === 'ollama') {
    const client = createOpenAI({
      baseURL: config?.baseUrl ?? 'http://localhost:11434/v1',
      apiKey: 'ollama',
    })
    return client(config?.model ?? DEFAULT_MODELS.ollama)
  }

  // Default: OpenAI (explicit config, env var, or fallback)
  const client = createOpenAI({ apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY })
  return client(config?.model ?? DEFAULT_MODELS.openai)
}
