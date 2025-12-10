/**
 * API Key Authentication Middleware
 * Validates API keys for public API access
 * Includes caching layer for performance (5-minute TTL)
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiKeyRepository, hashApiKey } from "@open-bookkeeping/db";
import type { ApiKey, ApiKeyPermission } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { getCachedApiKey, setCachedApiKey } from "../lib/cache";

const logger = createLogger("api-key-auth");

// Extend Hono context to include API key info
declare module "hono" {
  interface ContextVariableMap {
    apiKey?: ApiKey;
    apiKeyUser?: { id: string };
  }
}

/**
 * Extract API key from request
 * Supports:
 * - Authorization: Bearer ob_live_xxxx
 * - X-API-Key: ob_live_xxxx
 */
function extractApiKey(c: Context): string | null {
  // Check Authorization header first
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7).trim();
    if (key.startsWith("ob_live_") || key.startsWith("ob_test_")) {
      return key;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader?.startsWith("ob_live_") || apiKeyHeader?.startsWith("ob_test_")) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Map HTTP method + path to required permission
 */
function getRequiredPermission(method: string, path: string): ApiKeyPermission | null {
  // Extract resource from path: /api/v1/invoices -> invoices
  const pathParts = path.split("/").filter(Boolean);
  const apiIndex = pathParts.indexOf("v1");

  if (apiIndex === -1 || apiIndex >= pathParts.length - 1) {
    return null;
  }

  const resource = pathParts[apiIndex + 1];

  // Map HTTP method to permission type
  const isReadMethod = method === "GET" || method === "HEAD";
  const permissionType = isReadMethod ? "read" : "write";

  // Map resource to permission
  const resourceMap: Record<string, string> = {
    invoices: "invoices",
    customers: "customers",
    vendors: "vendors",
    quotations: "quotations",
    bills: "bills",
    "credit-notes": "credit-notes",
    "debit-notes": "debit-notes",
    accounts: "accounts",
    "journal-entries": "journal-entries",
    reports: "reports",
    webhooks: "webhooks",
    vault: "vault",
    einvoice: "einvoice",
  };

  const mappedResource = resourceMap[resource ?? ""];
  if (!mappedResource) {
    return null;
  }

  return `${mappedResource}:${permissionType}` as ApiKeyPermission;
}

/**
 * API Key Authentication Middleware
 * Use this for routes that should accept API key authentication
 * Includes caching layer for improved performance
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const startTime = Date.now();
  const apiKey = extractApiKey(c);

  if (!apiKey) {
    throw new HTTPException(401, {
      message: "API key required. Provide via Authorization: Bearer ob_live_xxx or X-API-Key header.",
    });
  }

  // Hash the key for lookup
  const keyHash = hashApiKey(apiKey);

  // Try cache first (5-minute TTL)
  let apiKeyRecord = await getCachedApiKey(keyHash);

  if (!apiKeyRecord) {
    // Cache miss - look up from database
    const dbRecord = await apiKeyRepository.findByHash(keyHash);
    apiKeyRecord = dbRecord ?? null;

    if (apiKeyRecord) {
      // Cache the result for future requests
      await setCachedApiKey(keyHash, apiKeyRecord).catch((err) => {
        logger.warn({ err }, "Failed to cache API key");
      });
    }
  }

  if (!apiKeyRecord) {
    logger.warn({ keyPrefix: apiKey.slice(0, 12) }, "Invalid API key attempted");
    throw new HTTPException(401, {
      message: "Invalid API key",
    });
  }

  // Check if key is active
  if (!apiKeyRecord.isActive) {
    logger.warn({ apiKeyId: apiKeyRecord.id }, "Revoked API key attempted");
    throw new HTTPException(401, {
      message: "API key has been revoked",
    });
  }

  // Check if key has expired
  if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
    logger.warn({ apiKeyId: apiKeyRecord.id }, "Expired API key attempted");
    throw new HTTPException(401, {
      message: "API key has expired",
    });
  }

  // Check permissions
  const requiredPermission = getRequiredPermission(c.req.method, c.req.path);
  if (requiredPermission && !apiKeyRepository.hasPermission(apiKeyRecord, requiredPermission)) {
    logger.warn(
      { apiKeyId: apiKeyRecord.id, required: requiredPermission },
      "Insufficient permissions"
    );
    throw new HTTPException(403, {
      message: `Insufficient permissions. Required: ${requiredPermission}`,
    });
  }

  // Store API key info in context
  c.set("apiKey", apiKeyRecord);
  c.set("apiKeyUser", { id: apiKeyRecord.userId });

  // Continue with request
  await next();

  // Log usage after response
  const responseTime = Date.now() - startTime;

  // Update last used timestamp (fire and forget)
  apiKeyRepository.updateLastUsed(apiKeyRecord.id).catch((err) => {
    logger.error({ err, apiKeyId: apiKeyRecord.id }, "Failed to update last used");
  });

  // Log usage (fire and forget)
  apiKeyRepository
    .logUsage({
      apiKeyId: apiKeyRecord.id,
      endpoint: c.req.path,
      method: c.req.method,
      statusCode: c.res.status,
      responseTimeMs: responseTime,
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
                 c.req.header("x-real-ip") ??
                 "unknown",
      userAgent: c.req.header("user-agent"),
    })
    .catch((err) => {
      logger.error({ err, apiKeyId: apiKeyRecord.id }, "Failed to log API key usage");
    });
}

/**
 * Optional API Key Authentication Middleware
 * Attempts API key auth but doesn't fail if no key provided
 * Useful for endpoints that support both authenticated and public access
 */
export async function optionalApiKeyAuth(c: Context, next: Next) {
  const apiKey = extractApiKey(c);

  if (!apiKey) {
    // No API key provided, continue without authentication
    await next();
    return;
  }

  // If API key provided, validate it
  await apiKeyAuth(c, next);
}

/**
 * Require specific permission middleware factory
 * Use after apiKeyAuth middleware to require specific permissions
 */
export function requirePermission(...permissions: ApiKeyPermission[]) {
  return async (c: Context, next: Next) => {
    const apiKeyRecord = c.get("apiKey");

    if (!apiKeyRecord) {
      throw new HTTPException(401, {
        message: "Authentication required",
      });
    }

    // Check if any of the required permissions are present
    const hasPermission = permissions.some((permission) =>
      apiKeyRepository.hasPermission(apiKeyRecord, permission)
    );

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Required one of: ${permissions.join(", ")}`,
      });
    }

    await next();
  };
}

/**
 * Get user ID from API key context
 * Utility function for use in route handlers
 */
export function getApiKeyUserId(c: Context): string | null {
  const apiKeyUser = c.get("apiKeyUser");
  return apiKeyUser?.id ?? null;
}
