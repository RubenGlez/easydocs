import { z } from 'zod'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface CaptureEvent {
  method: HttpMethod
  path: string
  query: Record<string, string>
  params: Record<string, string>
  body: unknown
  response: unknown
  status: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  durationMs: number
}

const AIConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'deepseek']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
}).strict()

const StorageConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgres']).optional(),
  url: z.string().optional(),
  poolSize: z.number().int().positive().optional(),
}).strict()

const DashboardConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).optional(),
  autoStart: z.boolean().optional(),
}).strict()

const CaptureConfigSchema = z.object({
  ignoreRoutes: z.array(z.string()).optional(),
  includePaths: z.array(z.string()).optional(),
  maxBodySize: z.number().int().positive().optional(),
}).strict()

const PrivacyRulesSchema = z.object({
  keyNames: z.array(z.string()).optional(),
  valuePatterns: z.array(z.string()).optional(),
}).strict()

const PrivacyConfigSchema = z.object({
  enabled: z.boolean().optional(),
  // Strict local-first guarantee: only ever use a local Ollama model, never send
  // captured data to a hosted provider. Pins the provider to ollama (ignoring env
  // keys) and fails fast if a hosted provider is explicitly configured.
  offline: z.boolean().optional(),
  placeholder: z.string().optional(),
  allowlist: z.array(z.string()).optional(),
  customRules: PrivacyRulesSchema.optional(),
}).strict()

export const EasyDocsConfigSchema = z.object({
  project: z.string().min(1).optional(),
  ai: AIConfigSchema.optional(),
  storage: StorageConfigSchema.optional(),
  dashboard: DashboardConfigSchema.optional(),
  capture: CaptureConfigSchema.optional(),
  privacy: PrivacyConfigSchema.optional(),
}).strict()

export type AIConfig = z.infer<typeof AIConfigSchema>
export type StorageConfig = z.infer<typeof StorageConfigSchema>
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>
export type CaptureConfig = z.infer<typeof CaptureConfigSchema>
export type PrivacyConfig = z.infer<typeof PrivacyConfigSchema>
export type EasyDocsConfig = z.infer<typeof EasyDocsConfigSchema>

export function parseConfig(config?: unknown): EasyDocsConfig {
  const result = EasyDocsConfigSchema.safeParse(config ?? {})
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`[EasyDocs] Invalid configuration:\n${messages}`)
  }
  return result.data
}
