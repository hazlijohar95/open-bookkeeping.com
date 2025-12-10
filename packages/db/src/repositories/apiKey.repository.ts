import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../index";
import {
  apiKeys,
  apiKeyUsage,
  type ApiKey,
  type ApiKeyPermission,
  type NewApiKeyUsageRecord,
} from "../schema";
import crypto from "crypto";

// Generate a secure API key: ob_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (40 chars total)
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(24);
  const randomPart = randomBytes.toString("base64url").slice(0, 28);
  const key = `ob_live_${randomPart}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12); // "ob_live_xxxx"
  return { key, hash, prefix };
}

// Hash an API key for lookup
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  permissions?: ApiKeyPermission[];
  rateLimit?: number;
  expiresAt?: Date | null;
}

export interface UpdateApiKeyInput {
  name?: string;
  permissions?: ApiKeyPermission[];
  rateLimit?: number;
  expiresAt?: Date | null;
}

export interface ApiKeyQueryOptions {
  limit?: number;
  offset?: number;
  includeRevoked?: boolean;
}

export interface UsageQueryOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export const apiKeyRepository = {
  /**
   * Find API key by ID (returns masked version)
   */
  findById: async (id: string, userId: string): Promise<ApiKey | undefined> => {
    return db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)),
    });
  },

  /**
   * Find API key by hash (for authentication)
   */
  findByHash: async (keyHash: string): Promise<ApiKey | undefined> => {
    return db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)),
    });
  },

  /**
   * List all API keys for a user (masked)
   */
  findMany: async (
    userId: string,
    options?: ApiKeyQueryOptions
  ): Promise<ApiKey[]> => {
    const { limit = 50, offset = 0, includeRevoked = false } = options ?? {};

    const conditions = [eq(apiKeys.userId, userId)];
    if (!includeRevoked) {
      conditions.push(eq(apiKeys.isActive, true));
    }

    return db.query.apiKeys.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(apiKeys.createdAt)],
    });
  },

  /**
   * Create a new API key - returns full key (only time it's visible)
   */
  create: async (
    input: CreateApiKeyInput
  ): Promise<{ apiKey: ApiKey; fullKey: string }> => {
    const { key, hash, prefix } = generateApiKey();

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        userId: input.userId,
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions: input.permissions ?? [],
        rateLimit: input.rateLimit ?? 1000,
        expiresAt: input.expiresAt,
      })
      .returning();

    return { apiKey: apiKey!, fullKey: key };
  },

  /**
   * Update API key settings
   */
  update: async (
    id: string,
    userId: string,
    input: UpdateApiKeyInput
  ): Promise<ApiKey | undefined> => {
    const existing = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)),
    });

    if (!existing) {
      return undefined;
    }

    const [updated] = await db
      .update(apiKeys)
      .set({
        name: input.name ?? existing.name,
        permissions:
          input.permissions !== undefined
            ? input.permissions
            : existing.permissions,
        rateLimit:
          input.rateLimit !== undefined ? input.rateLimit : existing.rateLimit,
        expiresAt:
          input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt,
      })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();

    return updated;
  },

  /**
   * Revoke an API key (soft delete)
   */
  revoke: async (
    id: string,
    userId: string,
    reason?: string
  ): Promise<boolean> => {
    const existing = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId),
        eq(apiKeys.isActive, true)
      ),
    });

    if (!existing) {
      return false;
    }

    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(apiKeys.id, id));

    return true;
  },

  /**
   * Regenerate an API key - revokes old key and creates new one
   */
  regenerate: async (
    id: string,
    userId: string
  ): Promise<{ apiKey: ApiKey; fullKey: string } | null> => {
    const existing = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)),
    });

    if (!existing) {
      return null;
    }

    // Revoke old key
    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: "Regenerated",
      })
      .where(eq(apiKeys.id, id));

    // Create new key with same settings
    return apiKeyRepository.create({
      userId,
      name: existing.name,
      permissions: existing.permissions ?? [],
      rateLimit: existing.rateLimit ?? 1000,
      expiresAt: existing.expiresAt,
    });
  },

  /**
   * Update last used timestamp
   */
  updateLastUsed: async (id: string): Promise<void> => {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  },

  /**
   * Log API key usage
   */
  logUsage: async (input: NewApiKeyUsageRecord): Promise<void> => {
    await db.insert(apiKeyUsage).values(input);
  },

  /**
   * Get usage statistics for an API key
   */
  getUsageStats: async (
    apiKeyId: string,
    userId: string,
    options?: UsageQueryOptions
  ) => {
    // Verify ownership
    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, userId)),
    });

    if (!apiKey) {
      return null;
    }

    const { startDate, endDate, limit = 100, offset = 0 } = options ?? {};

    const conditions = [eq(apiKeyUsage.apiKeyId, apiKeyId)];
    if (startDate) {
      conditions.push(gte(apiKeyUsage.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(apiKeyUsage.createdAt, endDate));
    }

    const records = await db.query.apiKeyUsage.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(apiKeyUsage.createdAt)],
    });

    // Get aggregate stats
    const [stats] = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        avgResponseTime: sql<number>`avg(${apiKeyUsage.responseTimeMs})::int`,
        successCount: sql<number>`sum(case when ${apiKeyUsage.statusCode} < 400 then 1 else 0 end)::int`,
        errorCount: sql<number>`sum(case when ${apiKeyUsage.statusCode} >= 400 then 1 else 0 end)::int`,
      })
      .from(apiKeyUsage)
      .where(and(...conditions));

    return {
      records,
      stats: stats ?? {
        totalRequests: 0,
        avgResponseTime: 0,
        successCount: 0,
        errorCount: 0,
      },
    };
  },

  /**
   * Count active keys for a user
   */
  countActive: async (userId: string): Promise<number> => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

    return result?.count ?? 0;
  },

  /**
   * Check if API key has specific permission
   */
  hasPermission: (apiKey: ApiKey, permission: ApiKeyPermission): boolean => {
    const permissions = apiKey.permissions ?? [];

    // Check for exact permission
    if (permissions.includes(permission)) {
      return true;
    }

    // Check for wildcard (e.g., "invoices:*" matches "invoices:read")
    const [resource] = permission.split(":");
    const wildcardPermission = `${resource}:*` as ApiKeyPermission;
    if (permissions.includes(wildcardPermission)) {
      return true;
    }

    // Check for global wildcard
    if (permissions.includes("*:*" as ApiKeyPermission)) {
      return true;
    }

    return false;
  },
};

export type ApiKeyRepository = typeof apiKeyRepository;
