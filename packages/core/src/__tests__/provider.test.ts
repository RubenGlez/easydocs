import { describe, it, expect } from 'vitest'
import { resolveModel } from '../ai/provider.js'

type ConcreteModel = { modelId: string; provider: string }
const concrete = (m: ReturnType<typeof resolveModel>) => m as unknown as ConcreteModel

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key]
    if (vars[key] === undefined) delete process.env[key]
    else process.env[key] = vars[key]
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

const NO_KEYS = {
  OPENAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
  DEEPSEEK_API_KEY: undefined,
}

describe('resolveModel', () => {
  describe('explicit provider config', () => {
    it('uses openai when provider is openai', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'openai', apiKey: 'sk-test' }))
        expect(model.modelId).toBe('gpt-4o')
        expect(model.provider).toContain('openai')
      })
    })

    it('uses anthropic when provider is anthropic', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'anthropic', apiKey: 'sk-test' }))
        expect(model.modelId).toBe('claude-3-5-sonnet-20241022')
        expect(model.provider).toContain('anthropic')
      })
    })

    it('uses deepseek when provider is deepseek', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'deepseek', apiKey: 'sk-test' }))
        expect(model.modelId).toBe('deepseek-chat')
        expect(model.provider).toContain('deepseek')
      })
    })

    it('uses ollama when provider is ollama', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'ollama' }))
        expect(model.modelId).toBe('llama3.2')
        expect(model.provider).toContain('openai')
      })
    })
  })

  describe('custom model override', () => {
    it('respects model override for openai', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4-turbo' }))
        expect(model.modelId).toBe('gpt-4-turbo')
      })
    })

    it('respects model override for deepseek', () => {
      withEnv(NO_KEYS, () => {
        const model = concrete(resolveModel({ provider: 'deepseek', apiKey: 'sk-test', model: 'deepseek-reasoner' }))
        expect(model.modelId).toBe('deepseek-reasoner')
      })
    })
  })

  describe('env var auto-detection', () => {
    it('auto-detects anthropic from ANTHROPIC_API_KEY', () => {
      withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-ant-test' }, () => {
        const model = concrete(resolveModel())
        expect(model.provider).toContain('anthropic')
      })
    })

    it('auto-detects deepseek from DEEPSEEK_API_KEY', () => {
      withEnv({ ...NO_KEYS, DEEPSEEK_API_KEY: 'sk-test' }, () => {
        const model = concrete(resolveModel())
        expect(model.provider).toContain('deepseek')
      })
    })

    it('falls back to openai when only OPENAI_API_KEY is set', () => {
      withEnv({ ...NO_KEYS, OPENAI_API_KEY: 'sk-test' }, () => {
        const model = concrete(resolveModel())
        expect(model.provider).toContain('openai')
      })
    })

    it('anthropic takes priority over deepseek when both keys are set', () => {
      withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-ant-test', DEEPSEEK_API_KEY: 'sk-test' }, () => {
        const model = concrete(resolveModel())
        expect(model.provider).toContain('anthropic')
      })
    })

    it('explicit provider config overrides env var auto-detection', () => {
      withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: 'sk-ant-test' }, () => {
        const model = concrete(resolveModel({ provider: 'openai', apiKey: 'sk-test' }))
        expect(model.provider).toContain('openai')
      })
    })
  })
})
