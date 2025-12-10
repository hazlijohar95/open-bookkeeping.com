/**
 * Standardized API Response Helpers
 * Follows consistent response envelope pattern for public API v1
 */

import type { Context } from "hono";

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Standard API success response envelope
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Standard API list response with pagination
 */
export interface ApiListResponse<T> {
  data: T[];
  pagination: {
    total?: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Standard API error response envelope
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// ============================================
// HTTP STATUS CODES
// ============================================

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

// ============================================
// ERROR CODES
// ============================================

export const ErrorCode = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_API_KEY: "INVALID_API_KEY",
  EXPIRED_API_KEY: "EXPIRED_API_KEY",
  REVOKED_API_KEY: "REVOKED_API_KEY",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_ID_FORMAT: "INVALID_ID_FORMAT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get request ID from context
 */
function getRequestId(c: Context): string {
  return c.res.headers.get("X-Request-Id") ?? `req_${Date.now()}`;
}

/**
 * Get current timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create success response
 */
export function success<T>(c: Context, data: T, status: HttpStatusCode = HttpStatus.OK): Response {
  const response: ApiSuccessResponse<T> = {
    data,
    meta: {
      requestId: getRequestId(c),
      timestamp: getTimestamp(),
    },
  };
  return c.json(response, status as 200);
}

/**
 * Create list response with pagination
 */
export function list<T>(
  c: Context,
  data: T[],
  pagination: { limit: number; offset: number; total?: number }
): Response {
  const hasMore = pagination.total
    ? pagination.offset + data.length < pagination.total
    : data.length === pagination.limit;

  const response: ApiListResponse<T> = {
    data,
    pagination: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore,
    },
    meta: {
      requestId: getRequestId(c),
      timestamp: getTimestamp(),
    },
  };
  return c.json(response, HttpStatus.OK);
}

/**
 * Create error response
 */
export function error(
  c: Context,
  status: HttpStatusCode,
  code: ErrorCodeType,
  message: string,
  details?: unknown
): Response {
  const errorObj: ApiErrorResponse["error"] = {
    code,
    message,
  };
  if (details) {
    errorObj.details = details;
  }
  const response: ApiErrorResponse = {
    error: errorObj,
    meta: {
      requestId: getRequestId(c),
      timestamp: getTimestamp(),
    },
  };
  return c.json(response, status as 400);
}

/**
 * Create created response (201)
 */
export function created<T>(c: Context, data: T): Response {
  return success(c, data, HttpStatus.CREATED);
}

/**
 * Create no content response (204)
 */
export function noContent(c: Context): Response {
  c.status(HttpStatus.NO_CONTENT);
  return c.body(null);
}

/**
 * Create deleted response
 */
export function deleted(c: Context): Response {
  return success(c, { deleted: true });
}

// ============================================
// ERROR SHORTCUTS
// ============================================

export function unauthorized(c: Context, message = "Authentication required"): Response {
  return error(c, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, message);
}

export function forbidden(c: Context, message = "Insufficient permissions"): Response {
  return error(c, HttpStatus.FORBIDDEN, ErrorCode.INSUFFICIENT_PERMISSIONS, message);
}

export function notFound(c: Context, resource: string, id?: string): Response {
  const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
  return error(c, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message);
}

export function badRequest(c: Context, message: string, details?: unknown): Response {
  return error(c, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, message, details);
}

export function validationError(c: Context, details: unknown): Response {
  return error(c, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, "Validation failed", details);
}

export function conflict(c: Context, message: string): Response {
  return error(c, HttpStatus.CONFLICT, ErrorCode.CONFLICT, message);
}

export function rateLimitExceeded(c: Context, retryAfter?: number): Response {
  if (retryAfter) {
    c.header("Retry-After", String(retryAfter));
  }
  return error(c, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMIT_EXCEEDED, "Rate limit exceeded");
}

export function internalError(c: Context, message = "An internal error occurred"): Response {
  return error(c, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, message);
}

// ============================================
// VALIDATION HELPERS
// ============================================

import { z, ZodError } from "zod";

/**
 * Handle Zod validation errors
 */
export function handleZodError(c: Context, err: ZodError): Response {
  return validationError(c, err.flatten());
}

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Pagination query schema
 * Max limit: 500 records per request to prevent memory exhaustion
 * Default: 50 records for reasonable page sizes
 */
export const MAX_PAGINATION_LIMIT = 500;
export const DEFAULT_PAGINATION_LIMIT = 50;

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(MAX_PAGINATION_LIMIT).default(DEFAULT_PAGINATION_LIMIT),
  offset: z.coerce.number().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * Parse pagination from query params
 */
export function parsePagination(c: Context): PaginationQuery {
  const query = c.req.query();
  return paginationSchema.parse(query);
}

/**
 * Validate UUID parameter
 */
export function validateUuid(c: Context, id: string, resourceName: string): string | Response {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    return error(c, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_ID_FORMAT, `Invalid ${resourceName} ID format`);
  }
  return id;
}

/**
 * Parse an integer safely from a query parameter.
 * Returns the default value if the parameter is missing, empty, or invalid.
 * Clamps the result to the specified min/max range.
 */
export function parseIntSafe(
  value: string | undefined | null,
  defaultValue: number,
  options: { min?: number; max?: number } = {}
): number {
  if (!value || value.trim() === "") {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  // Check for NaN or invalid values
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  // Apply min/max constraints
  let result = parsed;
  if (options.min !== undefined) {
    result = Math.max(result, options.min);
  }
  if (options.max !== undefined) {
    result = Math.min(result, options.max);
  }

  return result;
}
