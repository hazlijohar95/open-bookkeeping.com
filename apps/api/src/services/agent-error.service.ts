/**
 * Agent Error Service
 *
 * Structured error handling with intelligent classification,
 * recovery suggestions, and retry logic for AI agent operations.
 */

import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("agent-error-service");

// ============================================
// ERROR TYPES & CLASSIFICATION
// ============================================

export type ErrorCategory =
  | "validation" // Input validation failed
  | "permission" // Access denied
  | "not_found" // Resource not found
  | "rate_limit" // Rate/quota exceeded
  | "dependency" // External service failure
  | "llm" // LLM provider error
  | "tool" // Tool execution error
  | "timeout" // Operation timed out
  | "conflict" // State conflict
  | "system" // Internal system error
  | "unknown"; // Unclassified

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface RecoverySuggestion {
  action: string;
  description: string;
  automatic: boolean;
  priority: number;
}

export interface StructuredError {
  // Core identification
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;

  // Human-readable
  title: string;
  message: string;
  details?: string;

  // Recovery
  recoverable: boolean;
  suggestions: RecoverySuggestion[];
  retryable: boolean;
  retryDelayMs?: number;
  maxRetries?: number;

  // Context
  context?: {
    toolName?: string;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    sessionId?: string;
  };

  // Original error
  originalError?: Error;
  stack?: string;
}

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  // Validation errors (1xxx)
  INVALID_INPUT: "ERR_1001",
  MISSING_REQUIRED_FIELD: "ERR_1002",
  INVALID_FORMAT: "ERR_1003",
  VALUE_OUT_OF_RANGE: "ERR_1004",
  DUPLICATE_ENTRY: "ERR_1005",

  // Permission errors (2xxx)
  UNAUTHORIZED: "ERR_2001",
  FORBIDDEN: "ERR_2002",
  QUOTA_EXCEEDED: "ERR_2003",
  APPROVAL_REQUIRED: "ERR_2004",
  EMERGENCY_STOP_ACTIVE: "ERR_2005",

  // Not found errors (3xxx)
  RESOURCE_NOT_FOUND: "ERR_3001",
  CUSTOMER_NOT_FOUND: "ERR_3002",
  VENDOR_NOT_FOUND: "ERR_3003",
  INVOICE_NOT_FOUND: "ERR_3004",
  ACCOUNT_NOT_FOUND: "ERR_3005",

  // Rate limit errors (4xxx)
  RATE_LIMITED: "ERR_4001",
  DAILY_LIMIT_EXCEEDED: "ERR_4002",
  TOKEN_LIMIT_EXCEEDED: "ERR_4003",
  AMOUNT_LIMIT_EXCEEDED: "ERR_4004",

  // Dependency errors (5xxx)
  DATABASE_ERROR: "ERR_5001",
  EXTERNAL_SERVICE_ERROR: "ERR_5002",
  NETWORK_ERROR: "ERR_5003",
  STORAGE_ERROR: "ERR_5004",

  // LLM errors (6xxx)
  LLM_PROVIDER_ERROR: "ERR_6001",
  LLM_TIMEOUT: "ERR_6002",
  LLM_CONTENT_FILTER: "ERR_6003",
  LLM_CONTEXT_LENGTH: "ERR_6004",
  LLM_RATE_LIMITED: "ERR_6005",

  // Tool errors (7xxx)
  TOOL_EXECUTION_FAILED: "ERR_7001",
  TOOL_NOT_FOUND: "ERR_7002",
  TOOL_TIMEOUT: "ERR_7003",
  TOOL_INVALID_ARGS: "ERR_7004",
  TOOL_PERMISSION_DENIED: "ERR_7005",

  // Timeout errors (8xxx)
  OPERATION_TIMEOUT: "ERR_8001",
  REQUEST_TIMEOUT: "ERR_8002",
  STREAM_TIMEOUT: "ERR_8003",

  // Conflict errors (9xxx)
  STATE_CONFLICT: "ERR_9001",
  CONCURRENT_MODIFICATION: "ERR_9002",
  RESOURCE_LOCKED: "ERR_9003",

  // System errors (10xxx)
  INTERNAL_ERROR: "ERR_10001",
  CONFIGURATION_ERROR: "ERR_10002",
  UNEXPECTED_ERROR: "ERR_10003",
} as const;

