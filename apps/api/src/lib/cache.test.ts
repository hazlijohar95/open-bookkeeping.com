import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCachedDashboardStats,
  setCachedDashboardStats,
  invalidateDashboardStats,
  getCachedRevenueChart,
  setCachedRevenueChart,
  invalidateRevenueChart,
  getCachedInvoiceList,
  setCachedInvoiceList,
  invalidateInvoiceList,
  getCachedCustomerList,
  setCachedCustomerList,
  invalidateCustomerList,
  getCachedQuotationList,
  setCachedQuotationList,
  invalidateQuotationList,
  invalidateAllUserCaches,
  invalidateInvoiceCaches,
  invalidateQuotationCaches,
  invalidateCustomerCaches,
  getCachedApiKey,
  setCachedApiKey,
  invalidateApiKeyCache,
  invalidateUserApiKeyCache,
} from "./cache";

// Mock Redis functions
vi.mock("./redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  cacheDelPattern: vi.fn(),
}));

import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from "./redis";

const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);
const mockCacheDel = vi.mocked(cacheDel);
const mockCacheDelPattern = vi.mocked(cacheDelPattern);

describe("Cache Service", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Dashboard Stats Cache", () => {
    it("should get cached dashboard stats with correct key", async () => {
      const mockData = { totalInvoices: 100, revenue: 50000 };
      mockCacheGet.mockResolvedValue(mockData);

      const result = await getCachedDashboardStats(userId);

      expect(mockCacheGet).toHaveBeenCalledWith(`dashboard:stats:${userId}`);
      expect(result).toEqual(mockData);
    });

    it("should return null when cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const result = await getCachedDashboardStats(userId);

      expect(result).toBeNull();
    });

    it("should set cached dashboard stats with 60s TTL", async () => {
      const data = { totalInvoices: 100 };

      await setCachedDashboardStats(userId, data);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `dashboard:stats:${userId}`,
        data,
        60 // 1 minute TTL
      );
    });

    it("should invalidate dashboard stats cache", async () => {
      await invalidateDashboardStats(userId);

      expect(mockCacheDel).toHaveBeenCalledWith(`dashboard:stats:${userId}`);
    });
  });

  describe("Revenue Chart Cache", () => {
    it("should get cached revenue chart with user and months", async () => {
      const mockData = { months: [{ month: "Jan", revenue: 5000 }] };
      mockCacheGet.mockResolvedValue(mockData);

      const result = await getCachedRevenueChart(userId, 12);

      expect(mockCacheGet).toHaveBeenCalledWith(`dashboard:revenue:${userId}:12`);
      expect(result).toEqual(mockData);
    });

    it("should set cached revenue chart with 5 minute TTL", async () => {
      const data = { months: [] };

      await setCachedRevenueChart(userId, 6, data);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `dashboard:revenue:${userId}:6`,
        data,
        300 // 5 minutes TTL
      );
    });

    it("should invalidate revenue chart with pattern", async () => {
      await invalidateRevenueChart(userId);

      expect(mockCacheDelPattern).toHaveBeenCalledWith(`dashboard:revenue:${userId}:*`);
    });
  });

  describe("Invoice List Cache", () => {
    it("should get cached invoice list with user and key", async () => {
      const mockData = [{ id: "inv-1" }, { id: "inv-2" }];
      mockCacheGet.mockResolvedValue(mockData);

      const result = await getCachedInvoiceList(userId, "page:1:limit:10");

      expect(mockCacheGet).toHaveBeenCalledWith(`invoices:list:${userId}:page:1:limit:10`);
      expect(result).toEqual(mockData);
    });

    it("should set cached invoice list with 30s TTL", async () => {
      const data = [{ id: "inv-1" }];

      await setCachedInvoiceList(userId, "draft", data);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `invoices:list:${userId}:draft`,
        data,
        30 // 30 seconds TTL
      );
    });

    it("should invalidate invoice list with pattern", async () => {
      await invalidateInvoiceList(userId);

      expect(mockCacheDelPattern).toHaveBeenCalledWith(`invoices:list:${userId}:*`);
    });
  });

  describe("Customer List Cache", () => {
    it("should get cached customer list", async () => {
      const mockData = [{ id: "cust-1", name: "Acme" }];
      mockCacheGet.mockResolvedValue(mockData);

      const result = await getCachedCustomerList(userId, "all");

      expect(mockCacheGet).toHaveBeenCalledWith(`customers:list:${userId}:all`);
      expect(result).toEqual(mockData);
    });

    it("should set cached customer list with 30s TTL", async () => {
      const data = [{ id: "cust-1" }];

      await setCachedCustomerList(userId, "search:acme", data);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `customers:list:${userId}:search:acme`,
        data,
        30
      );
    });

    it("should invalidate customer list with pattern", async () => {
      await invalidateCustomerList(userId);

      expect(mockCacheDelPattern).toHaveBeenCalledWith(`customers:list:${userId}:*`);
    });
  });

  describe("Quotation List Cache", () => {
    it("should get cached quotation list", async () => {
      const mockData = [{ id: "quot-1" }];
      mockCacheGet.mockResolvedValue(mockData);

      const result = await getCachedQuotationList(userId, "pending");

      expect(mockCacheGet).toHaveBeenCalledWith(`quotations:list:${userId}:pending`);
      expect(result).toEqual(mockData);
    });

    it("should set cached quotation list with 30s TTL", async () => {
      const data = [{ id: "quot-1" }];

      await setCachedQuotationList(userId, "all", data);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `quotations:list:${userId}:all`,
        data,
        30
      );
    });

    it("should invalidate quotation list with pattern", async () => {
      await invalidateQuotationList(userId);

      expect(mockCacheDelPattern).toHaveBeenCalledWith(`quotations:list:${userId}:*`);
    });
  });

  describe("Bulk Invalidation Functions", () => {
    it("should invalidate all user caches", async () => {
      await invalidateAllUserCaches(userId);

      expect(mockCacheDel).toHaveBeenCalledWith(`dashboard:stats:${userId}`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`dashboard:revenue:${userId}:*`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`invoices:list:${userId}:*`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`customers:list:${userId}:*`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`quotations:list:${userId}:*`);
    });

    it("should invalidate invoice-related caches", async () => {
      await invalidateInvoiceCaches(userId);

      expect(mockCacheDel).toHaveBeenCalledWith(`dashboard:stats:${userId}`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`dashboard:revenue:${userId}:*`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`invoices:list:${userId}:*`);
      // Should not invalidate customer or quotation caches
      expect(mockCacheDelPattern).not.toHaveBeenCalledWith(`customers:list:${userId}:*`);
      expect(mockCacheDelPattern).not.toHaveBeenCalledWith(`quotations:list:${userId}:*`);
    });

    it("should invalidate quotation-related caches", async () => {
      await invalidateQuotationCaches(userId);

      expect(mockCacheDel).toHaveBeenCalledWith(`dashboard:stats:${userId}`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`quotations:list:${userId}:*`);
      // Should not invalidate invoice or customer caches
      expect(mockCacheDelPattern).not.toHaveBeenCalledWith(`invoices:list:${userId}:*`);
      expect(mockCacheDelPattern).not.toHaveBeenCalledWith(`customers:list:${userId}:*`);
    });

    it("should invalidate customer-related caches including invoices", async () => {
      await invalidateCustomerCaches(userId);

      expect(mockCacheDelPattern).toHaveBeenCalledWith(`customers:list:${userId}:*`);
      expect(mockCacheDelPattern).toHaveBeenCalledWith(`invoices:list:${userId}:*`);
      // Should not invalidate dashboard or quotation caches
      expect(mockCacheDel).not.toHaveBeenCalledWith(`dashboard:stats:${userId}`);
      expect(mockCacheDelPattern).not.toHaveBeenCalledWith(`quotations:list:${userId}:*`);
    });
  });

  describe("API Key Cache", () => {
    const keyHash = "abc123def456";

    it("should get cached API key by hash", async () => {
      const mockApiKey = {
        id: "key-1",
        userId: "user-1",
        keyHash,
        name: "Test Key",
        isActive: true,
      };
      mockCacheGet.mockResolvedValue(mockApiKey);

      const result = await getCachedApiKey(keyHash);

      expect(mockCacheGet).toHaveBeenCalledWith(`apikey:hash:${keyHash}`);
      expect(result).toEqual(mockApiKey);
    });

    it("should return null for cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const result = await getCachedApiKey("nonexistent");

      expect(result).toBeNull();
    });

    it("should set cached API key with 2 minute TTL for security", async () => {
      const apiKey = {
        id: "key-1",
        userId: "user-1",
        keyHash,
        name: "Test Key",
        isActive: true,
      };

      await setCachedApiKey(keyHash, apiKey as any);

      expect(mockCacheSet).toHaveBeenCalledWith(
        `apikey:hash:${keyHash}`,
        apiKey,
        120 // 2 minutes - shorter for security
      );
    });

    it("should invalidate specific API key cache", async () => {
      await invalidateApiKeyCache(keyHash);

      expect(mockCacheDel).toHaveBeenCalledWith(`apikey:hash:${keyHash}`);
    });

    it("should invalidate all API key caches for a user", async () => {
      await invalidateUserApiKeyCache(userId);

      // Current implementation invalidates all keys with pattern
      expect(mockCacheDelPattern).toHaveBeenCalledWith("apikey:hash:*");
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent keys for same parameters", async () => {
      mockCacheGet.mockResolvedValue(null);

      await getCachedDashboardStats("user-abc");
      await getCachedDashboardStats("user-abc");

      expect(mockCacheGet).toHaveBeenCalledTimes(2);
      expect(mockCacheGet).toHaveBeenNthCalledWith(1, "dashboard:stats:user-abc");
      expect(mockCacheGet).toHaveBeenNthCalledWith(2, "dashboard:stats:user-abc");
    });

    it("should generate different keys for different users", async () => {
      mockCacheGet.mockResolvedValue(null);

      await getCachedDashboardStats("user-1");
      await getCachedDashboardStats("user-2");

      expect(mockCacheGet).toHaveBeenCalledWith("dashboard:stats:user-1");
      expect(mockCacheGet).toHaveBeenCalledWith("dashboard:stats:user-2");
    });
  });
});
