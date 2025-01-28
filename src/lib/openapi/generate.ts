export interface OpenAPIDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  tags: string[];
}

interface OpenAPISchema {
  type?: string | string[];
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  nullable?: boolean;
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  enum?: (string | number)[];
  pattern?: string;
  description?: string;
}

export interface ApiEndpointDetails {
  examples: {
    request: unknown;
    response: unknown;
  };
  parameters: Array<{
    in: "query" | "path" | "header" | "cookie";
    name: string;
    schema: OpenAPISchema;
    description?: string;
  }>;
  description: string;
  request_schema: OpenAPISchema | null;
  response_schema: OpenAPISchema;
}

interface GenerateOpenAPIOptions {
  path: string;
  method: "get" | "post" | "put" | "delete" | "patch";
  details: ApiEndpointDetails;
  info?: {
    title?: string;
    version?: string;
  };
}

interface OpenAPIResponse {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: {
    [path: string]: {
      [method: string]: {
        description: string;
        parameters: Array<{
          in: string;
          name: string;
          schema: OpenAPISchema;
          description?: string;
        }>;
        responses: {
          "200": {
            description: string;
            content: {
              "application/json": {
                schema: OpenAPISchema;
                example?: unknown;
              };
            };
          };
        };
        requestBody?: {
          content: {
            "application/json": {
              schema: OpenAPISchema;
              example?: unknown;
            };
          };
        };
        tags: string[];
      };
    };
  };
}

function processSchema(schema: OpenAPISchema): OpenAPISchema {
  if (!schema) return schema;

  // Handle null type
  if (schema.type === "null") {
    return { ...schema, type: "string", nullable: true };
  }

  // Handle type arrays
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((t) => t !== "null");
    const hasNull = schema.type.includes("null");

    if (types.length === 1) {
      return {
        ...schema,
        type: types[0],
        nullable: hasNull ? true : undefined,
      };
    }
  }

  // Process nested properties
  if (schema.properties) {
    const processedProps: Record<string, OpenAPISchema> = {};
    for (const key in schema.properties) {
      processedProps[key] = processSchema(schema.properties[key]);
    }
    return { ...schema, properties: processedProps };
  }

  if (schema.items) return { ...schema, items: processSchema(schema.items) };

  ["anyOf", "oneOf", "allOf"].forEach((key) => {
    if (schema[key as keyof Pick<OpenAPISchema, "anyOf" | "oneOf" | "allOf">]) {
      schema[key as keyof Pick<OpenAPISchema, "anyOf" | "oneOf" | "allOf">] =
        schema[
          key as keyof Pick<OpenAPISchema, "anyOf" | "oneOf" | "allOf">
        ]?.map(processSchema);
    }
  });

  return schema;
}

export function generateOpenAPIDoc(
  options: GenerateOpenAPIOptions
): OpenAPIResponse {
  const { path, method, details, info } = options;

  // Get tag from path (e.g., /api/v1/project-users -> project-users)
  const tag = path.split("/").pop() || path;
  const tagName = tag
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const processedParams = details.parameters.map((param) => ({
    ...param,
    schema: processSchema(param.schema),
  }));

  const processedResponseSchema = processSchema(details.response_schema);
  const processedRequestSchema = details.request_schema
    ? processSchema(details.request_schema)
    : null;

  return {
    openapi: "3.0.3",
    info: {
      title: info?.title || "API Documentation",
      version: info?.version || "1.0.0",
    },
    paths: {
      [path]: {
        [method]: {
          tags: [tagName],
          description: details.description,
          parameters: processedParams,
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: processedResponseSchema,
                  example: details.examples.response,
                },
              },
            },
          },
          ...(processedRequestSchema &&
          ["post", "put", "patch"].includes(method)
            ? {
                requestBody: {
                  content: {
                    "application/json": {
                      schema: processedRequestSchema,
                      example: details.examples.request,
                    },
                  },
                },
              }
            : {}),
        },
      },
    },
  };
}
