import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { specifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  DocumentationData,
  HttpMethod,
  processWithAI,
} from "@/lib/ai/openapi-agent";
import { env } from "@/env";

// Original request:  https://dev-supervisor.iseazyengage.com/api/v1/project-users?generatedAt=2025-01-26T23%3A00%3A00.000Z&order=desc&limit=50&page=1&lang=es&projectUid=0193d9ce-ca45-73bb-be92-25c0917f6c80
// New request:  https://localhost:3000/autodoc/api/v1/project-users?generatedAt=2025-01-26T23%3A00%3A00.000Z&order=desc&limit=50&page=1&lang=es&projectUid=0193d9ce-ca45-73bb-be92-25c0917f6c80

async function processRealApiRequest(
  realApiUrl: string,
  req: NextRequest,
  method: HttpMethod
) {
  const realResponse = await fetch(realApiUrl, {
    method,
    headers: req.headers,
    body: method !== "GET" ? await req.text() : undefined,
  });

  const docData: DocumentationData = {
    method,
    path: new URL(realApiUrl).pathname,
    params: Object.fromEntries(new URL(realApiUrl).searchParams.entries()),
    body: method !== "GET" ? await req.json() : null,
    response: await realResponse.json(),
    status: realResponse.status,
    headers: Object.fromEntries(realResponse.headers.entries()),
  };

  return docData;
}

async function handleDatabaseOperation(docData: DocumentationData) {
  const [existingSpec] = await db
    .select()
    .from(specifications)
    .where(
      and(
        eq(specifications.endpoint, docData.path),
        eq(specifications.method, docData.method)
      )
    );

  const document = await processWithAI(docData, existingSpec);

  if (existingSpec) {
    const [updatedSpec] = await db
      .update(specifications)
      .set({ document })
      .where(eq(specifications.id, existingSpec.id))
      .returning();
    return updatedSpec;
  }

  const [newSpec] = await db
    .insert(specifications)
    .values({
      endpoint: docData.path,
      method: docData.method.toUpperCase() as
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE",
      document,
    })
    .returning();
  return newSpec;
}

async function handleDocumentation(req: NextRequest, method: HttpMethod) {
  console.log(`[AutoDoc] Starting documentation process for ${method} request`);
  const realEndpoint = env.REAL_API_ENDPOINT;

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/api/autodoc", "");
    const realApiUrl = `${realEndpoint}${path}${url.search}`;

    console.log(`[AutoDoc] Forwarding request to: ${realApiUrl}`);
    const docData = await processRealApiRequest(realApiUrl, req, method);

    console.log(`[AutoDoc] Starting database operation`);
    const spec = await handleDatabaseOperation(docData);

    return NextResponse.json({
      status: "documented",
      endpoint: spec.endpoint,
      spec: spec.document,
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