// ============================================
// ERROR CLASSIFICATION
// ============================================

/**
 * Classify an error based on its properties
 */
export function classifyError(error: unknown): {
  category: ErrorCategory;
  code: string;
  severity: ErrorSeverity;
} {
  if (!(error instanceof Error)) {
    return {
      category: "unknown",
      code: ERROR_CODES.UNEXPECTED_ERROR,
      severity: "medium",
    };
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // LLM provider errors
  if (
    message.includes("openai") ||
    message.includes("anthropic") ||
    message.includes("rate limit") ||
    message.includes("api key")
  ) {
    if (message.includes("rate limit") || message.includes("429")) {
      return { category: "llm", code: ERROR_CODES.LLM_RATE_LIMITED, severity: "medium" };
    }
    if (message.includes("timeout")) {
      return { category: "llm", code: ERROR_CODES.LLM_TIMEOUT, severity: "medium" };
    }
    if (message.includes("content") && message.includes("filter")) {
      return { category: "llm", code: ERROR_CODES.LLM_CONTENT_FILTER, severity: "low" };
    }
    if (message.includes("context") || message.includes("token")) {
      return { category: "llm", code: ERROR_CODES.LLM_CONTEXT_LENGTH, severity: "medium" };
    }
    return { category: "llm", code: ERROR_CODES.LLM_PROVIDER_ERROR, severity: "high" };
  }

  // Validation errors
  if (
    name === "validationerror" ||
    name === "zoderror" ||
    message.includes("validation") ||
    message.includes("invalid")
  ) {
    return { category: "validation", code: ERROR_CODES.INVALID_INPUT, severity: "low" };
  }

  // Permission errors
  if (
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return { category: "permission", code: ERROR_CODES.FORBIDDEN, severity: "medium" };
  }

  // Not found errors
  if (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("404")
  ) {
    return { category: "not_found", code: ERROR_CODES.RESOURCE_NOT_FOUND, severity: "low" };
  }

  // Rate limit errors
  if (
    message.includes("quota") ||
    message.includes("limit exceeded") ||
    message.includes("too many requests")
  ) {
    return { category: "rate_limit", code: ERROR_CODES.RATE_LIMITED, severity: "medium" };
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return { category: "timeout", code: ERROR_CODES.OPERATION_TIMEOUT, severity: "medium" };
  }

  // Database errors
  if (
    message.includes("database") ||
    message.includes("postgres") ||
    message.includes("sql") ||
    message.includes("connection")
  ) {
    return { category: "dependency", code: ERROR_CODES.DATABASE_ERROR, severity: "high" };
  }

  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econnrefused")
  ) {
    return { category: "dependency", code: ERROR_CODES.NETWORK_ERROR, severity: "high" };
  }

  // Tool execution errors
  if (message.includes("tool")) {
    return { category: "tool", code: ERROR_CODES.TOOL_EXECUTION_FAILED, severity: "medium" };
  }

  // Default to system error
  return { category: "system", code: ERROR_CODES.INTERNAL_ERROR, severity: "high" };
}

// ============================================
// RECOVERY SUGGESTIONS
// ============================================

/**
 * Get recovery suggestions based on error classification
 */
