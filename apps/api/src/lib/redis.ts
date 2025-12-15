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
 * Uses proper LRU eviction by tracking access timestamps
 */
interface MemoryCacheEntry {
  value: unknown;
  expiresAt: number;
  lastAccessedAt: number; // Track last access for LRU eviction
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const MAX_CACHE_SIZE = 1000;
const LRU_EVICTION_COUNT = 100; // Number of entries to evict when cache is full

/**
 * Evict entries from memory cache using LRU policy
 * First removes expired entries, then least recently accessed
 */
function evictMemoryCacheEntries(): void {
  const now = Date.now();

  // Phase 1: Remove all expired entries
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }

  // Phase 2: If still over limit, evict least recently accessed entries
  if (memoryCache.size > MAX_CACHE_SIZE) {
    // Sort by lastAccessedAt and remove oldest
    const entries = Array.from(memoryCache.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    const toEvict = entries.slice(0, LRU_EVICTION_COUNT);
    for (const [key] of toEvict) {
      memoryCache.delete(key);
    }

    logger.debug(
      { evicted: toEvict.length, remaining: memoryCache.size },
      "LRU eviction completed"
    );
  }
}

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
  if (cached) {
    const now = Date.now();
    if (cached.expiresAt > now) {
      // Update last accessed time for LRU tracking
      cached.lastAccessedAt = now;
      return cached.value as T;
    }
    // Entry expired, remove it
    memoryCache.delete(key);
  }
  return null;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const now = Date.now();

  // Always set in memory cache for immediate availability
  memoryCache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
    lastAccessedAt: now,
  });

  // Clean up if too many entries using proper LRU eviction
  if (memoryCache.size > MAX_CACHE_SIZE) {
    evictMemoryCacheEntries();
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
  const nowMs = Date.now();
  const cached = memoryCache.get(cacheKey) as
    | MemoryCacheEntry & { value: { count: number; windowStart: number } }
    | undefined;

  if (!cached || (cached.value as { count: number; windowStart: number }).windowStart < windowStart) {
    memoryCache.set(cacheKey, {
      value: { count: 1, windowStart: now },
      expiresAt: nowMs + windowSeconds * 1000,
      lastAccessedAt: nowMs,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSeconds };
  }

  // Update last accessed time
  cached.lastAccessedAt = nowMs;

  const rateData = cached.value as { count: number; windowStart: number };
  const newCount = rateData.count + 1;
  rateData.count = newCount;

  return {
    allowed: newCount <= limit,
    remaining: Math.max(0, limit - newCount),
    resetAt: rateData.windowStart + windowSeconds,
  };
}
