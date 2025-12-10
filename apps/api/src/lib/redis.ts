/**
 * Redis Client Configuration
 * Uses Upstash Redis for serverless-compatible distributed caching
 */

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis client - will be null if not configured
let redis: Redis | null = null;

if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} else {
  console.warn(
    "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed caching."
  );
}

export { redis };

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
  if (redis) {
    try {
      return await redis.get<T>(key);
    } catch (error) {
      console.error("Redis get error:", error);
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
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch (error) {
      console.error("Redis set error:", error);
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Clean up if too many entries
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt < now) {
        memoryCache.delete(k);
      }
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error("Redis del error:", error);
    }
  }
  memoryCache.delete(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (redis) {
    try {
      // Upstash doesn't support SCAN, so we use KEYS for pattern deletion
      // This is acceptable for auth token invalidation (small number of keys)
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error("Redis del pattern error:", error);
    }
  }

  // Fallback: delete matching keys from memory cache
  const regex = new RegExp(pattern.replace("*", ".*"));
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Rate limiter using Redis
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  if (redis) {
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
      const currentCount = (results[1] as number) || 0;

      return {
        allowed: currentCount < limit,
        remaining: Math.max(0, limit - currentCount - 1),
        resetAt: now + windowSeconds,
      };
    } catch (error) {
      console.error("Rate limit check error:", error);
      // Allow request on Redis error
      return { allowed: true, remaining: limit, resetAt: now + windowSeconds };
    }
  }

  // Simple in-memory fallback (not distributed)
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