export function getRecoverySuggestions(
  category: ErrorCategory,
  code: string,
  context?: StructuredError["context"]
): RecoverySuggestion[] {
  const suggestions: RecoverySuggestion[] = [];

  switch (category) {
    case "validation":
      suggestions.push({
        action: "review_input",
        description: "Review and correct the input data",
        automatic: false,
        priority: 1,
      });
      if (context?.toolName) {
        suggestions.push({
          action: "show_tool_schema",
          description: `Check the required format for ${context.toolName}`,
          automatic: true,
          priority: 2,
        });
      }
      break;

    case "not_found":
      suggestions.push({
        action: "search_alternatives",
        description: "Search for similar resources",
        automatic: true,
        priority: 1,
      });
      if (context?.resourceType === "customer") {
        suggestions.push({
          action: "create_customer",
          description: "Create a new customer with this information",
          automatic: false,
          priority: 2,
        });
      }
      if (context?.resourceType === "vendor") {
        suggestions.push({
          action: "create_vendor",
          description: "Create a new vendor with this information",
          automatic: false,
          priority: 2,
        });
      }
      break;

    case "rate_limit":
      suggestions.push({
        action: "wait_and_retry",
        description: "Wait a moment and try again",
        automatic: true,
        priority: 1,
      });
      if (code === ERROR_CODES.DAILY_LIMIT_EXCEEDED) {
        suggestions.push({
          action: "increase_quota",
          description: "Contact support to increase daily limits",
          automatic: false,
          priority: 2,
        });
      }
      break;

    case "llm":
      if (code === ERROR_CODES.LLM_RATE_LIMITED) {
        suggestions.push({
          action: "wait_and_retry",
          description: "Wait for rate limit to reset (usually 60 seconds)",
          automatic: true,
          priority: 1,
        });
      } else if (code === ERROR_CODES.LLM_CONTEXT_LENGTH) {
        suggestions.push({
          action: "reduce_context",
          description: "Try with a shorter conversation or fewer details",
          automatic: true,
          priority: 1,
        });
      } else if (code === ERROR_CODES.LLM_CONTENT_FILTER) {
        suggestions.push({
          action: "rephrase_request",
          description: "Rephrase your request in different words",
          automatic: false,
          priority: 1,
        });
      }
      break;

    case "tool":
      suggestions.push({
        action: "retry_tool",
        description: "Retry the operation",
        automatic: true,
        priority: 1,
      });
      if (code === ERROR_CODES.TOOL_PERMISSION_DENIED) {
        suggestions.push({
          action: "check_permissions",
          description: "Verify you have permission for this action",
          automatic: false,
          priority: 2,
        });
      }
      break;

    case "timeout":
      suggestions.push({
        action: "retry_with_timeout",
        description: "Retry with a longer timeout",
        automatic: true,
        priority: 1,
      });
      suggestions.push({
        action: "simplify_request",
        description: "Try a simpler or smaller request",
        automatic: false,
        priority: 2,
      });
      break;

    case "dependency":
      suggestions.push({
        action: "check_status",
        description: "Check service status and retry shortly",
        automatic: true,
        priority: 1,
      });
      break;

    case "permission":
      suggestions.push({
        action: "request_approval",
        description: "Submit action for approval",
        automatic: false,
        priority: 1,
      });
      if (code === ERROR_CODES.EMERGENCY_STOP_ACTIVE) {
        suggestions.push({
          action: "disable_emergency_stop",
          description: "Disable emergency stop in settings",
          automatic: false,
          priority: 2,
        });
      }
      break;

    case "conflict":
      suggestions.push({
        action: "refresh_and_retry",
        description: "Refresh the data and try again",
        automatic: true,
        priority: 1,
      });
      break;

    default:
      suggestions.push({
        action: "contact_support",
        description: "If the issue persists, contact support",
        automatic: false,
        priority: 3,
      });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

// ============================================
// ERROR FACTORY
// ============================================

/**
 * Create a structured error from an unknown error
 */
export function createStructuredError(
  error: unknown,
  context?: StructuredError["context"]
): StructuredError {
  const classification = classifyError(error);
  const suggestions = getRecoverySuggestions(
    classification.category,
    classification.code,
    context
  );

  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = originalError.message;

  // Determine human-readable title based on category
  const titles: Record<ErrorCategory, string> = {
    validation: "Invalid Input",
    permission: "Access Denied",
    not_found: "Not Found",
    rate_limit: "Limit Exceeded",
    dependency: "Service Unavailable",
    llm: "AI Processing Error",
    tool: "Operation Failed",
    timeout: "Request Timed Out",
    conflict: "Conflict Detected",
    system: "System Error",
    unknown: "Unexpected Error",
  };

  // Determine if retryable
  const retryableCategories: ErrorCategory[] = [
    "rate_limit",
    "timeout",
    "dependency",
    "llm",
  ];
  const retryable = retryableCategories.includes(classification.category);

  // Calculate retry delay based on error type
  let retryDelayMs: number | undefined;
  let maxRetries: number | undefined;

  if (retryable) {
    switch (classification.category) {
      case "rate_limit":
        retryDelayMs = 60000; // 60 seconds
        maxRetries = 3;
        break;
      case "timeout":
        retryDelayMs = 5000; // 5 seconds
        maxRetries = 2;
        break;
      case "dependency":
        retryDelayMs = 10000; // 10 seconds
        maxRetries = 3;
        break;
      case "llm":
        retryDelayMs = 30000; // 30 seconds
        maxRetries = 2;
        break;
    }
  }

  return {
    code: classification.code,
    category: classification.category,
    severity: classification.severity,
    title: titles[classification.category],
    message: sanitizeErrorMessage(message),
    recoverable: suggestions.length > 0,
    suggestions,
    retryable,
    retryDelayMs,
    maxRetries,
    context,
    originalError,
    stack: originalError.stack,
  };
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Remove API keys
  let sanitized = message.replace(/sk-[a-zA-Z0-9]{32,}/g, "[API_KEY_REDACTED]");

  // Remove URLs with auth tokens
  sanitized = sanitized.replace(
    /https?:\/\/[^\s]*token=[^\s&]*/gi,
    "[URL_REDACTED]"
  );

  // Remove database connection strings
  sanitized = sanitized.replace(
    /postgres(ql)?:\/\/[^\s]*/gi,
    "[DATABASE_URL_REDACTED]"
  );

  return sanitized;
}

// ============================================
// RETRY LOGIC
// ============================================

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: StructuredError) => void;
}

