/**
 * API Documentation Routes
 * Serves OpenAPI spec and Swagger UI
 */

import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiSpec } from "../lib/openapi";

export const docsRouter = new Hono();

/**
 * GET /api/docs
 * Swagger UI interactive documentation
 */
docsRouter.get(
  "/",
  swaggerUI({
    url: "/api/openapi.json",
  })
);

/**
 * GET /api/openapi.json
 * Raw OpenAPI specification in JSON format
 */
docsRouter.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

/**
 * GET /api/openapi.yaml
 * Raw OpenAPI specification in YAML format
 */
docsRouter.get("/openapi.yaml", async (c) => {
  // Dynamic import to avoid bundling yaml if not needed
  const { stringify } = await import("yaml");
  const yamlSpec = stringify(openApiSpec);

  c.header("Content-Type", "text/yaml");
  return c.text(yamlSpec);
});
