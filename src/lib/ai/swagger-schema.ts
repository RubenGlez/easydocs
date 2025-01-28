import { z } from "zod";

// Helper schemas
const SchemaObject = z.record(z.any()).optional();
const ExampleObject = z.record(z.any()).optional();

// Encoding Object
const EncodingSchema = z.object({
  contentType: z.string().optional(),
  headers: z.record(z.any()).optional(),
  style: z.string().optional(),
  explode: z.boolean().optional(),
  allowReserved: z.boolean().optional(),
});

// Media Type Object
const MediaTypeSchema = z.object({
  schema: SchemaObject,
  example: z.any().optional(),
  examples: z.record(ExampleObject).optional(),
  encoding: z.record(EncodingSchema).optional(),
});

// Parameter Object
const ParameterSchema = z
  .object({
    name: z.string(),
    in: z.enum(["query", "header", "path", "cookie"]),
    description: z.string().optional(),
    required: z.boolean().default(false),
    deprecated: z.boolean().optional(),
    allowEmptyValue: z.boolean().optional(),
    style: z
      .enum([
        "matrix",
        "label",
        "form",
        "simple",
        "spaceDelimited",
        "pipeDelimited",
        "deepObject",
      ])
      .optional(),
    explode: z.boolean().optional(),
    allowReserved: z.boolean().optional(),
    schema: SchemaObject.optional(),
    example: z.any().optional(),
    examples: z.record(ExampleObject).optional(),
    content: z.record(MediaTypeSchema).optional(),
  })
  .refine((data) => !(data.schema && data.content), {
    message: "Parameter cannot have both 'schema' and 'content'",
    path: ["content"],
  });

// Request Body Object
const RequestBodySchema = z.object({
  description: z.string().optional(),
  content: z.record(MediaTypeSchema),
  required: z.boolean().default(false),
});

// Response Object
const ResponseSchema = z.object({
  description: z.string(),
  headers: z.record(z.any()).optional(),
  content: z.record(MediaTypeSchema).optional(),
  links: z.record(z.any()).optional(),
});

// Operation Object (Endpoint)
export const OperationSchema = z.object({
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  operationId: z.string().optional(),
  parameters: z.array(ParameterSchema).optional(),
  requestBody: RequestBodySchema.optional(),
  responses: z
    .record(ResponseSchema)
    .refine(
      (responses) =>
        Object.keys(responses).every((key) => /^[1-5](?:XX|\d{2})$/.test(key)),
      "Invalid HTTP status code format"
    ),
  deprecated: z.boolean().optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),
});

// Full OpenAPI Document Schema
export const OpenAPISchema = z.object({
  openapi: z.literal("3.0.3"),
  info: z.object({
    title: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
  paths: z.record(z.record(OperationSchema)),
  components: z
    .object({
      schemas: z.record(z.any()).optional(),
      responses: z.record(ResponseSchema).optional(),
      parameters: z.record(ParameterSchema).optional(),
      examples: z.record(ExampleObject).optional(),
      requestBodies: z.record(RequestBodySchema).optional(),
      headers: z.record(z.any()).optional(),
      securitySchemes: z.record(z.any()).optional(),
    })
    .optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),
  tags: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

export const swaggerPathSchema = z.object({
  tags: z.array(z.string()),
  summary: z.string(),
  description: z.string(),
  operationId: z.string(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        in: z.string(),
        description: z.string(),
        required: z.boolean(),
        schema: z.object({
          type: z.string(),
        }),
        example: z.any().optional(),
      })
    )
    .optional(),
  requestBody: z
    .object({
      description: z.string(),
      content: z.record(
        z.string(),
        z.object({
          schema: z
            .object({
              type: z.string(),
            })
            .optional(),
        })
      ),
    })
    .optional(),
  responses: z.record(
    z.string(),
    z.object({
      description: z.string(),
      content: z
        .record(
          z.string(),
          z.object({
            schema: z
              .object({
                type: z.string(),
              })
              .optional(),
          })
        )
        .optional(),
    })
  ),
  deprecated: z.boolean().optional(),
});
