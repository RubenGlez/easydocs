import { z } from "zod";

// Helper schemas
const SchemaObject = z.record(z.any()).optional().describe("Schema definition");
const ExampleObject = z.record(z.any()).optional().describe("Example object");

// Encoding Object
const EncodingSchema = z.object({
  contentType: z
    .string()
    .optional()
    .describe("The content type of the encoding"),
  headers: z.record(z.any()).optional().describe("Headers for the encoding"),
  style: z.string().optional().describe("The style of the encoding"),
  explode: z
    .boolean()
    .optional()
    .describe(
      "When true, parameter values will be serialized as separate parameters"
    ),
  allowReserved: z
    .boolean()
    .optional()
    .describe("Determines whether reserved characters should be allowed"),
});

// Media Type Object
const MediaTypeSchema = z.object({
  schema: SchemaObject.describe(
    "The schema defining the type used for the request body"
  ),
  example: z.any().optional().describe("Example of the media type"),
  examples: z
    .record(ExampleObject)
    .optional()
    .describe("Examples of the media type"),
  encoding: z
    .record(EncodingSchema)
    .optional()
    .describe("Encoding for the request body"),
});

// Parameter Object
const ParameterSchema = z
  .object({
    name: z.string().describe("The name of the parameter"),
    in: z
      .enum(["query", "header", "path", "cookie"])
      .describe("The location of the parameter"),
    description: z
      .string()
      .optional()
      .describe("A brief description of the parameter"),
    required: z
      .boolean()
      .default(false)
      .describe("Determines whether this parameter is mandatory"),
    deprecated: z
      .boolean()
      .optional()
      .describe("Specifies that a parameter is deprecated"),
    allowEmptyValue: z
      .boolean()
      .optional()
      .describe("Allows sending empty-valued parameters"),
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
      .optional()
      .describe("Describes how the parameter value will be serialized"),
    explode: z
      .boolean()
      .optional()
      .describe(
        "When true, parameter values will be serialized as separate parameters"
      ),
    allowReserved: z
      .boolean()
      .optional()
      .describe("Determines whether reserved characters should be allowed"),
    schema: SchemaObject.optional().describe(
      "The schema defining the type used for the parameter"
    ),
    example: z
      .any()
      .optional()
      .describe("Example of the parameter's potential value"),
    examples: z
      .record(ExampleObject)
      .optional()
      .describe("Examples of the parameter's potential value"),
    content: z
      .record(MediaTypeSchema)
      .optional()
      .describe("The content of the parameter"),
  })
  .refine((data) => !(data.schema && data.content), {
    message: "Parameter cannot have both 'schema' and 'content'",
    path: ["content"],
  });

// Request Body Object
const RequestBodySchema = z.object({
  description: z
    .string()
    .optional()
    .describe("A brief description of the request body"),
  content: z
    .record(MediaTypeSchema)
    .describe("The content of the request body"),
  required: z
    .boolean()
    .default(false)
    .describe("Determines if the request body is required"),
});

// Response Object
const ResponseSchema = z.object({
  description: z.string().describe("A description of the response"),
  headers: z
    .record(z.any())
    .optional()
    .describe("Headers that can be sent with the response"),
  content: z
    .record(MediaTypeSchema)
    .optional()
    .describe("The content of the response"),
  links: z.record(z.any()).optional().describe("Links to other operations"),
});

// Operation Object (Endpoint)
export const OperationSchema = z.object({
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags for API documentation control"),
  summary: z
    .string()
    .optional()
    .describe("A brief summary of what the operation does"),
  description: z
    .string()
    .optional()
    .describe("A detailed explanation of the operation behavior"),
  operationId: z
    .string()
    .optional()
    .describe("Unique identifier for the operation"),
  parameters: z
    .array(ParameterSchema)
    .optional()
    .describe("Parameters expected by the operation"),
  requestBody: RequestBodySchema.optional()
    .refine((body) => !body || body.content, {
      message: "requestBody must include content if present",
    })
    .describe(
      "The request body applicable for this operation (Only required for POST, PUT, PATCH, DELETE)"
    ),
  responses: z
    .record(ResponseSchema)
    .default({})
    .describe(
      "The list of possible responses as they are returned from executing this operation"
    ),
  deprecated: z
    .boolean()
    .optional()
    .describe("Declares this operation to be deprecated"),
  security: z
    .array(z.record(z.array(z.string())))
    .optional()
    .describe("Security requirements for the operation"),
});
