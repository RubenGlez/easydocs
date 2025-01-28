import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { and, eq } from "drizzle-orm";
import {
  DocumentationData,
  HttpMethod,
  processWithAI,
} from "@/lib/ai/openapi-agent";
import { endpoints } from "@/db/schema";

// Real API url: https://dev-supervisor.iseazyengage.com/api/v1/project-users?generatedAt=2025-01-26T23%3A00%3A00.000Z&order=desc&limit=50&page=1&lang=es&projectUid=0193d9ce-ca45-73bb-be92-25c0917f6c80
// Proxy url: https://localhost:3000/api/autodoc?endpoint=<real-api-url>

async function processRealApiRequest(
  realApiUrl: string,
  req: NextRequest,
  method: HttpMethod
) {
  console.log(`[AutoDoc] Forwarding request to: ${realApiUrl}`);
  const body = method !== "GET" ? await req.text() : undefined;

  const realResponse = await fetch(realApiUrl, {
    method,
    headers: req.headers,
    body: body,
  });

  const docData: DocumentationData = {
    method,
    path: new URL(realApiUrl).pathname,
    params: Object.fromEntries(new URL(realApiUrl).searchParams.entries()),
    body: body ? JSON.parse(body) : null,
    response: await realResponse.json(),
    status: realResponse.status,
    headers: Object.fromEntries(realResponse.headers.entries()),
  };

  return docData;
}

async function handleDatabaseOperation(docData: DocumentationData) {
  const [existingEndpoint] = await db
    .select()
    .from(endpoints)
    .where(
      and(
        eq(endpoints.path, docData.path),
        eq(endpoints.method, docData.method)
      )
    );

  console.log(`[AutoDoc] Processing with AI`);
  const document = await processWithAI(docData, existingEndpoint);

  if (existingEndpoint) {
    console.log("[AutoDoc] Updating existing endpoint");
    const [updatedEndpoint] = await db
      .update(endpoints)
      .set({ spec: document })
      .where(eq(endpoints.id, existingEndpoint.id))
      .returning();
    return updatedEndpoint;
  }

  console.log("[AutoDoc] Creating new endpoint");
  const [newEndpoint] = await db
    .insert(endpoints)
    .values({
      path: docData.path,
      method: docData.method.toUpperCase() as
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE",
      spec: document,
    })
    .returning();
  return newEndpoint;
}

async function handleDocumentation(req: NextRequest, method: HttpMethod) {
  console.log(`[AutoDoc] Starting documentation process for ${method} request`);

  try {
    const url = new URL(req.url);
    const encodedEndpoint = url.search.replace("?endpoint=", "");

    if (!encodedEndpoint) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required query parameter: endpoint",
        },
        { status: 400 }
      );
    }

    const targetEndpoint = decodeURIComponent(encodedEndpoint);
    const docData = await processRealApiRequest(targetEndpoint, req, method);

    const spec = await handleDatabaseOperation(docData);

    return NextResponse.json({
      status: "documented",
      endpoint: spec.path,
      spec: spec.spec,
    });
  } catch (error) {
    console.error(`[AutoDoc] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType =
      error instanceof Error && "code" in error ? "database" : "processing";

    return NextResponse.json(
      {
        status: "error",
        message: `${
          errorType === "database" ? "Database" : "Documentation"
        } operation failed`,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleDocumentation(req, "GET");
}

export async function POST(req: NextRequest) {
  return handleDocumentation(req, "POST");
}

export async function PUT(req: NextRequest) {
  return handleDocumentation(req, "PUT");
}

export async function PATCH(req: NextRequest) {
  return handleDocumentation(req, "PATCH");
}

export async function DELETE(req: NextRequest) {
  return handleDocumentation(req, "DELETE");
}
