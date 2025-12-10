import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { apiKeyRepository } from "@open-bookkeeping/db";
import type { ApiKeyPermission } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { assertFound, badRequest, forbidden, internalError } from "../../lib/errors";

const logger = createLogger("api-key-service");

// Max API keys per user
const MAX_API_KEYS_PER_USER = 10;

// Available permissions for validation
const availablePermissions: ApiKeyPermission[] = [
  "invoices:read",
  "invoices:write",
  "customers:read",
  "customers:write",
  "vendors:read",
  "vendors:write",
  "quotations:read",
  "quotations:write",
  "bills:read",
  "bills:write",
  "credit-notes:read",
  "credit-notes:write",
  "debit-notes:read",
  "debit-notes:write",
  "accounts:read",
  "accounts:write",
  "journal-entries:read",
  "journal-entries:write",
  "reports:read",
  "webhooks:read",
  "webhooks:write",
  "vault:read",
  "vault:write",
  "einvoice:read",
  "einvoice:write",
];

// Permission schema
const permissionSchema = z.enum(availablePermissions as [string, ...string[]]);

// Create API key schema
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(permissionSchema).default([]),
  rateLimit: z.number().min(100).max(10000).optional(),
  expiresAt: z.date().nullable().optional(),
});

// Update API key schema
const updateApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(permissionSchema).optional(),
  rateLimit: z.number().min(100).max(10000).optional(),
  expiresAt: z.date().nullable().optional(),
});

// Usage query schema
const usageQuerySchema = z.object({
  apiKeyId: z.string().uuid(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

export const apiKeyRouter = router({
  /**
   * List all API keys for the current user (masked keys)
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        includeRevoked: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const includeRevoked = input?.includeRevoked ?? false;

      const apiKeys = await apiKeyRepository.findMany(ctx.user.id, {
        limit,
        offset,
        includeRevoked,
      });

      logger.debug(
        { userId: ctx.user.id, count: apiKeys.length },
        "Listed API keys"
      );

      // Return with masked key (only show prefix)
      return apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
      }));
    }),

  /**
   * Get a single API key by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const apiKey = await apiKeyRepository.findById(input.id, ctx.user.id);
      assertFound(apiKey, "api_key", input.id);

      return {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        revokedAt: apiKey.revokedAt,
        revokedReason: apiKey.revokedReason,
      };
    }),

  /**
   * Create a new API key
   * IMPORTANT: The full key is only returned once!
   */
  create: protectedProcedure
    .input(createApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Check limit
      const activeCount = await apiKeyRepository.countActive(ctx.user.id);
      if (activeCount >= MAX_API_KEYS_PER_USER) {
        throw forbidden(
          `Maximum of ${MAX_API_KEYS_PER_USER} active API keys allowed`
        );
      }

      try {
        const { apiKey, fullKey } = await apiKeyRepository.create({
          userId: ctx.user.id,
          name: input.name,
          permissions: input.permissions as ApiKeyPermission[],
          rateLimit: input.rateLimit,
          expiresAt: input.expiresAt,
        });

        logger.info(
          { userId: ctx.user.id, apiKeyId: apiKey.id, name: input.name },
          "API key created"
        );

        // Return full key ONCE - store this securely!
        return {
          id: apiKey.id,
          name: apiKey.name,
          key: fullKey, // Full key - only shown once!
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        };
      } catch (error) {
        throw internalError("Failed to create API key", error, {
          userId: ctx.user.id,
        });
      }
    }),

  /**
   * Update API key settings (name, permissions, rate limit, expiry)
   */
  update: protectedProcedure
    .input(updateApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const updated = await apiKeyRepository.update(id, ctx.user.id, {
        name: updateData.name,
        permissions: updateData.permissions as ApiKeyPermission[] | undefined,
        rateLimit: updateData.rateLimit,
        expiresAt: updateData.expiresAt,
      });

      assertFound(updated, "api_key", id);

      logger.info(
        { userId: ctx.user.id, apiKeyId: id },
        "API key updated"
      );

      return {
        id: updated.id,
        name: updated.name,
        keyPrefix: updated.keyPrefix,
        permissions: updated.permissions,
        rateLimit: updated.rateLimit,
        expiresAt: updated.expiresAt,
        isActive: updated.isActive,
      };
    }),

  /**
   * Revoke an API key (soft delete)
   */
  revoke: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const revoked = await apiKeyRepository.revoke(
        input.id,
        ctx.user.id,
        input.reason
      );

      if (!revoked) {
        throw badRequest("API key not found or already revoked");
      }

      logger.info(
        { userId: ctx.user.id, apiKeyId: input.id, reason: input.reason },
        "API key revoked"
      );

      return { success: true };
    }),

  /**
   * Regenerate an API key (revoke old, create new with same settings)
   */
  regenerate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await apiKeyRepository.regenerate(input.id, ctx.user.id);

      if (!result) {
        throw badRequest("API key not found");
      }

      logger.info(
        { userId: ctx.user.id, oldApiKeyId: input.id, newApiKeyId: result.apiKey.id },
        "API key regenerated"
      );

      // Return new full key - only shown once!
      return {
        id: result.apiKey.id,
        name: result.apiKey.name,
        key: result.fullKey, // Full key - only shown once!
        keyPrefix: result.apiKey.keyPrefix,
        permissions: result.apiKey.permissions,
        rateLimit: result.apiKey.rateLimit,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      };
    }),

  /**
   * Get usage statistics for an API key
   */
  getUsage: protectedProcedure
    .input(usageQuerySchema)
    .query(async ({ ctx, input }) => {
      const usage = await apiKeyRepository.getUsageStats(
        input.apiKeyId,
        ctx.user.id,
        {
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit,
          offset: input.offset,
        }
      );

      if (!usage) {
        throw badRequest("API key not found");
      }

      return usage;
    }),

  /**
   * Get available permissions
   */
  getAvailablePermissions: protectedProcedure.query(() => {
    // Group permissions by resource
    const grouped = availablePermissions.reduce(
      (acc, permission) => {
        const [resource] = permission.split(":");
        if (!acc[resource!]) {
          acc[resource!] = [];
        }
        acc[resource!]!.push(permission);
        return acc;
      },
      {} as Record<string, ApiKeyPermission[]>
    );

    return {
      permissions: availablePermissions,
      grouped,
    };
  }),
});
