/**
 * Unified Error Handling for API
 * Provides consistent error factory functions for all tRPC services
 */

import { TRPCError } from "@trpc/server";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("api-errors");

// ============================================
// ERROR CODES
// ============================================

export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "INTERNAL_SERVER_ERROR"
  | "BAD_GATEWAY"
  | "UNPROCESSABLE_CONTENT";

// ============================================
// ENTITY TYPES
// ============================================

export type EntityType =
  | "invoice"
  | "quotation"
  | "customer"
  | "vendor"
  | "bill"
  | "credit_note"
  | "debit_note"
  | "vault_document"
  | "vault_category"
  | "bank_account"
  | "transaction"
  | "journal_entry"
  | "account"
  | "user"
  | "settings"
  | "submission"
  | "api_key"
  | "webhook"
  | "webhook_delivery";

// ============================================
// ERROR FACTORY FUNCTIONS
// ============================================

/**
 * Create a NOT_FOUND error for an entity
 */
export function notFound(entity: EntityType, id?: string): TRPCError {
  const message = id
    ? `${formatEntityName(entity)} with id "${id}" not found`
    : `${formatEntityName(entity)} not found`;

  logger.warn({ entity, id }, message);

  return new TRPCError({
    code: "NOT_FOUND",
    message,
  });
}

// Helper to conditionally include cause (only in development)
function sanitizeCause(cause: unknown): unknown {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  return cause;
}

/**
 * Create a BAD_REQUEST error for validation failures
 */
export function badRequest(message: string, details?: unknown): TRPCError {
  logger.warn({ details }, `Bad request: ${message}`);

  return new TRPCError({
    code: "BAD_REQUEST",
    message,
    cause: sanitizeCause(details),
  });
}

/**
 * Create an UNAUTHORIZED error
 */
export function unauthorized(message = "Authentication required"): TRPCError {
  return new TRPCError({
    code: "UNAUTHORIZED",
    message,
  });
}

/**
 * Create a FORBIDDEN error
 */
export function forbidden(message = "Access denied"): TRPCError {
  logger.warn({}, `Forbidden: ${message}`);

  return new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

/**
 * Create a CONFLICT error for duplicate resources
 */
export function conflict(entity: EntityType, field?: string): TRPCError {
  const message = field
    ? `${formatEntityName(entity)} with this ${field} already exists`
    : `${formatEntityName(entity)} already exists`;

  logger.warn({ entity, field }, message);

  return new TRPCError({
    code: "CONFLICT",
    message,
  });
}

/**
 * Create a PRECONDITION_FAILED error for business logic violations
 */
export function preconditionFailed(message: string): TRPCError {
  logger.warn({}, `Precondition failed: ${message}`);

  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message,
  });
}

/**
 * Create an INTERNAL_SERVER_ERROR with logging
 */
export function internalError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): TRPCError {
  logger.error({ err: error, ...context }, `Internal error: ${message}`);

  // In production, return generic message to avoid leaking internal details
  const safeMessage =
    process.env.NODE_ENV === "production"
      ? "An internal error occurred"
      : message;

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: safeMessage,
    cause: sanitizeCause(error),
  });
}

/**
 * Create a BAD_GATEWAY error for external service failures
 */
export function badGateway(service: string, message?: string): TRPCError {
  const fullMessage = message
    ? `${service} error: ${message}`
    : `Failed to communicate with ${service}`;

  logger.error({ service }, fullMessage);

  return new TRPCError({
    code: "BAD_GATEWAY",
    message: fullMessage,
  });
}

/**
 * Create an UNPROCESSABLE_CONTENT error
 */
export function unprocessable(message: string, details?: unknown): TRPCError {
  logger.warn({ details }, `Unprocessable: ${message}`);

  return new TRPCError({
    code: "UNPROCESSABLE_CONTENT",
    message,
    cause: sanitizeCause(details),
  });
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Create a validation error from an array of error messages
 */
export function validationError(errors: string[]): TRPCError {
  return badRequest(`Validation failed: ${errors.join(", ")}`);
}

/**
 * Assert that a value is truthy, throw NOT_FOUND otherwise
 */
export function assertFound<T>(
  value: T | null | undefined,
  entity: EntityType,
  id?: string
): asserts value is T {
  if (!value) {
    throw notFound(entity, id);
  }
}

/**
 * Assert a condition is true, throw PRECONDITION_FAILED otherwise
 */
export function assertPrecondition(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw preconditionFailed(message);
  }
}

// ============================================
// ERROR WRAPPING
// ============================================

/**
 * Wrap an async operation with consistent error handling
 */
export async function wrapAsync<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw internalError(errorMessage, error, context);
  }
}

/**
 * Wrap a database operation with consistent error handling
 */
export async function wrapDbOperation<T>(
  operation: () => Promise<T>,
  entity: EntityType,
  action: "create" | "update" | "delete" | "fetch",
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw internalError(
      `Failed to ${action} ${formatEntityName(entity)}`,
      error,
      context
    );
  }
}

// ============================================
// HELPERS
// ============================================

function formatEntityName(entity: EntityType): string {
  return entity
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================
// RE-EXPORT TRPC ERROR FOR CONVENIENCE
// ============================================

export { TRPCError };
