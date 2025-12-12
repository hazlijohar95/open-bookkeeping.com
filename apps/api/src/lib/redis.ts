/**
 * Redis Client Configuration
 * Uses Upstash Redis for serverless-compatible distributed caching
 * Includes graceful degradation with in-memory fallback
 */

import { Redis } from "@upstash/redis";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("redis");

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis client - will be null if not configured
let redis: Redis | null = null;

if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  logger.info("Redis client initialized");
} else {
  logger.warn(
    "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed caching."
  );
}

export { redis };

// ============================================
// REDIS CIRCUIT BREAKER
// Prevents cascading failures when Redis is down
// ============================================

interface RedisCircuitState {
  failures: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  successCount: number;
}

const redisCircuit: RedisCircuitState = {
  failures: 0,
  lastFailureTime: 0,
  state: "CLOSED",
  successCount: 0,
};

// Circuit breaker config for Redis
const REDIS_CIRCUIT_CONFIG = {
  failureThreshold: 3, // Open after 3 failures
  resetTimeoutMs: 30_000, // Try again after 30 seconds
  successThreshold: 2, // 2 successes to close circuit
};

/**
 * Check if Redis circuit allows operation
 */
function isRedisCircuitAllowed(): boolean {
  const now = Date.now();

  switch (redisCircuit.state) {
    case "CLOSED":
      return true;

    case "OPEN": {
      // Check if reset timeout has passed
      const timeSinceFailure = now - redisCircuit.lastFailureTime;
      if (timeSinceFailure >= REDIS_CIRCUIT_CONFIG.resetTimeoutMs) {
        redisCircuit.state = "HALF_OPEN";
        redisCircuit.successCount = 0;
        logger.info("Redis circuit transitioning to HALF_OPEN");
        return true;
      }
      return false;
    }

    case "HALF_OPEN":
      return true;

    default:
      return true;
  }
}

/**
 * Record Redis operation success
 */
function recordRedisSuccess(): void {
  if (redisCircuit.state === "HALF_OPEN") {
    redisCircuit.successCount++;
    if (redisCircuit.successCount >= REDIS_CIRCUIT_CONFIG.successThreshold) {
      redisCircuit.state = "CLOSED";
      redisCircuit.failures = 0;
      logger.info("Redis circuit CLOSED after recovery");
    }
  } else if (redisCircuit.state === "CLOSED") {
    // Reset failure count on success
    redisCircuit.failures = 0;
  }
}

/**
 * Record Redis operation failure
 */
function recordRedisFailure(error: unknown): void {
  redisCircuit.failures++;
  redisCircuit.lastFailureTime = Date.now();

  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  if (redisCircuit.state === "HALF_OPEN") {
    redisCircuit.state = "OPEN";
    logger.warn({ error: errorMessage }, "Redis circuit re-opened after failed recovery");
  } else if (redisCircuit.state === "CLOSED" && redisCircuit.failures >= REDIS_CIRCUIT_CONFIG.failureThreshold) {
    redisCircuit.state = "OPEN";
    logger.warn(
      { failures: redisCircuit.failures, error: errorMessage },
      "Redis circuit OPENED due to failures"
    );
  }
}

/**
 * Get Redis circuit state for monitoring
 */
export function getRedisCircuitState(): {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  isHealthy: boolean;
} {
  return {
    state: redisCircuit.state,
    failures: redisCircuit.failures,
    isHealthy: redisCircuit.state === "CLOSED",
  };
}

/**
 * Check if Redis is available and responding
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache helper with automatic fallback to in-memory when Redis is unavailable
 */
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  // Check circuit breaker before attempting Redis operation
  if (redis && isRedisCircuitAllowed()) {
    try {
      const result = await redis.get<T>(key);
      recordRedisSuccess();
      return result;
    } catch (error) {
      recordRedisFailure(error);
      logger.debug({ key, error }, "Redis get error, falling back to memory cache");
    }
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  if (cached) {
    memoryCache.delete(key);
  }
  return null;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  // Always set in memory cache for immediate availability
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Clean up if too many entries (LRU-like behavior)
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt < now) {
        memoryCache.delete(k);
      }
    }
    // If still too many, remove oldest 100
    if (memoryCache.size > 1000) {
      const keysToDelete = Array.from(memoryCache.keys()).slice(0, 100);
      for (const k of keysToDelete) {
        memoryCache.delete(k);
      }
    }
  }

  // Try to persist to Redis (non-blocking)
  if (redis && isRedisCircuitAllowed()) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      recordRedisSuccess();
    } catch (error) {
      recordRedisFailure(error);
      logger.debug({ key, error }, "Redis set error, using memory cache only");
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  // Always delete from memory cache
  memoryCache.delete(key);

  // Try to delete from Redis
  if (redis && isRedisCircuitAllowed()) {
    try {
      await redis.del(key);
      recordRedisSuccess();
    } catch (error) {
      recordRedisFailure(error);
      logger.debug({ key, error }, "Redis del error");
    }
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  // Fallback: delete matching keys from memory cache
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }

  // Try to delete from Redis
  if (redis && isRedisCircuitAllowed()) {
    try {
      // Upstash doesn't support SCAN, so we use KEYS for pattern deletion
      // This is acceptable for auth token invalidation (small number of keys)
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      recordRedisSuccess();
    } catch (error) {
      recordRedisFailure(error);
      logger.debug({ pattern, error }, "Redis del pattern error");
    }
  }
}

/**
 * Rate limiter using Redis with circuit breaker protection
 * Falls back to in-memory rate limiting when Redis is unavailable
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  // Try Redis if available and circuit allows
  if (redis && isRedisCircuitAllowed()) {
    try {
      // Use sorted set for sliding window rate limiting
      const pipeline = redis.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current entries
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` });

      // Set expiry
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = (results[1] as number) ?? 0;

      recordRedisSuccess();

      return {
        allowed: currentCount < limit,
        remaining: Math.max(0, limit - currentCount - 1),
        resetAt: now + windowSeconds,
      };
    } catch (error) {
      recordRedisFailure(error);
      logger.debug({ identifier, error }, "Rate limit Redis error, using memory fallback");
      // Fall through to in-memory rate limiting
    }
  }

  // In-memory fallback (per-instance, not distributed)
  // This is acceptable as a degraded mode - slightly more permissive than distributed
  const cacheKey = `ratelimit:memory:${identifier}`;
  const cached = memoryCache.get(cacheKey) as
    | { value: { count: number; windowStart: number }; expiresAt: number }
    | undefined;

  if (!cached || cached.value.windowStart < windowStart) {
    memoryCache.set(cacheKey, {
      value: { count: 1, windowStart: now },
      expiresAt: Date.now() + windowSeconds * 1000,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds };
  }

  const newCount = cached.value.count + 1;
  cached.value.count = newCount;

  return {
    allowed: newCount <= limit,
    remaining: Math.max(0, limit - newCount),
    resetAt: cached.value.windowStart + windowSeconds,
  };
}
