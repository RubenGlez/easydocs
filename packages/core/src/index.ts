export { createCapturer } from './capture.js'
export type { Capturer } from './capture.js'
export { createAdapter } from './storage/adapter.js'
export type { DatabaseAdapter } from './storage/adapter.js'
export {
  createDB,
  getAllEndpoints,
  getEndpointsByProject,
  getAllProjects,
  getEndpointVersions,
  findOrCreateProject,
  deleteEndpointById,
  saveManualSpec,
  resolveConflict,
} from './storage/sqlite.js'
export {
  createPgDB,
  pgGetAll,
  pgGetEndpointsByProject,
  pgGetAllProjects,
  pgDeleteById,
  pgSaveManualSpec,
} from './storage/postgres.js'
export { buildOperation } from './spec/builder.js'
export { buildFullSpec } from './spec/assemble.js'
export { diffSpecs, renderDiff, isEmptyDiff } from './spec/diff.js'
export type { SpecDiff, RenderDiffOptions } from './spec/diff.js'
export { OperationSchema } from './spec/schema.js'
export type { Operation } from './spec/schema.js'
export { buildCaptureEvent, tryParseJson } from './event.js'
export type { RawCaptureInput } from './event.js'
export { parseConfig, EasyDocsConfigSchema } from './types.js'
export type { CaptureEvent, EasyDocsConfig, HttpMethod, AIConfig, StorageConfig, PrivacyConfig } from './types.js'
export { detect, markSensitiveProperties } from './privacy/detect.js'
export type { DetectResult } from './privacy/detect.js'
