import { db } from "@/db/drizzle";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default async function HomePage() {
  const allEndpoints = await db.query.endpoints.findMany({
    orderBy: (endpoints, { desc }) => [desc(endpoints.createdAt)],
  });

  console.log("Raw endpoints:", allEndpoints);

  const fullSpec = {
    openapi: "3.0.3",
    info: { title: "My API", version: "1.0.0" },
    paths: allEndpoints?.reduce(
      (acc, endpoint) => ({
        ...acc,
        [endpoint.path]: {
          [endpoint.method.toLowerCase()]: endpoint.spec,
        },
      }),
      {}
    ),
    components: {},
    tags: [],
  };

  console.log("fullSpec", JSON.stringify(fullSpec, null, 2));

  return <SwaggerUI spec={fullSpec} />;
}
