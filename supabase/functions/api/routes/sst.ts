/**
 * SST (Sales & Service Tax) Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/sst.ts
 * Handles Malaysian SST compliance and reporting
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// ============================================
// CONSTANTS
// ============================================

// SST Business Categories with thresholds
const SST_BUSINESS_CATEGORIES = [
  { value: "fnb", label: "Food & Beverage", threshold: 1500000 },
  { value: "telecom", label: "Telecommunications", threshold: 1500000 },
  { value: "parking", label: "Parking Services", threshold: 1500000 },
  { value: "other_services", label: "Other Taxable Services", threshold: 500000 },
  { value: "manufacturing", label: "Manufacturing (Sales Tax)", threshold: 500000 },
];

// SST Rate presets for Malaysian Sales and Service Tax
const SST_RATE_PRESETS = [
  { code: "ST_10", label: "Sales Tax 10%", rate: 10, taxType: "sales_tax" },
  { code: "ST_5", label: "Sales Tax 5%", rate: 5, taxType: "sales_tax" },
  { code: "ST_0", label: "Sales Tax 0%", rate: 0, taxType: "sales_tax" },
  { code: "SVT_6", label: "Service Tax 6%", rate: 6, taxType: "service_tax" },
  { code: "SVT_8", label: "Service Tax 8%", rate: 8, taxType: "service_tax" },
];

// ============================================
// ZOD SCHEMAS
// ============================================

const summaryInputSchema = z.object({
  period: z.enum(["current_month", "last_month", "quarter", "year", "custom"]).default("current_month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const trendChartInputSchema = z.object({
  period: z.enum(["6m", "12m"]).default("6m"),
});

const transactionQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(50),
  taxType: z.enum(["all", "sales_tax", "service_tax"]).default("all"),
  documentType: z.enum(["all", "invoice", "credit_note", "debit_note"]).default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const saveReturnSchema = z.object({
  taxPeriodCode: z.string(),
  status: z.enum(["draft", "submitted", "amended"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const complianceSettingsSchema = z.object({
  businessCategory: z.string().optional(),
  manualRevenue: z.coerce.number().optional(),
  useManualRevenue: z.boolean().optional(),
  registrationNumber: z.string().optional().nullable(),
  registrationDate: z.string().optional().nullable(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPeriodDates(period: string, startDateStr?: string, endDateStr?: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (period) {
    case "current_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "quarter":
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      startDate = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = endDateStr ? new Date(endDateStr) : now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { startDate, endDate };
}

// ============================================
// ROUTES
// ============================================

// Get SST rate presets
app.get("/rate-presets", (c) => {
  return c.json(SST_RATE_PRESETS);
});

// Get business categories
app.get("/business-categories", (c) => {
  return c.json(SST_BUSINESS_CATEGORIES);
});

// Get SST summary statistics
app.get("/summary", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const queryParams = c.req.query();
  const parseResult = summaryInputSchema.safeParse(queryParams);

  if (!parseResult.success) {
    return c.json({
      error: "Invalid parameters",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const { period, startDate: startDateStr, endDate: endDateStr } = parseResult.data;
  const { startDate, endDate } = getPeriodDates(period, startDateStr, endDateStr);

  // Get SST transactions for the period
  const { data: transactions, error } = await db
    .from("sst_transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("document_date", startDate.toISOString())
    .lte("document_date", endDate.toISOString());

  if (error) {
    console.error("Error fetching SST transactions:", error);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  // Calculate totals
  let totalSalesTax = 0;
  let totalServiceTax = 0;
  let totalTaxableAmount = 0;

  (transactions || []).forEach((t) => {
    const taxAmount = Number(t.tax_amount || 0);
    const taxableAmount = Number(t.taxable_amount || 0);

    if (t.tax_type === "sales_tax") {
      totalSalesTax += taxAmount;
    } else {
      totalServiceTax += taxAmount;
    }
    totalTaxableAmount += taxableAmount;
  });

  // Get previous period for comparison
  const periodDuration = endDate.getTime() - startDate.getTime();
  const prevStartDate = new Date(startDate.getTime() - periodDuration);
  const prevEndDate = new Date(startDate.getTime() - 1);

  const { data: prevTransactions } = await db
    .from("sst_transactions")
    .select("tax_amount")
    .eq("user_id", user.id)
    .gte("document_date", prevStartDate.toISOString())
    .lte("document_date", prevEndDate.toISOString());

  let prevTotalTax = 0;
  (prevTransactions || []).forEach((t) => {
    prevTotalTax += Number(t.tax_amount || 0);
  });

  const totalTax = totalSalesTax + totalServiceTax;
  const percentChange = prevTotalTax > 0
    ? ((totalTax - prevTotalTax) / prevTotalTax) * 100
    : 0;

  return c.json({
    totalSalesTax: Math.round(totalSalesTax * 100) / 100,
    totalServiceTax: Math.round(totalServiceTax * 100) / 100,
    totalOutputTax: Math.round(totalTax * 100) / 100,
    totalTaxableAmount: Math.round(totalTaxableAmount * 100) / 100,
    transactionCount: transactions?.length || 0,
    periodStart: startDate,
    periodEnd: endDate,
    comparison: {
      previousTotal: Math.round(prevTotalTax * 100) / 100,
      percentChange: Math.round(percentChange * 10) / 10,
      trend: percentChange > 0 ? "up" : percentChange < 0 ? "down" : "flat",
    },
  });
});

// Get SST trend chart data
app.get("/trend-chart", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const queryParams = c.req.query();
  const parseResult = trendChartInputSchema.safeParse(queryParams);

  if (!parseResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }

  const { period } = parseResult.data;
  const now = new Date();
  const months = period === "6m" ? 6 : 12;
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const { data: transactions, error } = await db
    .from("sst_transactions")
    .select("document_date, tax_type, tax_amount")
    .eq("user_id", user.id)
    .gte("document_date", startDate.toISOString())
    .order("document_date", { ascending: true });

  if (error) {
    console.error("Error fetching trend data:", error);
    return c.json({ error: "Failed to fetch trend data" }, 500);
  }

  // Group by month
  const monthlyData = new Map<string, { salesTax: number; serviceTax: number }>();

  (transactions || []).forEach((t) => {
    const date = new Date(t.document_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyData.get(key) || { salesTax: 0, serviceTax: 0 };

    if (t.tax_type === "sales_tax") {
      existing.salesTax += Number(t.tax_amount || 0);
    } else {
      existing.serviceTax += Number(t.tax_amount || 0);
    }

    monthlyData.set(key, existing);
  });

  // Generate all months
  const data: { month: string; salesTax: number; serviceTax: number; total: number }[] = [];
  const current = new Date(startDate);

  while (current <= now) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    const values = monthlyData.get(key) || { salesTax: 0, serviceTax: 0 };

    data.push({
      month: key,
      salesTax: Math.round(values.salesTax * 100) / 100,
      serviceTax: Math.round(values.serviceTax * 100) / 100,
      total: Math.round((values.salesTax + values.serviceTax) * 100) / 100,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return c.json(data);
});

// Get SST transactions list
app.get("/transactions", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const queryParams = c.req.query();
  const parseResult = transactionQuerySchema.safeParse(queryParams);

  if (!parseResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }

  const { page, pageSize, taxType, documentType, startDate, endDate } = parseResult.data;
  const offset = (page - 1) * pageSize;

  let query = db
    .from("sst_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("document_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (taxType !== "all") {
    query = query.eq("tax_type", taxType);
  }
  if (documentType !== "all") {
    query = query.eq("document_type", documentType);
  }
  if (startDate) {
    query = query.gte("document_date", startDate);
  }
  if (endDate) {
    query = query.lte("document_date", endDate);
  }

  const { data: transactions, error, count } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  return c.json({
    transactions: (transactions || []).map((t) => ({
      id: t.id,
      documentType: t.document_type,
      documentId: t.document_id,
      documentNumber: t.document_number,
      documentDate: t.document_date,
      customerName: t.customer_name,
      customerTin: t.customer_tin,
      taxType: t.tax_type,
      taxRate: Number(t.tax_rate),
      taxableAmount: Number(t.taxable_amount),
      taxAmount: Number(t.tax_amount),
      description: t.description,
      taxPeriod: t.tax_period,
    })),
    pagination: {
      page,
      pageSize,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  });
});

// Generate SST-02 return data
app.get("/sst02-return/:taxPeriod", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const taxPeriod = c.req.param("taxPeriod");

  // Validate tax period format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(taxPeriod)) {
    return c.json({ error: "Invalid tax period format. Use YYYY-MM" }, 400);
  }

  // Get user's SST registration info
  const { data: settings } = await db
    .from("einvoice_settings")
    .select("sst_registration, tin, brn")
    .eq("user_id", user.id)
    .single();

  // Parse period
  const [year, month] = taxPeriod.split("-").map(Number);
  const periodStart = new Date(year!, month! - 1, 1);
  const periodEnd = new Date(year!, month!, 0, 23, 59, 59);

  // Get transactions for the period
  const { data: transactions, error } = await db
    .from("sst_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("tax_period", taxPeriod)
    .order("document_date", { ascending: true });

  if (error) {
    console.error("Error fetching SST-02 data:", error);
    return c.json({ error: "Failed to generate return" }, 500);
  }

  // Group by tax type and rate
  const salesTaxByRate = new Map<number, { taxableAmount: number; taxAmount: number; count: number }>();
  const serviceTaxByRate = new Map<number, { taxableAmount: number; taxAmount: number; count: number }>();

  (transactions || []).forEach((t) => {
    const rate = Number(t.tax_rate);
    const map = t.tax_type === "sales_tax" ? salesTaxByRate : serviceTaxByRate;
    const existing = map.get(rate) || { taxableAmount: 0, taxAmount: 0, count: 0 };

    existing.taxableAmount += Number(t.taxable_amount || 0);
    existing.taxAmount += Number(t.tax_amount || 0);
    existing.count++;

    map.set(rate, existing);
  });

  // Calculate totals
  let totalSalesTaxable = 0;
  let totalSalesTax = 0;
  let totalServiceTaxable = 0;
  let totalServiceTax = 0;

  salesTaxByRate.forEach((v) => {
    totalSalesTaxable += v.taxableAmount;
    totalSalesTax += v.taxAmount;
  });

  serviceTaxByRate.forEach((v) => {
    totalServiceTaxable += v.taxableAmount;
    totalServiceTax += v.taxAmount;
  });

  return c.json({
    partA: {
      sstRegistrationNumber: settings?.sst_registration || "",
      tin: settings?.tin || "",
      brn: settings?.brn || "",
      taxPeriod,
      periodStart,
      periodEnd,
    },
    partB: {
      byRate: Array.from(salesTaxByRate.entries()).map(([rate, data]) => ({
        rate,
        taxableAmount: Math.round(data.taxableAmount * 100) / 100,
        taxAmount: Math.round(data.taxAmount * 100) / 100,
        transactionCount: data.count,
      })),
      totalTaxableAmount: Math.round(totalSalesTaxable * 100) / 100,
      totalTaxAmount: Math.round(totalSalesTax * 100) / 100,
    },
    partC: {
      byRate: Array.from(serviceTaxByRate.entries()).map(([rate, data]) => ({
        rate,
        taxableAmount: Math.round(data.taxableAmount * 100) / 100,
        taxAmount: Math.round(data.taxAmount * 100) / 100,
        transactionCount: data.count,
      })),
      totalTaxableAmount: Math.round(totalServiceTaxable * 100) / 100,
      totalTaxAmount: Math.round(totalServiceTax * 100) / 100,
    },
    partD: {
      totalSalesTax: Math.round(totalSalesTax * 100) / 100,
      totalServiceTax: Math.round(totalServiceTax * 100) / 100,
      totalTaxPayable: Math.round((totalSalesTax + totalServiceTax) * 100) / 100,
    },
    transactions: (transactions || []).map((t) => ({
      documentType: t.document_type,
      documentNumber: t.document_number,
      documentDate: t.document_date,
      customerName: t.customer_name,
      customerTin: t.customer_tin,
      taxType: t.tax_type,
      taxRate: Number(t.tax_rate),
      taxableAmount: Number(t.taxable_amount),
      taxAmount: Number(t.tax_amount),
    })),
  });
});

// Get available tax periods
app.get("/available-periods", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: periods, error } = await db
    .from("sst_transactions")
    .select("tax_period")
    .eq("user_id", user.id)
    .order("tax_period", { ascending: false });

  if (error) {
    console.error("Error fetching periods:", error);
    return c.json({ error: "Failed to fetch periods" }, 500);
  }

  // Get unique periods
  const uniquePeriods = [...new Set((periods || []).map((p) => p.tax_period))];

  // Add current month if not present
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!uniquePeriods.includes(currentPeriod)) {
    uniquePeriods.unshift(currentPeriod);
  }

  return c.json(uniquePeriods);
});

// Save SST return submission record
app.post("/return-submission", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = saveReturnSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;

  // Parse period
  const [year, month] = input.taxPeriodCode.split("-").map(Number);
  const periodStart = new Date(year!, month! - 1, 1);
  const periodEnd = new Date(year!, month!, 0, 23, 59, 59);

  // Get totals for the period
  const { data: transactions } = await db
    .from("sst_transactions")
    .select("tax_type, taxable_amount, tax_amount")
    .eq("user_id", user.id)
    .eq("tax_period", input.taxPeriodCode);

  let totalSalesTax = 0;
  let totalServiceTax = 0;
  let totalTaxableAmount = 0;

  (transactions || []).forEach((t) => {
    if (t.tax_type === "sales_tax") {
      totalSalesTax += Number(t.tax_amount || 0);
    } else {
      totalServiceTax += Number(t.tax_amount || 0);
    }
    totalTaxableAmount += Number(t.taxable_amount || 0);
  });

  // Check if submission exists
  const { data: existing } = await db
    .from("sst_return_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("tax_period_code", input.taxPeriodCode)
    .single();

  const submissionData = {
    user_id: user.id,
    tax_period_code: input.taxPeriodCode,
    tax_period_start: periodStart.toISOString(),
    tax_period_end: periodEnd.toISOString(),
    status: input.status,
    reference_number: input.referenceNumber,
    notes: input.notes,
    submitted_at: input.status === "submitted" ? new Date().toISOString() : null,
    total_sales_tax: String(totalSalesTax),
    total_service_tax: String(totalServiceTax),
    total_taxable_amount: String(totalTaxableAmount),
    transaction_count: String(transactions?.length || 0),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await db
      .from("sst_return_submissions")
      .update(submissionData)
      .eq("id", existing.id);

    return c.json({ id: existing.id, action: "updated" });
  } else {
    const { data: inserted, error } = await db
      .from("sst_return_submissions")
      .insert(submissionData)
      .select("id")
      .single();

    if (error) {
      console.error("Error saving submission:", error);
      return c.json({ error: "Failed to save submission" }, 500);
    }

    return c.json({ id: inserted?.id, action: "created" }, 201);
  }
});

// Get return submissions
app.get("/return-submissions", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: submissions, error } = await db
    .from("sst_return_submissions")
    .select("*")
    .eq("user_id", user.id)
    .order("tax_period_code", { ascending: false });

  if (error) {
    console.error("Error fetching submissions:", error);
    return c.json({ error: "Failed to fetch submissions" }, 500);
  }

  return c.json((submissions || []).map((s) => {
    const salesTax = Number(s.total_sales_tax || 0);
    const serviceTax = Number(s.total_service_tax || 0);
    return {
      id: s.id,
      taxPeriodCode: s.tax_period_code,
      periodStart: s.tax_period_start,
      periodEnd: s.tax_period_end,
      status: s.status,
      referenceNumber: s.reference_number,
      totalSalesTax: salesTax,
      totalServiceTax: serviceTax,
      totalTaxPayable: salesTax + serviceTax,
      transactionCount: Number(s.transaction_count),
      submittedAt: s.submitted_at,
      notes: s.notes,
    };
  }));
});

// Get SST compliance status
app.get("/compliance-status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  // Get user's SST settings
  const { data: settings } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Calculate annual revenue from invoices (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const { data: invoices } = await db
    .from("invoices")
    .select(`
      id,
      created_at,
      invoice_fields(items)
    `)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("created_at", twelveMonthsAgo.toISOString());

  // Calculate total revenue
  let calculatedRevenue = 0;
  (invoices || []).forEach((invoice) => {
    const items = invoice.invoice_fields?.items || [];
    items.forEach((item: { unitPrice: string; quantity: number }) => {
      calculatedRevenue += Number(item.unitPrice) * item.quantity;
    });
  });

  // Get threshold based on business category
  const businessCategory = settings?.sst_business_category || "other_services";
  const categoryInfo = SST_BUSINESS_CATEGORIES.find((c) => c.value === businessCategory)
    || SST_BUSINESS_CATEGORIES.find((c) => c.value === "other_services")!;
  const threshold = categoryInfo.threshold;

  // Determine which revenue to use
  const useManualRevenue = settings?.sst_use_manual_revenue || false;
  const manualRevenue = Number(settings?.sst_manual_revenue || 0);
  const currentRevenue = useManualRevenue ? manualRevenue : calculatedRevenue;

  // Calculate progress percentage
  const progressPercent = Math.min(
    Math.round((currentRevenue / threshold) * 100),
    150
  );

  // Determine status
  let status: "below" | "voluntary" | "approaching" | "exceeded" | "registered";
  if (settings?.sst_registration_number) {
    status = "registered";
  } else if (progressPercent >= 100) {
    status = "exceeded";
  } else if (progressPercent >= 80) {
    status = "approaching";
  } else if (progressPercent >= 50) {
    status = "voluntary";
  } else {
    status = "below";
  }

  // Get monthly breakdown
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  const currentDate = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

    let monthRevenueValue = 0;
    (invoices || []).forEach((invoice) => {
      const invoiceDate = new Date(invoice.created_at);
      if (
        invoiceDate.getFullYear() === monthDate.getFullYear() &&
        invoiceDate.getMonth() === monthDate.getMonth()
      ) {
        const items = invoice.invoice_fields?.items || [];
        items.forEach((item: { unitPrice: string; quantity: number }) => {
          monthRevenueValue += Number(item.unitPrice) * item.quantity;
        });
      }
    });

    monthlyRevenue.push({ month: monthKey, revenue: Math.round(monthRevenueValue * 100) / 100 });
  }

  return c.json({
    businessCategory,
    businessCategoryLabel: categoryInfo.label,
    threshold,
    calculatedRevenue: Math.round(calculatedRevenue * 100) / 100,
    manualRevenue,
    useManualRevenue,
    currentRevenue: Math.round(currentRevenue * 100) / 100,
    progressPercent,
    status,
    isRegistered: !!settings?.sst_registration_number,
    registrationNumber: settings?.sst_registration_number || null,
    registrationDate: settings?.sst_registration_date || null,
    monthlyRevenue,
  });
});

// Update SST compliance settings
app.patch("/compliance-settings", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = complianceSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.businessCategory !== undefined) {
    updateData.sst_business_category = input.businessCategory;
  }
  if (input.manualRevenue !== undefined) {
    updateData.sst_manual_revenue = String(input.manualRevenue);
  }
  if (input.useManualRevenue !== undefined) {
    updateData.sst_use_manual_revenue = input.useManualRevenue;
  }
  if (input.registrationNumber !== undefined) {
    updateData.sst_registration_number = input.registrationNumber;
  }
  if (input.registrationDate !== undefined) {
    updateData.sst_registration_date = input.registrationDate;
  }

  if (existing) {
    await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id);
  } else {
    await db.from("user_settings").insert({
      user_id: user.id,
      ...updateData,
    });
  }

  return c.json({ success: true });
});

export default app;
