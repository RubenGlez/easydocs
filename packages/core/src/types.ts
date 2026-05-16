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

export interface AIConfig {
  provider?: 'openai' | 'anthropic' | 'ollama'
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface StorageConfig {
  type?: 'sqlite' | 'postgres'
  url?: string
  poolSize?: number
}

export interface DashboardConfig {
  port?: number
  autoStart?: boolean
}

export interface CaptureConfig {
  ignoreRoutes?: string[]
  includePaths?: string[]
  maxBodySize?: number
}

export interface EasyDocsConfig {
  project?: string
  ai?: AIConfig
  storage?: StorageConfig
  dashboard?: DashboardConfig
  capture?: CaptureConfig
}
