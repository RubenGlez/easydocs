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
  const { method, path, params, body, response, status, headers } = docData;

  const isPaginated = Array.isArray(response.data);
  const cleanedResponse = isPaginated
    ? {
        ...response,
        data: (response as { data: unknown[] }).data.slice(0, 1),
      }
    : response;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4-turbo"),
      system: [
        "You are an OpenAPI and Swagger expert. Generate OpenAPI 3.0 spec JSON using the given parameters.",
        "Guidelines:",
        "- If there is no current spec, generate a new spec",
        "- If there is a current spec, use it as a base to generate the new spec",
        "- The 'responses' field is REQUIRED and must include the example status code",
        "- If using requestBody, it MUST include a 'content' property with media type",
      ].join("\n"),
      schema: OperationSchema,
      prompt: [
        `These are the parameters you can use:`,
        `- Method: ${method}`,
        `- Path: ${path}`,
        `- Query Params: ${JSON.stringify(params)}`,
        `- Request Body: ${body ? JSON.stringify(body) : ""}`,
        `- Example Response (${status}): ${JSON.stringify(cleanedResponse)}`,
        `- MUST include this status code (${status}) in the 'responses' field`,
        `- Response Headers: ${JSON.stringify(headers)}`,
        `- Required: Include 'responses' with status ${status} and description`,
        `- Required for POST/PUT: requestBody.content if body exists`,
        previousEndpoint
          ? `- Current Spec: ${JSON.stringify(previousEndpoint)}`
          : "",
      ].join("\n"),
    });

    return object;
  } catch (error) {
    console.error("AI Processing Error:", error);
    throw error;
  }
}
