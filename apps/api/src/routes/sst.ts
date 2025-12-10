/**
 * SST (Sales & Service Tax) REST Routes
 * Provides REST API endpoints for Malaysian SST compliance
 */

import { Hono } from "hono";
import { z } from "zod";
import { db, userSettings, invoicesV2 } from "@open-bookkeeping/db";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const sstRoutes = new Hono();

// Static data - Malaysian SST rate presets
const SST_RATE_PRESETS = [
  { code: "ST6", label: "Service Tax 6%", rate: 6, taxType: "service_tax" as const },
  { code: "ST8", label: "Service Tax 8%", rate: 8, taxType: "service_tax" as const },
  { code: "SA5", label: "Sales Tax 5%", rate: 5, taxType: "sales_tax" as const },
  { code: "SA10", label: "Sales Tax 10%", rate: 10, taxType: "sales_tax" as const },
  { code: "EXEMPT", label: "Exempt", rate: 0, taxType: "sales_tax" as const },
];

// Static data - Business categories with thresholds
const BUSINESS_CATEGORIES = [
  { value: "fnb", label: "Food & Beverage", threshold: 1500000 },
  { value: "telecom", label: "Telecommunications", threshold: 500000 },
  { value: "parking", label: "Parking Operations", threshold: 500000 },
  { value: "other_services", label: "Other Taxable Services", threshold: 500000 },
  { value: "manufacturing", label: "Manufacturing", threshold: 500000 },
];

// Validation schemas
const complianceSettingsSchema = z.object({
  businessCategory: z.string().max(50).optional(),
  manualRevenue: z.number().min(0).optional(),
  useManualRevenue: z.boolean().optional(),
  registrationNumber: z.string().max(50).optional().nullable(),
  registrationDate: z.string().datetime().optional().nullable(),
});

const saveReturnSchema = z.object({
  taxPeriodCode: z.string(),
  status: z.enum(["draft", "submitted", "amended"]),
  referenceNumber: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================
// STATIC DATA ENDPOINTS
// ============================================

// GET /sst/rate-presets - Get SST rate presets
sstRoutes.get("/rate-presets", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  return c.json(SST_RATE_PRESETS);
});

// GET /sst/business-categories - Get business categories
sstRoutes.get("/business-categories", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  return c.json(BUSINESS_CATEGORIES);
});

// ============================================
// COMPLIANCE ENDPOINTS
// ============================================

// GET /sst/compliance-status - Get compliance status
sstRoutes.get("/compliance-status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    // Get user settings
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    const businessCategory = settings?.sstBusinessCategory || "other_services";
    const categoryInfo = BUSINESS_CATEGORIES.find((cat) => cat.value === businessCategory) ||
      BUSINESS_CATEGORIES.find((cat) => cat.value === "other_services")!;

    // Calculate annual revenue from invoices
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [revenueResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoicesV2.total} AS NUMERIC)), 0)`,
      })
      .from(invoicesV2)
      .where(
        and(
          eq(invoicesV2.userId, user.id),
          eq(invoicesV2.status, "success"),
          gte(invoicesV2.createdAt, oneYearAgo)
        )
      );

    const calculatedRevenue = parseFloat(revenueResult?.total || "0");
    const manualRevenue = parseFloat(settings?.sstManualRevenue || "0");
    const useManualRevenue = settings?.sstUseManualRevenue || false;
    const currentRevenue = useManualRevenue ? manualRevenue : calculatedRevenue;
    const progressPercent = Math.min((currentRevenue / categoryInfo.threshold) * 100, 100);

    // Determine status
    let status: "below" | "voluntary" | "approaching" | "exceeded" | "registered";
    if (settings?.sstRegistrationNumber) {
      status = "registered";
    } else if (currentRevenue >= categoryInfo.threshold) {
      status = "exceeded";
    } else if (progressPercent >= 80) {
      status = "approaching";
    } else if (progressPercent >= 50) {
      status = "voluntary";
    } else {
      status = "below";
    }

    // Get monthly revenue for the last 12 months
    const monthlyRevenue: Array<{ month: string; revenue: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7); // YYYY-MM format

      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const [monthResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${invoicesV2.total} AS NUMERIC)), 0)`,
        })
        .from(invoicesV2)
        .where(
          and(
            eq(invoicesV2.userId, user.id),
            eq(invoicesV2.status, "success"),
            gte(invoicesV2.createdAt, startOfMonth),
            lte(invoicesV2.createdAt, endOfMonth)
          )
        );

      monthlyRevenue.push({
        month,
        revenue: parseFloat(monthResult?.total || "0"),
      });
    }

    return c.json({
      businessCategory,
      businessCategoryLabel: categoryInfo.label,
      threshold: categoryInfo.threshold,
      calculatedRevenue,
      manualRevenue,
      useManualRevenue,
      currentRevenue,
      progressPercent,
      status,
      isRegistered: !!settings?.sstRegistrationNumber,
      registrationNumber: settings?.sstRegistrationNumber || null,
      registrationDate: settings?.sstRegistrationDate?.toISOString() || null,
      monthlyRevenue,
    });
  } catch (error) {
    console.error("Error fetching compliance status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch compliance status");
  }
});

