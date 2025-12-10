/**
 * API Keys REST Routes
 * Provides REST API endpoints for managing API keys
 */

import { Hono } from "hono";
import { z } from "zod";
import { apiKeyRepository } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const apiKeyRoutes = new Hono();

// Input validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// GET /api-keys - List all API keys
apiKeyRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;
    const includeRevoked = c.req.query("include_revoked") === "true";

    const apiKeys = await apiKeyRepository.findMany(user.id, {
      limit,
      offset,
      includeRevoked,
    });

    // Mask the keys for security
    const maskedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      rateLimit: key.rateLimit,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    }));

    return c.json(maskedKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch API keys");
  }
});

// GET /api-keys/:id - Get single API key
apiKeyRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const apiKey = await apiKeyRepository.findById(id, user.id);

    if (!apiKey) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "API key not found");
    }

    // Return masked version
    return c.json({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch API key");
  }
});

// GET /api-keys/:id/usage - Get API key usage statistics
apiKeyRoutes.get("/:id/usage", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const startDate = c.req.query("start_date")
      ? new Date(c.req.query("start_date")!)
      : undefined;
    const endDate = c.req.query("end_date")
      ? new Date(c.req.query("end_date")!)
      : undefined;
    const limit = Number(c.req.query("limit")) || 100;

    const stats = await apiKeyRepository.getUsageStats(id, user.id, {
      startDate,
      endDate,
      limit,
    });

    if (!stats) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "API key not found");
    }

    return c.json(stats);
  } catch (error) {
    console.error("Error fetching API key usage:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch usage statistics");
  }
});

// POST /api-keys - Create new API key
apiKeyRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = createApiKeySchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { name, permissions, rateLimit, expiresAt } = validation.data;

    // Check existing key count (limit to 10 per user)
    const existingCount = await apiKeyRepository.countActive(user.id);
    if (existingCount >= 10) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Maximum number of API keys (10) reached");
    }

    const { apiKey, fullKey } = await apiKeyRepository.create({
      userId: user.id,
      name,
      permissions: permissions as any,
      rateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Return the full key only on creation
    return c.json(
      {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey, // Only time the full key is visible
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating API key:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create API key");
  }
});

// PATCH /api-keys/:id - Update API key
apiKeyRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = updateApiKeySchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { name, permissions, rateLimit, expiresAt } = validation.data;

    const updated = await apiKeyRepository.update(id, user.id, {
      name,
      permissions: permissions as any,
      rateLimit,
      expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
    });

    if (!updated) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "API key not found");
    }

    return c.json({
      id: updated.id,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      permissions: updated.permissions,
      rateLimit: updated.rateLimit,
      isActive: updated.isActive,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update API key");
  }
});

// POST /api-keys/:id/regenerate - Regenerate API key
apiKeyRoutes.post("/:id/regenerate", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");

    const result = await apiKeyRepository.regenerate(id, user.id);

    if (!result) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "API key not found");
    }

    // Return the new full key
    return c.json({
      id: result.apiKey.id,
      name: result.apiKey.name,
      key: result.fullKey, // New full key
      keyPrefix: result.apiKey.keyPrefix,
      permissions: result.apiKey.permissions,
      rateLimit: result.apiKey.rateLimit,
      expiresAt: result.apiKey.expiresAt,
      createdAt: result.apiKey.createdAt,
    });
  } catch (error) {
    console.error("Error regenerating API key:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to regenerate API key");
  }
});

// DELETE /api-keys/:id - Revoke API key
apiKeyRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const reason = c.req.query("reason") || "User revoked";

    const revoked = await apiKeyRepository.revoke(id, user.id, reason);

    if (!revoked) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "API key not found or already revoked");
    }

    return c.json({ success: true, message: "API key revoked" });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to revoke API key");
  }
});
