/**
 * Rate Limiting Middleware
 * Uses Redis for distributed rate limiting with in-memory fallback
 */

import type { Context, Next } from "hono";
import crypto from "crypto";
import { checkRateLimit } from "../lib/redis";

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  keyGenerator?: (c: Context) => string;
}

/**
 * List of trusted proxy IPs/ranges that can set X-Forwarded-For
 * In production, this should be your load balancer/CDN IPs
 */
const TRUSTED_PROXIES = new Set([
  "127.0.0.1",
  "::1",
  // Add your load balancer IPs here
]);

/**
 * Validate IP address format with proper range checking
 */
function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;

  // IPv4 validation with octet range check (0-255)
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ip.match(ipv4Pattern);
  if (ipv4Match) {
    // Validate each octet is 0-255
    const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]];
    return octets.every((octet) => {
      const num = parseInt(octet!, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 validation (simplified but more robust)
  // Matches standard IPv6 and compressed forms (::)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){0,6}::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$/;
  return ipv6Pattern.test(ip);
}

/**
 * Get client IP with proper validation
 * Only trusts X-Forwarded-For from known proxies
 */
function getClientIP(c: Context): string {
  // Get the direct connection IP (from Hono's request info)
  const directIP = c.req.header("cf-connecting-ip") // Cloudflare
    || c.req.header("x-real-ip") // nginx
    || "unknown";

  // Only trust X-Forwarded-For if request comes from trusted proxy
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded && (TRUSTED_PROXIES.has(directIP) || directIP === "unknown")) {
    // Take the first (client) IP from the chain
    const clientIP = forwarded.split(",")[0]?.trim();
    if (clientIP && isValidIP(clientIP)) {
      return clientIP;
    }
  }

  // Fall back to direct IP or cf-connecting-ip
  if (directIP !== "unknown" && isValidIP(directIP)) {
    return directIP;
  }

  return "unknown";
}

const defaultKeyGenerator = (c: Context): string => {
  // Use user ID if authenticated, otherwise use IP
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      // Hash token properly to create a consistent, secure key
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
      return `user:${hashedToken}`;
    }
  }

  // Fall back to validated IP address
  const ip = getClientIP(c);
  return `ip:${ip}`;
};

/**
 * Create rate limiting middleware with custom configuration
 */
export function rateLimit(config: RateLimitConfig) {
  const { limit, windowSeconds, keyGenerator = defaultKeyGenerator } = config;

  return async (c: Context, next: Next) => {
    const identifier = keyGenerator(c);
    const path = c.req.path;
    const key = `${path}:${identifier}`;

    const result = await checkRateLimit(key, limit, windowSeconds);

    // Add rate limit headers
    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", result.remaining.toString());
    c.header("X-RateLimit-Reset", result.resetAt.toString());

    if (!result.allowed) {
      c.header("Retry-After", windowSeconds.toString());
      return c.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: windowSeconds,
        },
        429
      );
    }

    await next();
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// General API rate limit: 100 requests per minute
export const generalRateLimit = rateLimit({
  limit: 100,
  windowSeconds: 60,
});

// Auth endpoints: 10 requests per minute (prevent brute force)
export const authRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 60,
});

// AI endpoints: 20 requests per minute (expensive operations)
export const aiRateLimit = rateLimit({
  limit: 20,
  windowSeconds: 60,
});

// Heavy operations (PDF generation, exports): 10 requests per minute
export const heavyRateLimit = rateLimit({
  limit: 10,
  windowSeconds: 60,
});

// Strict rate limit for sensitive operations: 5 per minute
export const strictRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 60,
});

// ============================================
// PUBLIC API v1 RATE LIMITS
// ============================================

/**
 * API Key based rate limiter for public API v1
 * Uses API key hash for identification
 */
const apiKeyKeyGenerator = (c: Context): string => {
  // Check for API key in headers
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ob_")) {
    const key = authHeader.slice(7).trim();
    // Hash the API key for privacy in logs/cache keys
    const hashedKey = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
    return `apikey:${hashedKey}`;
  }

  const apiKeyHeader = c.req.header("x-api-key");
  if (apiKeyHeader?.startsWith("ob_")) {
    const hashedKey = crypto.createHash("sha256").update(apiKeyHeader).digest("hex").slice(0, 16);
    return `apikey:${hashedKey}`;
  }

  // Fall back to IP-based limiting for unauthenticated requests
  const ip = getClientIP(c);
  return `ip:${ip}`;
};

/**
 * API v1 read operations: 1000 requests per minute per API key
 * Generous limit for listing/fetching data
 */
export const apiV1ReadRateLimit = rateLimit({
  limit: 1000,
  windowSeconds: 60,
  keyGenerator: apiKeyKeyGenerator,
});

/**
 * API v1 write operations: 100 requests per minute per API key
 * Stricter limit for mutations (create/update/delete)
 */
export const apiV1WriteRateLimit = rateLimit({
  limit: 100,
  windowSeconds: 60,
  keyGenerator: apiKeyKeyGenerator,
});

/**
 * API v1 webhook operations: 50 requests per minute per API key
 * Very strict limit for webhook management
 */
export const apiV1WebhookRateLimit = rateLimit({
  limit: 50,
  windowSeconds: 60,
  keyGenerator: apiKeyKeyGenerator,
});

/**
 * Middleware that applies different rate limits based on HTTP method
 * GET/HEAD = read limits, POST/PUT/PATCH/DELETE = write limits
 */
export function methodBasedRateLimit(readLimit: number, writeLimit: number, windowSeconds = 60) {
  const readLimiter = rateLimit({
    limit: readLimit,
    windowSeconds,
    keyGenerator: apiKeyKeyGenerator,
  });

  const writeLimiter = rateLimit({
    limit: writeLimit,
    windowSeconds,
    keyGenerator: apiKeyKeyGenerator,
  });

  return async (c: Context, next: Next) => {
    const method = c.req.method;
    const isReadMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";

    if (isReadMethod) {
      return readLimiter(c, next);
    }
    return writeLimiter(c, next);
  };
}

/**
 * Combined API v1 rate limiter that varies by method type
 * GET: 1000/min, Mutations: 100/min
 */
export const apiV1RateLimit = methodBasedRateLimit(1000, 100, 60);