// PATCH /sst/compliance-settings - Update compliance settings
sstRoutes.patch("/compliance-settings", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = complianceSettingsSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { businessCategory, manualRevenue, useManualRevenue, registrationNumber, registrationDate } = validation.data;

    const [updated] = await db
      .update(userSettings)
      .set({
        sstBusinessCategory: businessCategory,
        sstManualRevenue: manualRevenue?.toString(),
        sstUseManualRevenue: useManualRevenue,
        sstRegistrationNumber: registrationNumber,
        sstRegistrationDate: registrationDate ? new Date(registrationDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    if (!updated) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Settings not found");
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating compliance settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update compliance settings");
  }
});

// ============================================
// SUMMARY & REPORTING ENDPOINTS
// ============================================

// GET /sst/summary - Get SST summary
sstRoutes.get("/summary", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const period = c.req.query("period") || "current_month";
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (period) {
      case "current_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get invoices in period
    const periodInvoices = await db.query.invoicesV2.findMany({
      where: and(
        eq(invoicesV2.userId, user.id),
        gte(invoicesV2.createdAt, startDate),
        lte(invoicesV2.createdAt, endDate)
      ),
    });

    // Calculate totals (simplified - assuming all tax is service tax for now)
    let totalSalesTax = 0;
    let totalServiceTax = 0;
    let totalTaxableAmount = 0;

    for (const inv of periodInvoices) {
      const taxAmount = parseFloat(inv.taxTotal || "0");
      totalServiceTax += taxAmount;
      totalTaxableAmount += parseFloat(inv.subtotal || "0");
    }

    const totalOutputTax = totalSalesTax + totalServiceTax;

    return c.json({
      totalSalesTax,
      totalServiceTax,
      totalOutputTax,
      totalTaxableAmount,
      transactionCount: periodInvoices.length,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      comparison: {
        previousTotal: 0, // TODO: Calculate previous period
        percentChange: 0,
        trend: "flat" as const,
      },
    });
  } catch (error) {
    console.error("Error fetching SST summary:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch SST summary");
  }
});

