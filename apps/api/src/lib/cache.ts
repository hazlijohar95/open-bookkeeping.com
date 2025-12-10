/**
 * Cache Service
 * Provides application-level caching with automatic invalidation
 */

import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from "./redis";

// Cache key prefixes
const CACHE_KEYS = {
  DASHBOARD_STATS: "dashboard:stats:",
  REVENUE_CHART: "dashboard:revenue:",
  INVOICE_LIST: "invoices:list:",
  CUSTOMER_LIST: "customers:list:",
  QUOTATION_LIST: "quotations:list:",
} as const;

// Cache TTL in seconds
const CACHE_TTL = {
  DASHBOARD_STATS: 60, // 1 minute - frequently updated data
  REVENUE_CHART: 300, // 5 minutes - less frequently updated
  LIST_DATA: 30, // 30 seconds - list data
} as const;

/**
 * Dashboard Stats Cache
 */
export async function getCachedDashboardStats<T>(userId: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.DASHBOARD_STATS}${userId}`);
}

export async function setCachedDashboardStats<T>(userId: string, data: T): Promise<void> {
  await cacheSet(`${CACHE_KEYS.DASHBOARD_STATS}${userId}`, data, CACHE_TTL.DASHBOARD_STATS);
}

export async function invalidateDashboardStats(userId: string): Promise<void> {
  await cacheDel(`${CACHE_KEYS.DASHBOARD_STATS}${userId}`);
}

/**
 * Revenue Chart Cache
 */
export async function getCachedRevenueChart<T>(userId: string, months: number): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.REVENUE_CHART}${userId}:${months}`);
}

export async function setCachedRevenueChart<T>(userId: string, months: number, data: T): Promise<void> {
  await cacheSet(`${CACHE_KEYS.REVENUE_CHART}${userId}:${months}`, data, CACHE_TTL.REVENUE_CHART);
}

export async function invalidateRevenueChart(userId: string): Promise<void> {
  await cacheDelPattern(`${CACHE_KEYS.REVENUE_CHART}${userId}:*`);
}

/**
 * Invoice List Cache
 */
export async function getCachedInvoiceList<T>(userId: string, key: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.INVOICE_LIST}${userId}:${key}`);
}

export async function setCachedInvoiceList<T>(userId: string, key: string, data: T): Promise<void> {
  await cacheSet(`${CACHE_KEYS.INVOICE_LIST}${userId}:${key}`, data, CACHE_TTL.LIST_DATA);
}

export async function invalidateInvoiceList(userId: string): Promise<void> {
  await cacheDelPattern(`${CACHE_KEYS.INVOICE_LIST}${userId}:*`);
}

/**
 * Customer List Cache
 */
export async function getCachedCustomerList<T>(userId: string, key: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.CUSTOMER_LIST}${userId}:${key}`);
}

export async function setCachedCustomerList<T>(userId: string, key: string, data: T): Promise<void> {
  await cacheSet(`${CACHE_KEYS.CUSTOMER_LIST}${userId}:${key}`, data, CACHE_TTL.LIST_DATA);
}

export async function invalidateCustomerList(userId: string): Promise<void> {
  await cacheDelPattern(`${CACHE_KEYS.CUSTOMER_LIST}${userId}:*`);
}

/**
 * Quotation List Cache
 */
export async function getCachedQuotationList<T>(userId: string, key: string): Promise<T | null> {
  return cacheGet<T>(`${CACHE_KEYS.QUOTATION_LIST}${userId}:${key}`);
}

export async function setCachedQuotationList<T>(userId: string, key: string, data: T): Promise<void> {
  await cacheSet(`${CACHE_KEYS.QUOTATION_LIST}${userId}:${key}`, data, CACHE_TTL.LIST_DATA);
}

export async function invalidateQuotationList(userId: string): Promise<void> {
  await cacheDelPattern(`${CACHE_KEYS.QUOTATION_LIST}${userId}:*`);
}

/**
 * Invalidate all user caches (e.g., on significant data changes)
 */
export async function invalidateAllUserCaches(userId: string): Promise<void> {
  await Promise.all([
    invalidateDashboardStats(userId),
    invalidateRevenueChart(userId),
    invalidateInvoiceList(userId),
    invalidateCustomerList(userId),
    invalidateQuotationList(userId),
  ]);
}

/**
 * Invalidate caches related to invoice operations
 */
export async function invalidateInvoiceCaches(userId: string): Promise<void> {
  await Promise.all([
    invalidateDashboardStats(userId),
    invalidateRevenueChart(userId),
    invalidateInvoiceList(userId),
  ]);
}

/**
 * Invalidate caches related to quotation operations
 */
export async function invalidateQuotationCaches(userId: string): Promise<void> {
  await Promise.all([
    invalidateDashboardStats(userId),
    invalidateQuotationList(userId),
  ]);
}

/**
 * Invalidate caches related to customer operations
 */
export async function invalidateCustomerCaches(userId: string): Promise<void> {
  await Promise.all([
    invalidateCustomerList(userId),
    invalidateInvoiceList(userId), // Customer changes may affect invoice displays
  ]);
}
