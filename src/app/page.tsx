import { db } from "@/db/drizzle";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export interface OpenAPIDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

export default async function HomePage() {
  const allSpecs = await db.query.specifications.findMany({
    orderBy: (specs, { desc }) => [desc(specs.createdAt)],
  });

  const fullSpec = allSpecs.reduce<OpenAPIDocument>(
    (acc, spec) => {
      const document = spec.document as Record<string, unknown>;
      acc.paths[spec.endpoint] = acc.paths[spec.endpoint] || {};
      acc.paths[spec.endpoint][spec.method.toLowerCase()] = document;
      return acc;
    },
    {
      openapi: "3.0.0",
      info: { title: "API Docs", version: "1.0" },
      paths: {},
    }
  );

  return <SwaggerUI spec={fullSpec} />;
}
