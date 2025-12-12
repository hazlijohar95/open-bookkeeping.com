import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db, sstTransactions, sstReturnSubmissions, einvoiceSettings, userSettings, invoices } from "@open-bookkeeping/db";
import { eq, and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import Decimal from "decimal.js";

// SST Business Categories with thresholds
export const SST_BUSINESS_CATEGORIES = [
  { value: "fnb", label: "Food & Beverage", threshold: 1500000 },
  { value: "telecom", label: "Telecommunications", threshold: 1500000 },
  { value: "parking", label: "Parking Services", threshold: 1500000 },
  { value: "other_services", label: "Other Taxable Services", threshold: 500000 },
  { value: "manufacturing", label: "Manufacturing (Sales Tax)", threshold: 500000 },
] as const;

// SST Rate presets for Malaysian Sales and Service Tax
export const SST_RATE_PRESETS = [
  { code: "ST_10", label: "Sales Tax 10%", rate: 10, taxType: "sales_tax" as const },
  { code: "ST_5", label: "Sales Tax 5%", rate: 5, taxType: "sales_tax" as const },
  { code: "ST_0", label: "Sales Tax 0%", rate: 0, taxType: "sales_tax" as const },
  { code: "SVT_6", label: "Service Tax 6%", rate: 6, taxType: "service_tax" as const },
  { code: "SVT_8", label: "Service Tax 8%", rate: 8, taxType: "service_tax" as const },
];

export const sstRouter = router({
  // Get SST rate presets
  getRatePresets: protectedProcedure.query(() => {
    return SST_RATE_PRESETS;
  }),

  // Get SST summary statistics
  getSummary: protectedProcedure
    .input(
      z.object({
        period: z.enum(["current_month", "last_month", "quarter", "year", "custom"]).default("current_month"),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (input.period) {
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
          startDate = input.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = input.endDate || now;
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get all SST transactions for the period
      const transactions = await db.query.sstTransactions.findMany({
        where: and(
          eq(sstTransactions.userId, userId),
          gte(sstTransactions.documentDate, startDate),
          lte(sstTransactions.documentDate, endDate)
        ),
      });

      // Calculate totals using Decimal.js for precision
      let totalSalesTax = new Decimal(0);
      let totalServiceTax = new Decimal(0);
      let totalTaxableAmount = new Decimal(0);

      transactions.forEach((t) => {
        const taxAmount = new Decimal(t.taxAmount ?? 0);
        const taxableAmount = new Decimal(t.taxableAmount ?? 0);

        if (t.taxType === "sales_tax") {
          totalSalesTax = totalSalesTax.plus(taxAmount);
        } else {
          totalServiceTax = totalServiceTax.plus(taxAmount);
        }
        totalTaxableAmount = totalTaxableAmount.plus(taxableAmount);
      });

      // Get previous period for comparison
      const periodDuration = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodDuration);
      const prevEndDate = new Date(startDate.getTime() - 1);

      const prevTransactions = await db.query.sstTransactions.findMany({
        where: and(
          eq(sstTransactions.userId, userId),
          gte(sstTransactions.documentDate, prevStartDate),
          lte(sstTransactions.documentDate, prevEndDate)
        ),
      });

      let prevTotalTax = new Decimal(0);
      prevTransactions.forEach((t) => {
        prevTotalTax = prevTotalTax.plus(new Decimal(t.taxAmount ?? 0));
      });

      const totalTax = totalSalesTax.plus(totalServiceTax);
      const percentChange = prevTotalTax.greaterThan(0)
        ? totalTax.minus(prevTotalTax).div(prevTotalTax).times(100)
        : new Decimal(0);

      return {
        totalSalesTax: totalSalesTax.toNumber(),
        totalServiceTax: totalServiceTax.toNumber(),
        totalOutputTax: totalTax.toNumber(),
        totalTaxableAmount: totalTaxableAmount.toNumber(),
        transactionCount: transactions.length,
        periodStart: startDate,
        periodEnd: endDate,
        comparison: {
          previousTotal: prevTotalTax.toNumber(),
          percentChange: percentChange.toDecimalPlaces(1).toNumber(),
          trend: percentChange.greaterThan(0) ? "up" : percentChange.lessThan(0) ? "down" : "flat",
        },
      };
    }),

  // Get SST trend chart data
  getTrendChart: protectedProcedure
    .input(
      z.object({
        period: z.enum(["6m", "12m"]).default("6m"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const now = new Date();
      const months = input.period === "6m" ? 6 : 12;
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

      const transactions = await db.query.sstTransactions.findMany({
        where: and(
          eq(sstTransactions.userId, userId),
          gte(sstTransactions.documentDate, startDate)
        ),
        orderBy: [sstTransactions.documentDate],
      });

      // Group by month using Decimal.js for precision
      const monthlyData = new Map<string, { salesTax: Decimal; serviceTax: Decimal }>();

      transactions.forEach((t) => {
        const date = new Date(t.documentDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyData.get(key) ?? { salesTax: new Decimal(0), serviceTax: new Decimal(0) };

        if (t.taxType === "sales_tax") {
          existing.salesTax = existing.salesTax.plus(new Decimal(t.taxAmount ?? 0));
        } else {
          existing.serviceTax = existing.serviceTax.plus(new Decimal(t.taxAmount ?? 0));
        }

        monthlyData.set(key, existing);
      });

      // Generate all months
      const data: { month: string; salesTax: number; serviceTax: number; total: number }[] = [];
      const current = new Date(startDate);

      while (current <= now) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        const values = monthlyData.get(key) ?? { salesTax: new Decimal(0), serviceTax: new Decimal(0) };

        data.push({
          month: key,
          salesTax: values.salesTax.toDecimalPlaces(2).toNumber(),
          serviceTax: values.serviceTax.toDecimalPlaces(2).toNumber(),
          total: values.salesTax.plus(values.serviceTax).toDecimalPlaces(2).toNumber(),
        });

        current.setMonth(current.getMonth() + 1);
      }

      return data;
    }),

  // Get SST transactions list with filtering
  getTransactions: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(50),
        taxType: z.enum(["all", "sales_tax", "service_tax"]).default("all"),
        documentType: z.enum(["all", "invoice", "credit_note", "debit_note"]).default("all"),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const offset = (input.page - 1) * input.pageSize;

      // Build conditions
      const conditions = [eq(sstTransactions.userId, userId)];

      if (input.taxType !== "all") {
        conditions.push(eq(sstTransactions.taxType, input.taxType));
      }

      if (input.documentType !== "all") {
        conditions.push(eq(sstTransactions.documentType, input.documentType));
      }

      if (input.startDate) {
        conditions.push(gte(sstTransactions.documentDate, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(sstTransactions.documentDate, input.endDate));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(sstTransactions)
        .where(and(...conditions));

      const totalCount = Number(countResult[0]?.count ?? 0);

      // Get transactions
      const transactions = await db.query.sstTransactions.findMany({
        where: and(...conditions),
        orderBy: [desc(sstTransactions.documentDate)],
        limit: input.pageSize,
        offset,
      });

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          documentType: t.documentType,
          documentId: t.documentId,
          documentNumber: t.documentNumber,
          documentDate: t.documentDate,
          customerName: t.customerName,
          customerTin: t.customerTin,
          taxType: t.taxType,
          taxRate: Number(t.taxRate),
          taxableAmount: Number(t.taxableAmount),
          taxAmount: Number(t.taxAmount),
          description: t.description,
          taxPeriod: t.taxPeriod,
        })),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / input.pageSize),
        },
      };
    }),

  // Generate SST-02 return data
  generateSst02Return: protectedProcedure
    .input(
      z.object({
        taxPeriod: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get user's SST registration info
      const settings = await db.query.einvoiceSettings.findFirst({
        where: eq(einvoiceSettings.userId, userId),
      });

      // Parse period
      const [year, month] = input.taxPeriod.split("-").map(Number);
      const periodStart = new Date(year!, month! - 1, 1);
      const periodEnd = new Date(year!, month!, 0, 23, 59, 59);

      // Get all transactions for the period
      const transactions = await db.query.sstTransactions.findMany({
        where: and(
          eq(sstTransactions.userId, userId),
          eq(sstTransactions.taxPeriod, input.taxPeriod)
        ),
        orderBy: [sstTransactions.documentDate],
      });

      // Group by tax type and rate using Decimal.js for precision
      const salesTaxByRate = new Map<number, { taxableAmount: Decimal; taxAmount: Decimal; count: number }>();
      const serviceTaxByRate = new Map<number, { taxableAmount: Decimal; taxAmount: Decimal; count: number }>();

      transactions.forEach((t) => {
        const rate = Number(t.taxRate);
        const map = t.taxType === "sales_tax" ? salesTaxByRate : serviceTaxByRate;
        const existing = map.get(rate) ?? { taxableAmount: new Decimal(0), taxAmount: new Decimal(0), count: 0 };

        existing.taxableAmount = existing.taxableAmount.plus(new Decimal(t.taxableAmount ?? 0));
        existing.taxAmount = existing.taxAmount.plus(new Decimal(t.taxAmount ?? 0));
        existing.count++;

        map.set(rate, existing);
      });

      // Calculate totals
      let totalSalesTaxable = new Decimal(0);
      let totalSalesTax = new Decimal(0);
      let totalServiceTaxable = new Decimal(0);
      let totalServiceTax = new Decimal(0);

      salesTaxByRate.forEach((v) => {
        totalSalesTaxable = totalSalesTaxable.plus(v.taxableAmount);
        totalSalesTax = totalSalesTax.plus(v.taxAmount);
      });

      serviceTaxByRate.forEach((v) => {
        totalServiceTaxable = totalServiceTaxable.plus(v.taxableAmount);
        totalServiceTax = totalServiceTax.plus(v.taxAmount);
      });

      return {
        // Part A: Taxable Person Details
        partA: {
          sstRegistrationNumber: settings?.sstRegistration ?? "",
          tin: settings?.tin ?? "",
          brn: settings?.brn ?? "",
          taxPeriod: input.taxPeriod,
          periodStart,
          periodEnd,
        },
        // Part B: Sales Tax
        partB: {
          byRate: Array.from(salesTaxByRate.entries()).map(([rate, data]) => ({
            rate,
            taxableAmount: data.taxableAmount.toDecimalPlaces(2).toNumber(),
            taxAmount: data.taxAmount.toDecimalPlaces(2).toNumber(),
            transactionCount: data.count,
          })),
          totalTaxableAmount: totalSalesTaxable.toDecimalPlaces(2).toNumber(),
          totalTaxAmount: totalSalesTax.toDecimalPlaces(2).toNumber(),
        },
        // Part C: Service Tax
        partC: {
          byRate: Array.from(serviceTaxByRate.entries()).map(([rate, data]) => ({
            rate,
            taxableAmount: data.taxableAmount.toDecimalPlaces(2).toNumber(),
            taxAmount: data.taxAmount.toDecimalPlaces(2).toNumber(),
            transactionCount: data.count,
          })),
          totalTaxableAmount: totalServiceTaxable.toDecimalPlaces(2).toNumber(),
          totalTaxAmount: totalServiceTax.toDecimalPlaces(2).toNumber(),
        },
        // Part D: Summary
        partD: {
          totalSalesTax: totalSalesTax.toDecimalPlaces(2).toNumber(),
          totalServiceTax: totalServiceTax.toDecimalPlaces(2).toNumber(),
          totalTaxPayable: totalSalesTax.plus(totalServiceTax).toDecimalPlaces(2).toNumber(),
        },
        // Transaction details for export
        transactions: transactions.map((t) => ({
          documentType: t.documentType,
          documentNumber: t.documentNumber,
          documentDate: t.documentDate,
          customerName: t.customerName,
          customerTin: t.customerTin,
          taxType: t.taxType,
          taxRate: Number(t.taxRate),
          taxableAmount: Number(t.taxableAmount),
          taxAmount: Number(t.taxAmount),
        })),
      };
    }),

  // Get available tax periods for dropdown
  getAvailablePeriods: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const periods = await db
      .selectDistinct({ taxPeriod: sstTransactions.taxPeriod })
      .from(sstTransactions)
      .where(eq(sstTransactions.userId, userId))
      .orderBy(desc(sstTransactions.taxPeriod));

    // Also add current and next month if not present
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existingPeriods = new Set(periods.map((p) => p.taxPeriod));

    if (!existingPeriods.has(currentPeriod)) {
      periods.unshift({ taxPeriod: currentPeriod });
    }

    return periods.map((p) => p.taxPeriod);
  }),

  // Save SST return submission record
  saveReturnSubmission: protectedProcedure
    .input(
      z.object({
        taxPeriodCode: z.string(),
        status: z.enum(["draft", "submitted", "amended"]),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Parse period
      const [year, month] = input.taxPeriodCode.split("-").map(Number);
      const periodStart = new Date(year!, month! - 1, 1);
      const periodEnd = new Date(year!, month!, 0, 23, 59, 59);

      // Get totals for the period using Decimal.js for precision
      const transactions = await db.query.sstTransactions.findMany({
        where: and(
          eq(sstTransactions.userId, userId),
          eq(sstTransactions.taxPeriod, input.taxPeriodCode)
        ),
      });

      let totalSalesTax = new Decimal(0);
      let totalServiceTax = new Decimal(0);
      let totalTaxableAmount = new Decimal(0);

      transactions.forEach((t) => {
        if (t.taxType === "sales_tax") {
          totalSalesTax = totalSalesTax.plus(new Decimal(t.taxAmount ?? 0));
        } else {
          totalServiceTax = totalServiceTax.plus(new Decimal(t.taxAmount ?? 0));
        }
        totalTaxableAmount = totalTaxableAmount.plus(new Decimal(t.taxableAmount ?? 0));
      });

      // Check if submission exists
      const existing = await db.query.sstReturnSubmissions.findFirst({
        where: and(
          eq(sstReturnSubmissions.userId, userId),
          eq(sstReturnSubmissions.taxPeriodCode, input.taxPeriodCode)
        ),
      });

      if (existing) {
        // Update
        await db
          .update(sstReturnSubmissions)
          .set({
            status: input.status,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
            submittedAt: input.status === "submitted" ? new Date() : null,
            totalSalesTax: String(totalSalesTax),
            totalServiceTax: String(totalServiceTax),
            totalTaxableAmount: String(totalTaxableAmount),
            transactionCount: String(transactions.length),
            updatedAt: new Date(),
          })
          .where(eq(sstReturnSubmissions.id, existing.id));

        return { id: existing.id, action: "updated" };
      } else {
        // Insert
        const [inserted] = await db
          .insert(sstReturnSubmissions)
          .values({
            userId,
            taxPeriodCode: input.taxPeriodCode,
            taxPeriodStart: periodStart,
            taxPeriodEnd: periodEnd,
            status: input.status,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
            submittedAt: input.status === "submitted" ? new Date() : null,
            totalSalesTax: String(totalSalesTax),
            totalServiceTax: String(totalServiceTax),
            totalTaxableAmount: String(totalTaxableAmount),
            transactionCount: String(transactions.length),
          })
          .returning({ id: sstReturnSubmissions.id });

        return { id: inserted?.id, action: "created" };
      }
    }),

  // Get return submission status
  getReturnSubmissions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const submissions = await db.query.sstReturnSubmissions.findMany({
      where: eq(sstReturnSubmissions.userId, userId),
      orderBy: [desc(sstReturnSubmissions.taxPeriodCode)],
    });

    return submissions.map((s) => {
      const salesTax = new Decimal(s.totalSalesTax ?? 0);
      const serviceTax = new Decimal(s.totalServiceTax ?? 0);
      return {
        id: s.id,
        taxPeriodCode: s.taxPeriodCode,
        periodStart: s.taxPeriodStart,
        periodEnd: s.taxPeriodEnd,
        status: s.status,
        referenceNumber: s.referenceNumber,
        totalSalesTax: salesTax.toNumber(),
        totalServiceTax: serviceTax.toNumber(),
        totalTaxPayable: salesTax.plus(serviceTax).toNumber(),
        transactionCount: Number(s.transactionCount),
        submittedAt: s.submittedAt,
        notes: s.notes,
      };
    });
  }),

  // Get business categories for SST compliance
  getBusinessCategories: protectedProcedure.query(() => {
    return SST_BUSINESS_CATEGORIES;
  }),

  // Get SST compliance status
  getComplianceStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get user's SST settings
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    // Calculate annual revenue from invoices (last 12 months rolling)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    // Get all paid invoices from the last 12 months
    const userInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt),
        gte(invoices.createdAt, twelveMonthsAgo)
      ),
      with: {
        invoiceFields: {
          with: {
            invoiceDetails: true,
            items: true,
          },
        },
      },
    });

    // Calculate total revenue from invoices (sum of all line items) using Decimal.js
    let calculatedRevenue = new Decimal(0);
    userInvoices.forEach((invoice) => {
      if (invoice.invoiceFields?.items) {
        invoice.invoiceFields.items.forEach((item) => {
          calculatedRevenue = calculatedRevenue.plus(
            new Decimal(item.unitPrice).times(item.quantity)
          );
        });
      }
    });

    // Get threshold based on business category
    const businessCategory = settings?.sstBusinessCategory ?? "other_services";
    const categoryInfo = SST_BUSINESS_CATEGORIES.find((c) => c.value === businessCategory)
      || SST_BUSINESS_CATEGORIES.find((c) => c.value === "other_services")!;
    const threshold = categoryInfo.threshold;

    // Determine which revenue to use
    const useManualRevenue = settings?.sstUseManualRevenue || false;
    const manualRevenue = new Decimal(settings?.sstManualRevenue ?? 0);
    const currentRevenue = useManualRevenue ? manualRevenue : calculatedRevenue;

    // Calculate progress percentage
    const progressPercent = Math.min(
      currentRevenue.div(threshold).times(100).round().toNumber(),
      150
    );

    // Determine status
    let status: "below" | "voluntary" | "approaching" | "exceeded" | "registered";
    if (settings?.sstRegistrationNumber) {
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

    // Get monthly breakdown for the last 12 months
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

      let monthRevenueDecimal = new Decimal(0);
      userInvoices.forEach((invoice) => {
        const invoiceDate = new Date(invoice.createdAt);
        if (
          invoiceDate.getFullYear() === monthDate.getFullYear() &&
          invoiceDate.getMonth() === monthDate.getMonth()
        ) {
          if (invoice.invoiceFields?.items) {
            invoice.invoiceFields.items.forEach((item) => {
              monthRevenueDecimal = monthRevenueDecimal.plus(
                new Decimal(item.unitPrice).times(item.quantity)
              );
            });
          }
        }
      });

      monthlyRevenue.push({ month: monthKey, revenue: monthRevenueDecimal.toDecimalPlaces(2).toNumber() });
    }

    return {
      businessCategory,
      businessCategoryLabel: categoryInfo.label,
      threshold,
      calculatedRevenue: calculatedRevenue.toDecimalPlaces(2).toNumber(),
      manualRevenue: manualRevenue.toNumber(),
      useManualRevenue,
      currentRevenue: currentRevenue.toDecimalPlaces(2).toNumber(),
      progressPercent,
      status,
      isRegistered: !!settings?.sstRegistrationNumber,
      registrationNumber: settings?.sstRegistrationNumber ?? null,
      registrationDate: settings?.sstRegistrationDate ?? null,
      monthlyRevenue,
    };
  }),

  // Update SST compliance settings
  updateComplianceSettings: protectedProcedure
    .input(
      z.object({
        businessCategory: z.string().optional(),
        manualRevenue: z.number().optional(),
        useManualRevenue: z.boolean().optional(),
        registrationNumber: z.string().optional().nullable(),
        registrationDate: z.date().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Check if settings exist
      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.businessCategory !== undefined) {
        updateData.sstBusinessCategory = input.businessCategory;
      }
      if (input.manualRevenue !== undefined) {
        updateData.sstManualRevenue = String(input.manualRevenue);
      }
      if (input.useManualRevenue !== undefined) {
        updateData.sstUseManualRevenue = input.useManualRevenue;
      }
      if (input.registrationNumber !== undefined) {
        updateData.sstRegistrationNumber = input.registrationNumber;
      }
      if (input.registrationDate !== undefined) {
        updateData.sstRegistrationDate = input.registrationDate;
      }

      if (existing) {
        await db
          .update(userSettings)
          .set(updateData)
          .where(eq(userSettings.userId, userId));
      } else {
        await db.insert(userSettings).values({
          userId,
          ...updateData,
        });
      }

      return { success: true };
    }),
});