/**
 * Execute a function with automatic retry for recoverable errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  context?: StructuredError["context"]
): Promise<T> {
  const { maxRetries, delayMs, backoffMultiplier = 2, onRetry } = options;

  let lastError: StructuredError | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = createStructuredError(error, context);

      if (!lastError.retryable || attempt > maxRetries) {
        throw lastError;
      }

      const waitTime = delayMs * Math.pow(backoffMultiplier, attempt - 1);

      logger.warn(
        {
          attempt,
          maxRetries,
          waitTime,
          errorCode: lastError.code,
          errorCategory: lastError.category,
        },
        "Retrying after error"
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? createStructuredError(new Error("Unknown retry failure"), context);
}

// ============================================
// ERROR FORMATTING FOR UI
// ============================================

/**
 * Format a structured error for display in the chat interface
 */
export function formatErrorForChat(error: StructuredError): string {
  const parts: string[] = [];

  // Header with icon based on severity
  const icons: Record<ErrorSeverity, string> = {
    low: "⚠️",
    medium: "❌",
    high: "🚨",
    critical: "💥",
  };

  parts.push(`${icons[error.severity]} **${error.title}**`);
  parts.push("");
  parts.push(error.message);

  // Add suggestions if available
  if (error.suggestions.length > 0) {
    parts.push("");
    parts.push("**Suggestions:**");
    for (const suggestion of error.suggestions.slice(0, 3)) {
      const icon = suggestion.automatic ? "🔄" : "👤";
      parts.push(`${icon} ${suggestion.description}`);
    }
  }

  // Add retry info if applicable
  if (error.retryable && error.retryDelayMs) {
    parts.push("");
    const retrySeconds = Math.ceil(error.retryDelayMs / 1000);
    parts.push(`_Retrying automatically in ${retrySeconds} seconds..._`);
  }

  return parts.join("\n");
}

/**
 * Format a structured error for API response
 */
export function formatErrorForAPI(error: StructuredError): {
  error: {
    code: string;
    category: string;
    title: string;
    message: string;
    recoverable: boolean;
    suggestions: Array<{ action: string; description: string }>;
    retryable: boolean;
    retryAfterMs?: number;
  };
} {
  return {
    error: {
      code: error.code,
      category: error.category,
      title: error.title,
      message: error.message,
      recoverable: error.recoverable,
      suggestions: error.suggestions.map((s) => ({
        action: s.action,
        description: s.description,
      })),
      retryable: error.retryable,
      retryAfterMs: error.retryDelayMs,
    },
  };
}

// ============================================
// EXPORTS
// ============================================

export const agentErrorService = {
  classifyError,
  createStructuredError,
  getRecoverySuggestions,
  withRetry,
  formatErrorForChat,
  formatErrorForAPI,
  ERROR_CODES,
};
