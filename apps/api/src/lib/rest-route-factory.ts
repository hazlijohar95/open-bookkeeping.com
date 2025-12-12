/**
 * REST Route Factory
 * Creates standardized CRUD routes for any entity
 * Follows best practices with consistent error handling and validation
 */

import { Hono, Context } from "hono";
import { z, ZodSchema, ZodError } from "zod";
import { authenticateRequest, AuthenticatedUser } from "./auth-helpers";

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error response type
interface ErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

// Success response for delete operations
interface DeleteResponse {
  success: true;
}

// Pagination schema (reusable)
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// UUID validation schema
export const uuidParamSchema = z.string().uuid();

/**
 * Standard error response helper
 */
export function errorResponse(
  c: Context,
  status: number,
  message: string,
  details?: unknown
): Response {
  const body: ErrorResponse = { error: message };
  if (details) body.details = details;
  return c.json(body, status as 400);
}

/**
 * Handle Zod validation errors
 */
export function handleValidationError(c: Context, error: ZodError): Response {
  return errorResponse(
    c,
    HTTP_STATUS.BAD_REQUEST,
    "Validation failed",
    error.flatten()
  );
}

/**
 * Authentication middleware helper
 * Returns user or sends error response
 */
export async function requireAuth(
  c: Context
): Promise<AuthenticatedUser | Response> {
  const user = await authenticateRequest(c.req.header("Authorization"));
  if (!user) {
    return errorResponse(c, HTTP_STATUS.UNAUTHORIZED, "Unauthorized");
  }
  return user;
}

/**
 * Generic repository interface for CRUD operations
 */
export interface CrudRepository<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TQueryOptions = { limit?: number; offset?: number }
> {
  findMany(userId: string, options?: TQueryOptions): Promise<TEntity[]>;
  findById(id: string, userId: string): Promise<TEntity | null>;
  create(input: TCreateInput & { userId: string }): Promise<TEntity>;
  update(id: string, userId: string, input: TUpdateInput): Promise<TEntity | null>;
  delete(id: string, userId: string): Promise<boolean>;
  search?(userId: string, query: string): Promise<TEntity[]>;
}

/**
 * Route configuration for CRUD operations
 */
export interface CrudRouteConfig<TCreateInput, TUpdateInput> {
  /** Zod schema for create operations */
  createSchema: ZodSchema<TCreateInput>;
  /** Zod schema for update operations */
  updateSchema: ZodSchema<TUpdateInput>;
  /** Entity name for error messages */
  entityName: string;
  /** Whether to include search endpoint */
  includeSearch?: boolean;
}

/**
 * Create a standard CRUD router for an entity
 */
export function createCrudRouter<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TQueryOptions extends { limit?: number; offset?: number } = { limit?: number; offset?: number }
>(
  repository: CrudRepository<TEntity, TCreateInput, TUpdateInput, TQueryOptions>,
  config: CrudRouteConfig<TCreateInput, TUpdateInput>
): Hono {
  const router = new Hono();
  const { createSchema, updateSchema, entityName, includeSearch } = config;

  // GET / - List all with pagination
  router.get("/", async (c) => {
    const authResult = await requireAuth(c);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    try {
      const query = c.req.query();
      const pagination = paginationQuerySchema.parse(query);
      const entities = await repository.findMany(user.id, pagination as TQueryOptions);
      return c.json(entities);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(c, error);
      }
      console.error(`Error fetching ${entityName}s:`, error);
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to fetch ${entityName}s`);
    }
  });

  // GET /search - Search entities (if enabled)
  if (includeSearch && repository.search) {
    router.get("/search", async (c) => {
      const authResult = await requireAuth(c);
      if (authResult instanceof Response) return authResult;
      const user = authResult;

      try {
        const query = c.req.query("q") ?? "";
        const entities = await repository.search!(user.id, query);
        return c.json(entities);
      } catch (error) {
        console.error(`Error searching ${entityName}s:`, error);
        return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to search ${entityName}s`);
      }
    });
  }

  // GET /:id - Get single entity
  router.get("/:id", async (c) => {
    const authResult = await requireAuth(c);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse(id);
    if (!parseResult.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, `Invalid ${entityName} ID format`);
    }

    try {
      const entity = await repository.findById(id, user.id);
      if (!entity) {
        return errorResponse(c, HTTP_STATUS.NOT_FOUND, `${entityName} not found`);
      }
      return c.json(entity);
    } catch (error) {
      console.error(`Error fetching ${entityName}:`, error);
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to fetch ${entityName}`);
    }
  });

  // POST / - Create new entity
  router.post("/", async (c) => {
    const authResult = await requireAuth(c);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    try {
      const body = await c.req.json();
      const parseResult = createSchema.safeParse(body);
      if (!parseResult.success) {
        return handleValidationError(c, parseResult.error);
      }

      const entity = await repository.create({
        ...parseResult.data,
        userId: user.id,
      });
      return c.json(entity, HTTP_STATUS.CREATED);
    } catch (error) {
      console.error(`Error creating ${entityName}:`, error);
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to create ${entityName}`);
    }
  });

  // PATCH /:id - Update entity
  router.patch("/:id", async (c) => {
    const authResult = await requireAuth(c);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    const id = c.req.param("id");
    const uuidResult = uuidParamSchema.safeParse(id);
    if (!uuidResult.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, `Invalid ${entityName} ID format`);
    }

    try {
      const body = await c.req.json();
      const parseResult = updateSchema.safeParse(body);
      if (!parseResult.success) {
        return handleValidationError(c, parseResult.error);
      }

      const entity = await repository.update(id, user.id, parseResult.data);
      if (!entity) {
        return errorResponse(c, HTTP_STATUS.NOT_FOUND, `${entityName} not found`);
      }
      return c.json(entity);
    } catch (error) {
      console.error(`Error updating ${entityName}:`, error);
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to update ${entityName}`);
    }
  });

  // DELETE /:id - Delete entity
  router.delete("/:id", async (c) => {
    const authResult = await requireAuth(c);
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    const id = c.req.param("id");
    const uuidResult = uuidParamSchema.safeParse(id);
    if (!uuidResult.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, `Invalid ${entityName} ID format`);
    }

    try {
      const deleted = await repository.delete(id, user.id);
      if (!deleted) {
        return errorResponse(c, HTTP_STATUS.NOT_FOUND, `${entityName} not found`);
      }
      return c.json({ success: true } as DeleteResponse);
    } catch (error) {
      console.error(`Error deleting ${entityName}:`, error);
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, `Failed to delete ${entityName}`);
    }
  });

  return router;
}
