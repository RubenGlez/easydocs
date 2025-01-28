import { Endpoint } from "@/db/schema";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { OperationSchema } from "./swagger-schema";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface DocumentationData {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  body: Record<string, unknown> | null;
  response: Record<string, unknown>;
  status: number;
  headers: Record<string, string>;
}

export async function processWithAI(
  docData: DocumentationData,
  previousEndpoint?: Endpoint
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
        "You are an OpenAPI expert. Generate/update OpenAPI 3.0 spec JSON strictly following OperationSchema.",
        "Critical Requirements:",
        "- responses field is REQUIRED and must contain at least one status code",
        "- Include content-type based on response headers when available",
        "- response schema must match the example response structure",
        "- Maintain previous schema structure when updating",
        "- Validate output against schema before responding",
      ].join("\n"),
      schema: OperationSchema,
      prompt: [
        `Generate OpenAPI operation for: ${docData.method} ${docData.path}`,
        `Required Sections: parameters, requestBody (if applicable), responses`,
        `Params: ${JSON.stringify(docData.params)}`,
        `Body: ${docData.body ? JSON.stringify(docData.body) : "None"}`,
        `Example Response (${docData.status}): ${JSON.stringify(
          cleanedResponse,
          null,
          2
        )}`,
        `Response Headers: ${JSON.stringify(docData.headers)}`,
        previousEndpoint
          ? `Current Spec: ${JSON.stringify(previousEndpoint)}`
          : "",
      ].join("\n\n"),
    });

    return object;
  } catch (error) {
    console.error("AI Processing Error:", error);
    throw error;
  }
}
