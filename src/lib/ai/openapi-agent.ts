import { Specification } from "@/db/schema";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestParams {
  query?: Record<string, string>;
  path?: Record<string, string>;
}

export interface DocumentationData {
  method: HttpMethod;
  path: string;
  params: RequestParams;
  body: Record<string, unknown> | null;
  response: Record<string, unknown>;
  status: number;
  headers: Record<string, string>;
}

export async function processWithAI(
  docData: DocumentationData,
  previousSpecification?: Specification
) {
  const isPaginated = Array.isArray(docData.response.data);

  const cleanedResponse = isPaginated
    ? {
        ...docData.response,
        data: (docData.response as { data: unknown[] }).data.slice(0, 1),
      }
    : docData.response;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4-turbo"),
      system: [
        "Generate an OpenAPI specification in JSON format. The specification should include:",
        "- request_schema: JSON Schema for the request body",
        "- response_schema: JSON Schema for the response body",
        "- examples: { request: any, response: any }",
        "- parameters: { in: 'query'|'path', name: string, schema: JSON Schema }[]",
        "- description: A detailed description of the endpoint",
        "\nEnsure the specification is compatible with OpenAPI 3.0. If a previous specification is provided, use it as a reference to maintain consistency.",
      ].join("\n"),
      schema: z.object({
        request_schema: z.any(),
        response_schema: z.any(),
        examples: z.object({
          request: z.any(),
          response: z.any(),
        }),
        parameters: z.array(
          z.object({
            in: z.enum(["query", "path"]),
            name: z.string(),
            schema: z.any(),
          })
        ),
        description: z.string(),
      }),
      prompt: [
        "Generate an OpenAPI specification for the following endpoint:",
        `- Method: ${docData.method}`,
        `- Path: ${docData.path}`,
        `- Parameters: ${docData.params}`,
        `- Body: ${docData.body}`,
        `- Response: ${cleanedResponse}`,
        `- Status: ${docData.status}`,
        `- Headers: ${docData.headers}`,
        previousSpecification ? "\nPrevious specification:" : "",
        previousSpecification ? JSON.stringify(previousSpecification) : "",
      ].join("\n"),
    });

    return object;
  } catch (error) {
    console.error("AI Processing Error:", error);
    throw error;
  }
}
