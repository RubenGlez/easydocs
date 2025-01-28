import { db } from "@/db/drizzle";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import {
  generateOpenAPIDoc,
  OpenAPIDocument,
  ApiEndpointDetails,
} from "@/lib/openapi/generate";

export default async function HomePage() {
  const allSpecs = await db.query.specifications.findMany({
    orderBy: (specs, { desc }) => [desc(specs.createdAt)],
  });

  const fullSpec = allSpecs.reduce<OpenAPIDocument>(
    (acc, spec) => {
      const document = spec.document as ApiEndpointDetails;

      const singleSpec = generateOpenAPIDoc({
        path: spec.endpoint,
        method: spec.method.toLowerCase() as
          | "get"
          | "post"
          | "put"
          | "delete"
          | "patch",
        details: document,
      });

      // Merge the paths from singleSpec into acc
      acc.paths = {
        ...acc.paths,
        ...singleSpec.paths,
      };

      return acc;
    },
    {
      openapi: "3.0.3",
      info: { title: "API Documentation", version: "1.0" },
      tags: [],
      paths: {},
    }
  );

  return <SwaggerUI spec={fullSpec} />;
}
