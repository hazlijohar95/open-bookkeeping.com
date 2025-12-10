import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiKeyAuth, optionalApiKeyAuth, requirePermission, getApiKeyUserId } from "./api-key-auth";

// Mock dependencies
vi.mock("@open-bookkeeping/db", () => ({
  apiKeyRepository: {
    findByHash: vi.fn(),
    hasPermission: vi.fn(),
    updateLastUsed: vi.fn().mockResolvedValue(undefined),
    logUsage: vi.fn().mockResolvedValue(undefined),
  },
  hashApiKey: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock("../lib/cache", () => ({
  getCachedApiKey: vi.fn(),
  setCachedApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@open-bookkeeping/shared", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { apiKeyRepository, hashApiKey } from "@open-bookkeeping/db";
import { getCachedApiKey, setCachedApiKey } from "../lib/cache";

const mockFindByHash = vi.mocked(apiKeyRepository.findByHash);
const mockHasPermission = vi.mocked(apiKeyRepository.hasPermission);
const mockGetCachedApiKey = vi.mocked(getCachedApiKey);
const mockSetCachedApiKey = vi.mocked(setCachedApiKey);

// Helper to create app with error handler for HTTPException
function createTestApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }
    return c.json({ message: "Internal error" }, 500);
  });
  return app;
}

describe("API Key Authentication Middleware", () => {
  let app: Hono;

  const validApiKey = {
    id: "key-123",
    userId: "user-456",
    keyHash: "hashed_ob_live_test123",
    name: "Test Key",
    isActive: true,
    permissions: ["invoices:read", "invoices:write", "customers:read"],
    expiresAt: null,
    createdAt: new Date(),
    lastUsedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    mockHasPermission.mockReturnValue(true);
  });

  describe("apiKeyAuth()", () => {
    it("should reject requests without API key", async () => {
      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("API key required");
    });

    it("should accept valid API key from Authorization header", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(200);
    });

    it("should accept valid API key from X-API-Key header", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { "X-API-Key": "ob_live_test123" },
      });

      expect(res.status).toBe(200);
    });

    it("should accept ob_test_ prefix keys", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue({ ...validApiKey, keyHash: "hashed_ob_test_abc" } as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_test_abc" },
      });

      expect(res.status).toBe(200);
    });

    it("should reject non-ob_ prefixed Bearer tokens", async () => {
      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer jwt-token-here" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("API key required");
    });

    it("should use cached API key when available", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(200);
      expect(mockFindByHash).not.toHaveBeenCalled();
    });

    it("should cache API key after database lookup", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(mockSetCachedApiKey).toHaveBeenCalledWith(
        expect.any(String),
        validApiKey
      );
    });

    it("should reject invalid API key", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(undefined);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_invalid" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("Invalid API key");
    });

    it("should reject revoked API key", async () => {
      const revokedKey = { ...validApiKey, isActive: false };
      mockGetCachedApiKey.mockResolvedValue(revokedKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("API key has been revoked");
    });

    it("should reject expired API key", async () => {
      const expiredKey = {
        ...validApiKey,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      };
      mockGetCachedApiKey.mockResolvedValue(expiredKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("API key has expired");
    });

    it("should accept API key with future expiration", async () => {
      const futureExpiry = {
        ...validApiKey,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      };
      mockGetCachedApiKey.mockResolvedValue(futureExpiry as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(200);
    });

    it("should check permissions for resource access", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission.mockReturnValue(false);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Insufficient permissions");
    });

    it("should map GET requests to read permission", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission.mockReturnValue(true);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(mockHasPermission).toHaveBeenCalledWith(validApiKey, "invoices:read");
    });

    it("should map POST requests to write permission", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission.mockReturnValue(true);

      app.use("*", apiKeyAuth);
      app.post("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", {
        method: "POST",
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(mockHasPermission).toHaveBeenCalledWith(validApiKey, "invoices:write");
    });

    it("should map various resources correctly", async () => {
      const resources = [
        { path: "/api/v1/customers", expected: "customers:read" },
        { path: "/api/v1/vendors", expected: "vendors:read" },
        { path: "/api/v1/quotations", expected: "quotations:read" },
        { path: "/api/v1/bills", expected: "bills:read" },
        { path: "/api/v1/accounts", expected: "accounts:read" },
        { path: "/api/v1/webhooks", expected: "webhooks:read" },
      ];

      for (const { path, expected } of resources) {
        vi.clearAllMocks();
        mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
        mockHasPermission.mockReturnValue(true);

        const testApp = new Hono();
        testApp.use("*", apiKeyAuth);
        testApp.get(path, (c) => c.json({ success: true }));

        await testApp.request(path, {
          headers: { Authorization: "Bearer ob_live_test123" },
        });

        expect(mockHasPermission).toHaveBeenCalledWith(validApiKey, expected);
      }
    });

    it("should store API key info in context", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => {
        const apiKey = c.get("apiKey");
        const apiKeyUser = c.get("apiKeyUser");
        return c.json({
          keyId: apiKey?.id,
          userId: apiKeyUser?.id,
        });
      });

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      const body = await res.json();
      expect(body.keyId).toBe("key-123");
      expect(body.userId).toBe("user-456");
    });
  });

  describe("optionalApiKeyAuth()", () => {
    beforeEach(() => {
      app = createTestApp();
      mockHasPermission.mockReturnValue(true);
    });

    it("should allow requests without API key", async () => {
      app.use("*", optionalApiKeyAuth);
      app.get("/api/v1/public", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/public");

      expect(res.status).toBe(200);
    });

    it("should validate API key when provided", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(undefined);

      app.use("*", optionalApiKeyAuth);
      app.get("/api/v1/public", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/public", {
        headers: { Authorization: "Bearer ob_live_invalid" },
      });

      expect(res.status).toBe(401);
    });

    it("should set context when valid API key provided", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", optionalApiKeyAuth);
      app.get("/api/v1/public", (c) => {
        const apiKey = c.get("apiKey");
        return c.json({ hasKey: !!apiKey });
      });

      const res = await app.request("/api/v1/public", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      const body = await res.json();
      expect(body.hasKey).toBe(true);
    });

    it("should not set context when no API key provided", async () => {
      app.use("*", optionalApiKeyAuth);
      app.get("/api/v1/public", (c) => {
        const apiKey = c.get("apiKey");
        return c.json({ hasKey: !!apiKey });
      });

      const res = await app.request("/api/v1/public");

      const body = await res.json();
      expect(body.hasKey).toBe(false);
    });
  });

  describe("requirePermission()", () => {
    beforeEach(() => {
      app = createTestApp();
      mockHasPermission.mockReturnValue(true);
    });

    it("should reject when no API key in context", async () => {
      app.use("*", requirePermission("invoices:read" as any));
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(401);
    });

    it("should allow when has required permission", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission.mockReturnValue(true);

      app.use("*", apiKeyAuth);
      app.use("*", requirePermission("invoices:read" as any));
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(200);
    });

    it("should reject when missing required permission", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission
        .mockReturnValueOnce(true) // For apiKeyAuth permission check
        .mockReturnValueOnce(false); // For requirePermission check

      app.use("*", apiKeyAuth);
      app.use("*", requirePermission("admin:write" as any));
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Insufficient permissions");
    });

    it("should accept any of multiple permissions", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission
        .mockReturnValueOnce(true) // For apiKeyAuth
        .mockReturnValueOnce(false) // First permission check
        .mockReturnValueOnce(true); // Second permission check

      app.use("*", apiKeyAuth);
      app.use("*", requirePermission("admin:read" as any, "invoices:read" as any));
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("getApiKeyUserId()", () => {
    beforeEach(() => {
      app = createTestApp();
      mockHasPermission.mockReturnValue(true);
    });

    it("should return user ID from context", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/test", (c) => {
        const userId = getApiKeyUserId(c);
        return c.json({ userId });
      });

      const res = await app.request("/api/v1/test", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      const body = await res.json();
      expect(body.userId).toBe("user-456");
    });

    it("should return null when no API key in context", async () => {
      app.get("/test", (c) => {
        const userId = getApiKeyUserId(c);
        return c.json({ userId });
      });

      const res = await app.request("/test");

      const body = await res.json();
      expect(body.userId).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      app = createTestApp();
      mockHasPermission.mockReturnValue(true);
    });

    it("should handle malformed Authorization header", async () => {
      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer" }, // Missing token
      });

      expect(res.status).toBe(401);
    });

    it("should handle whitespace in API key", async () => {
      mockGetCachedApiKey.mockResolvedValue(null);
      mockFindByHash.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/invoices", {
        headers: { Authorization: "Bearer   ob_live_test123  " },
      });

      expect(res.status).toBe(200);
    });

    it("should handle HEAD requests as read operations", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);
      mockHasPermission.mockReturnValue(true);

      app.use("*", apiKeyAuth);
      app.on("HEAD", "/api/v1/invoices", (c) => c.body(null));

      await app.request("/api/v1/invoices", {
        method: "HEAD",
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      expect(mockHasPermission).toHaveBeenCalledWith(validApiKey, "invoices:read");
    });

    it("should handle unknown resources without permission check", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/v1/unknown-resource", (c) => c.json({ success: true }));

      const res = await app.request("/api/v1/unknown-resource", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      // Should succeed without permission check for unknown resources
      expect(res.status).toBe(200);
      // hasPermission should not be called for unknown resource
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("should handle paths without v1 segment", async () => {
      mockGetCachedApiKey.mockResolvedValue(validApiKey as any);

      app.use("*", apiKeyAuth);
      app.get("/api/invoices", (c) => c.json({ success: true }));

      const res = await app.request("/api/invoices", {
        headers: { Authorization: "Bearer ob_live_test123" },
      });

      // Should succeed without permission check
      expect(res.status).toBe(200);
      expect(mockHasPermission).not.toHaveBeenCalled();
    });
  });
});