// GET /sst/trend-chart - Get trend chart data
sstRoutes.get("/trend-chart", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const period = c.req.query("period") || "6m";
    const months = period === "12m" ? 12 : 6;

    const trendData: Array<{ month: string; salesTax: number; serviceTax: number; total: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString("default", { month: "short" });
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const [result] = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${invoicesV2.taxTotal} AS NUMERIC)), 0)`,
        })
        .from(invoicesV2)
        .where(
          and(
            eq(invoicesV2.userId, user.id),
            gte(invoicesV2.createdAt, startOfMonth),
            lte(invoicesV2.createdAt, endOfMonth)
          )
        );

      const taxTotal = parseFloat(result?.total || "0");

      trendData.push({
        month,
        salesTax: 0, // Simplified
        serviceTax: taxTotal,
        total: taxTotal,
      });
    }

    return c.json(trendData);
  } catch (error) {
    console.error("Error fetching trend chart:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch trend chart");
  }
});

// GET /sst/transactions - Get SST transactions
sstRoutes.get("/transactions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const page = Number(c.req.query("page")) || 1;
    const pageSize = Number(c.req.query("pageSize")) || 20;
    const offset = (page - 1) * pageSize;

    // Get invoices with tax
    const taxInvoices = await db.query.invoicesV2.findMany({
      where: eq(invoicesV2.userId, user.id),
      limit: pageSize,
      offset,
      orderBy: [desc(invoicesV2.createdAt)],
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoicesV2)
      .where(eq(invoicesV2.userId, user.id));

    const transactions = taxInvoices.map((inv) => ({
      id: inv.id,
      documentType: "invoice",
      documentId: inv.id,
      documentNumber: inv.serialNumber || "",
      documentDate: inv.createdAt?.toISOString() || "",
      customerName: (inv.clientDetails as any)?.name || "Unknown",
      customerTin: (inv.clientDetails as any)?.taxId || "",
      taxType: "service_tax",
      taxRate: 6,
      taxableAmount: parseFloat(inv.subtotal || "0"),
      taxAmount: parseFloat(inv.taxTotal || "0"),
      description: "Invoice",
    }));

    return c.json({
      transactions,
      pagination: {
        page,
        pageSize,
        totalCount: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching SST transactions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch SST transactions");
  }
});

// GET /sst/available-periods - Get available tax periods
sstRoutes.get("/available-periods", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  // Generate last 12 bimonthly periods
  const periods: string[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (i * 2), 1);
    const month = date.getMonth() + 1;
    const period = month <= 2 ? "01-02" : month <= 4 ? "03-04" : month <= 6 ? "05-06" :
      month <= 8 ? "07-08" : month <= 10 ? "09-10" : "11-12";
    const code = `${date.getFullYear()}-${period}`;

    if (!periods.includes(code)) {
      periods.push(code);
    }
  }

  return c.json(periods.slice(0, 6)); // Return last 6 periods
});

// GET /sst/sst02-return/:taxPeriod - Get SST-02 return data
sstRoutes.get("/sst02-return/:taxPeriod", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const taxPeriod = c.req.param("taxPeriod");

    // Get user settings for registration info
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    // Parse period (e.g., "2024-01-02" -> Jan-Feb 2024)
    const [year, monthRange] = taxPeriod.split("-");
    const [startMonth] = (monthRange || "01-02").split("-").map(Number);
    const endMonth = startMonth + 1;

    const periodStart = new Date(Number(year), startMonth - 1, 1);
    const periodEnd = new Date(Number(year), endMonth, 0);

    // Get invoices in period
    const periodInvoices = await db.query.invoicesV2.findMany({
      where: and(
        eq(invoicesV2.userId, user.id),
        gte(invoicesV2.createdAt, periodStart),
        lte(invoicesV2.createdAt, periodEnd)
      ),
    });

    // Calculate by rate - all invoices use 6% rate for now
    // In a real implementation, this would filter based on actual tax rate stored per invoice
    const byRate6 = periodInvoices; // All invoices assumed at 6%
    const byRate8: typeof periodInvoices = []; // No 8% invoices currently

    const calculateTotals = (invs: typeof periodInvoices) => ({
      taxableAmount: invs.reduce((sum, inv) => sum + parseFloat(inv.subtotal || "0"), 0),
      taxAmount: invs.reduce((sum, inv) => sum + parseFloat(inv.taxTotal || "0"), 0),
      transactionCount: invs.length,
    });

    const rate6Totals = calculateTotals(byRate6);
    const rate8Totals = calculateTotals(byRate8);

    const totalServiceTax = rate6Totals.taxAmount + rate8Totals.taxAmount;

    return c.json({
      partA: {
        sstRegistrationNumber: settings?.sstRegistrationNumber || "",
        tin: settings?.companyTaxId || "",
        brn: "",
        taxPeriod,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      partB: {
        byRate: [], // Sales tax (empty for service tax businesses)
        totalTaxableAmount: 0,
        totalTaxAmount: 0,
      },
      partC: {
        byRate: [
          { rate: 6, ...rate6Totals },
          { rate: 8, ...rate8Totals },
        ].filter((r) => r.transactionCount > 0),
        totalTaxableAmount: rate6Totals.taxableAmount + rate8Totals.taxableAmount,
        totalTaxAmount: totalServiceTax,
      },
      partD: {
        totalSalesTax: 0,
        totalServiceTax,
        totalTaxPayable: totalServiceTax,
      },
      transactions: periodInvoices.map((inv) => ({
        id: inv.id,
        documentType: "invoice",
        documentId: inv.id,
        documentNumber: inv.serialNumber || "",
        documentDate: inv.createdAt?.toISOString() || "",
        customerName: (inv.clientDetails as any)?.name || "",
        taxType: "service_tax",
        taxRate: 6,
        taxableAmount: parseFloat(inv.subtotal || "0"),
        taxAmount: parseFloat(inv.taxTotal || "0"),
      })),
    });
  } catch (error) {
    console.error("Error fetching SST-02 return:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch SST-02 return");
  }
});

// GET /sst/return-submissions - Get return submissions
sstRoutes.get("/return-submissions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  // Return empty array - would be stored in a separate table in production
  return c.json([]);
});

// POST /sst/return-submission - Save return submission
sstRoutes.post("/return-submission", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await c.req.json();
    const validation = saveReturnSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    // In production, this would save to a database table
    // For now, just return success
    return c.json({
      id: crypto.randomUUID(),
      action: validation.data.status === "submitted" ? "submitted" : "saved",
    });
  } catch (error) {
    console.error("Error saving return submission:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to save return submission");
  }
});
