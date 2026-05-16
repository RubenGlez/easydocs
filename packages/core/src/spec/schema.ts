import { z } from 'zod'

const SchemaObject = z.record(z.any()).optional()

const MediaTypeSchema = z.object({
  schema: SchemaObject,
  example: z.any().optional(),
  examples: z.record(z.any()).optional(),
})

const ParameterSchema = z.object({
  name: z.string(),
  in: z.enum(['query', 'header', 'path', 'cookie']),
  description: z.string().optional(),
  required: z.boolean().default(false),
  deprecated: z.boolean().optional(),
  schema: SchemaObject,
  example: z.any().optional(),
})

const ResponseSchema = z.object({
  description: z.string(),
  headers: z.record(z.any()).optional(),
  content: z.record(MediaTypeSchema).optional(),
})

export const OperationSchema = z.object({
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  operationId: z.string().optional(),
  parameters: z.array(ParameterSchema).optional(),
  requestBody: z
    .object({
      description: z.string().optional(),
      required: z.boolean().optional(),
      content: z.record(MediaTypeSchema),
    })
    .nullable()
    .optional(),
  responses: z.record(ResponseSchema).default({}),
  deprecated: z.boolean().optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),
})

export type Operation = z.infer<typeof OperationSchema>
