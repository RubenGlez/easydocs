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
        "You are an OpenAPI specification expert. Generate or update an OpenAPI 3.0 specification in JSON format.",
        "When a previous specification is provided:",
        "1. Maintain consistency with existing schemas and naming conventions",
        "2. Preserve any additional properties or metadata present in the previous specification",
        "3. Only update or enhance the specification based on new information",
        "4. Keep existing descriptions if they are more detailed than what you would generate",
        "\nThe specification must include:",
        "- request_schema: JSON Schema for the request body, with detailed property descriptions",
        "- response_schema: JSON Schema for the response body, with detailed property descriptions",
        "- examples: { request: realistic example, response: realistic example }",
        "- parameters: { in: 'query'|'path', name: string, schema: JSON Schema, description: string }[]",
        "- description: A comprehensive description of the endpoint including its purpose and usage",
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
            description: z.string(),
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
        previousSpecification
          ? "\nPrevious specification: (maintain consistency with this):"
          : "",
        previousSpecification ? JSON.stringify(previousSpecification) : "",
      ].join("\n"),
    });

    return object;
  } catch (error) {
    console.error("AI Processing Error:", error);
    throw error;
  }
}
