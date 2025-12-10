import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  rateLimit,
  generalRateLimit,
  authRateLimit,
  aiRateLimit,
  heavyRateLimit,
  strictRateLimit,
  apiV1ReadRateLimit,
  apiV1WriteRateLimit,
  apiV1WebhookRateLimit,
  methodBasedRateLimit,
  apiV1RateLimit,
} from "./rate-limit";

// Mock the redis checkRateLimit function
vi.mock("../lib/redis", () => ({
  checkRateLimit: vi.fn(),
}));

import { checkRateLimit } from "../lib/redis";

const mockCheckRateLimit = vi.mocked(checkRateLimit);

describe("Rate Limit Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
  });

  describe("rateLimit() factory", () => {
    it("should allow request when under limit", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const middleware = rateLimit({ limit: 100, windowSeconds: 60 });
      app.use("*", middleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("should return 429 when rate limit exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });

      const middleware = rateLimit({ limit: 10, windowSeconds: 60 });
      app.use("*", middleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");

      const body = await res.json();
      expect(body.error).toBe("Too Many Requests");
      expect(body.retryAfter).toBe(60);
    });

    it("should use path and identifier in rate limit key", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const middleware = rateLimit({ limit: 100, windowSeconds: 60 });
      app.use("*", middleware);
      app.get("/api/invoices", (c) => c.json({ success: true }));

      await app.request("/api/invoices");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("/api/invoices:"),
        100,
        60
      );
    });

    it("should use custom key generator when provided", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const customKeyGen = () => "custom:key:123";
      const middleware = rateLimit({
        limit: 50,
        windowSeconds: 30,
        keyGenerator: customKeyGen,
      });
      app.use("*", middleware);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("custom:key:123"),
        50,
        30
      );
    });

    it("should extract user identifier from Bearer token", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const middleware = rateLimit({ limit: 100, windowSeconds: 60 });
      app.use("*", middleware);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: {
          Authorization: "Bearer my-jwt-token",
        },
      });

      // Should use hashed token as identifier
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringMatching(/\/test:user:[a-f0-9]+/),
        100,
        60
      );
    });

    it("should fall back to IP when no auth header", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const middleware = rateLimit({ limit: 100, windowSeconds: 60 });
      app.use("*", middleware);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: {
          "cf-connecting-ip": "192.168.1.1",
        },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:192.168.1.1",
        100,
        60
      );
    });
  });

  describe("Pre-configured Rate Limiters", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetAt: Date.now() + 60000,
      });
    });

    it("generalRateLimit should use 100 requests per minute", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });

    it("authRateLimit should use 10 requests per minute", async () => {
      app.use("*", authRateLimit);
      app.get("/auth/login", (c) => c.json({ success: true }));

      await app.request("/auth/login");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        10,
        60
      );
    });

    it("aiRateLimit should use 20 requests per minute", async () => {
      app.use("*", aiRateLimit);
      app.post("/ai/generate", (c) => c.json({ success: true }));

      await app.request("/ai/generate", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        20,
        60
      );
    });

    it("heavyRateLimit should use 10 requests per minute", async () => {
      app.use("*", heavyRateLimit);
      app.get("/pdf/generate", (c) => c.json({ success: true }));

      await app.request("/pdf/generate");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        10,
        60
      );
    });

    it("strictRateLimit should use 5 requests per minute", async () => {
      app.use("*", strictRateLimit);
      app.post("/admin/action", (c) => c.json({ success: true }));

      await app.request("/admin/action", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        5,
        60
      );
    });
  });

  describe("API v1 Rate Limiters", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 500,
        resetAt: Date.now() + 60000,
      });
    });

    it("apiV1ReadRateLimit should use 1000 requests per minute", async () => {
      app.use("*", apiV1ReadRateLimit);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        1000,
        60
      );
    });

    it("apiV1WriteRateLimit should use 100 requests per minute", async () => {
      app.use("*", apiV1WriteRateLimit);
      app.post("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });

    it("apiV1WebhookRateLimit should use 50 requests per minute", async () => {
      app.use("*", apiV1WebhookRateLimit);
      app.post("/api/v1/webhooks", (c) => c.json({ success: true }));

      await app.request("/api/v1/webhooks", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        50,
        60
      );
    });

    it("should use API key as identifier for Bearer ob_ tokens", async () => {
      app.use("*", apiV1ReadRateLimit);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", {
        headers: {
          Authorization: "Bearer ob_live_abc123def456",
        },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/invoices:apikey:[a-f0-9]+/),
        1000,
        60
      );
    });

    it("should use X-API-Key header when present", async () => {
      app.use("*", apiV1ReadRateLimit);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", {
        headers: {
          "x-api-key": "ob_test_xyz789",
        },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/invoices:apikey:[a-f0-9]+/),
        1000,
        60
      );
    });
  });

  describe("methodBasedRateLimit()", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 500,
        resetAt: Date.now() + 60000,
      });
    });

    it("should apply read limit for GET requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.get("/resource", (c) => c.json({ success: true }));

      await app.request("/resource", { method: "GET" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        1000,
        60
      );
    });

    it("should apply read limit for HEAD requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.on("HEAD", "/resource", (c) => c.body(null));

      await app.request("/resource", { method: "HEAD" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        1000,
        60
      );
    });

    it("should apply read limit for OPTIONS requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.on("OPTIONS", "/resource", (c) => c.body(null));

      await app.request("/resource", { method: "OPTIONS" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        1000,
        60
      );
    });

    it("should apply write limit for POST requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.post("/resource", (c) => c.json({ success: true }));

      await app.request("/resource", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });

    it("should apply write limit for PUT requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.put("/resource", (c) => c.json({ success: true }));

      await app.request("/resource", { method: "PUT" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });

    it("should apply write limit for DELETE requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.delete("/resource/:id", (c) => c.json({ success: true }));

      await app.request("/resource/123", { method: "DELETE" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });

    it("should apply write limit for PATCH requests", async () => {
      const middleware = methodBasedRateLimit(1000, 100, 60);
      app.use("*", middleware);
      app.patch("/resource/:id", (c) => c.json({ success: true }));

      await app.request("/resource/123", { method: "PATCH" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });
  });

  describe("apiV1RateLimit combined middleware", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 500,
        resetAt: Date.now() + 60000,
      });
    });

    it("should use 1000/min for GET", async () => {
      app.use("*", apiV1RateLimit);
      app.get("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices");

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        1000,
        60
      );
    });

    it("should use 100/min for POST", async () => {
      app.use("*", apiV1RateLimit);
      app.post("/api/v1/invoices", (c) => c.json({ success: true }));

      await app.request("/api/v1/invoices", { method: "POST" });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100,
        60
      );
    });
  });

  describe("IP Validation", () => {
    beforeEach(() => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
    });

    it("should accept valid IPv4 addresses", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: { "cf-connecting-ip": "192.168.1.1" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:192.168.1.1",
        100,
        60
      );
    });

    it("should accept IPv4 with edge values", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: { "cf-connecting-ip": "0.0.0.0" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:0.0.0.0",
        100,
        60
      );

      vi.clearAllMocks();
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      await app.request("/test", {
        headers: { "cf-connecting-ip": "255.255.255.255" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:255.255.255.255",
        100,
        60
      );
    });

    it("should reject invalid IPv4 with out-of-range octets", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: { "cf-connecting-ip": "192.168.256.1" },
      });

      // Should fall back to "unknown" for invalid IP
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:unknown",
        100,
        60
      );
    });

    it("should reject IPv4 with negative octets via regex", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      // This won't match the IPv4 regex pattern (requires digits only)
      await app.request("/test", {
        headers: { "cf-connecting-ip": "-1.168.1.1" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:unknown",
        100,
        60
      );
    });

    it("should accept valid IPv6 addresses", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: { "cf-connecting-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        100,
        60
      );
    });

    it("should accept compressed IPv6 addresses", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: { "cf-connecting-ip": "::1" },
      });

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:::1",
        100,
        60
      );
    });

    it("should use X-Forwarded-For from trusted proxy", async () => {
      app.use("*", generalRateLimit);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test", {
        headers: {
          "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
          "x-real-ip": "127.0.0.1", // Trusted proxy
        },
      });

      // Should take first IP from X-Forwarded-For chain
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "/test:ip:203.0.113.50",
        100,
        60
      );
    });
  });
});
