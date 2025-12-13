import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  sstTransactions,
  sstReturnSubmissions,
  ledgerTransactions,
  accounts,
} from "../schema";

// ============= Types =============

export interface SstTransactionSummary {
  documentType: string;
  documentNumber: string | null;
  documentDate: Date;
  customerName: string | null;
  customerTin: string | null;
  taxType: "sales_tax" | "service_tax";
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
  description: string | null;
}

export interface Sst02LineItem {
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
  transactionCount: number;
}

export interface Sst02ReturnData {
  period: {
    code: string; // YYYY-MM
    startDate: string;
    endDate: string;
  };
  outputTax: {
    salesTax: {
      items: Sst02LineItem[];
      totalTaxableAmount: string;
      totalTaxAmount: string;
    };
    serviceTax: {
      items: Sst02LineItem[];
      totalTaxableAmount: string;
      totalTaxAmount: string;
    };
    totalOutputTax: string;
  };
  inputTax: {
    // SST paid on purchases (account 1400 - SST Refundable)
    totalInputTax: string;
    items: Array<{
      description: string;
      amount: string;
    }>;
  };
  netTaxPayable: string; // Output - Input (positive = payable, negative = refundable)
  transactionCount: number;
  summary: {
    totalTaxableAmount: string;
    totalOutputTax: string;
    totalInputTax: string;
    netPayable: string;
  };
}

export interface SstReturnSubmission {
  id: string;
  taxPeriodCode: string;
  taxPeriodStart: Date;
  taxPeriodEnd: Date;
  totalSalesTax: string;
  totalServiceTax: string;
  totalTaxableAmount: string;
  transactionCount: string;
  status: string;
  submittedAt: Date | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: Date;
}

// ============= Repository =============

export const sstReportRepository = {
  /**
   * Get SST transactions for a period
   */
  getTransactionsForPeriod: async (
    userId: string,
    periodCode: string // YYYY-MM format
  ): Promise<SstTransactionSummary[]> => {
    const transactions = await db.query.sstTransactions.findMany({
      where: and(
        eq(sstTransactions.userId, userId),
        eq(sstTransactions.taxPeriod, periodCode)
      ),
      orderBy: [desc(sstTransactions.documentDate)],
    });

    return transactions.map((t) => ({
      documentType: t.documentType,
      documentNumber: t.documentNumber,
      documentDate: t.documentDate,
      customerName: t.customerName,
      customerTin: t.customerTin,
      taxType: t.taxType,
      taxRate: t.taxRate,
      taxableAmount: t.taxableAmount,
      taxAmount: t.taxAmount,
      description: t.description,
    }));
  },

  /**
   * Generate SST-02 return data for a period
   */
  generateSst02Return: async (
    userId: string,
    periodCode: string // YYYY-MM format
  ): Promise<Sst02ReturnData> => {
    // Parse period
    const [year, month] = periodCode.split("-").map(Number);
    if (!year || !month) {
      throw new Error("Invalid period code format. Expected YYYY-MM");
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const startDateStr = startDate.toISOString().split("T")[0]!;
    const endDateStr = endDate.toISOString().split("T")[0]!;

    // Get aggregated output tax by tax type and rate
    const outputTaxData = await db
      .select({
        taxType: sstTransactions.taxType,
        taxRate: sstTransactions.taxRate,
        totalTaxableAmount: sql<string>`COALESCE(SUM(${sstTransactions.taxableAmount}), 0)`,
        totalTaxAmount: sql<string>`COALESCE(SUM(${sstTransactions.taxAmount}), 0)`,
        transactionCount: sql<number>`COUNT(*)::int`,
      })
      .from(sstTransactions)
      .where(
        and(
          eq(sstTransactions.userId, userId),
          eq(sstTransactions.taxPeriod, periodCode)
        )
      )
      .groupBy(sstTransactions.taxType, sstTransactions.taxRate);

    // Separate sales tax and service tax
    const salesTaxItems: Sst02LineItem[] = [];
    const serviceTaxItems: Sst02LineItem[] = [];
    let totalSalesTaxable = new Decimal(0);
    let totalSalesTax = new Decimal(0);
    let totalServiceTaxable = new Decimal(0);
    let totalServiceTax = new Decimal(0);
    let transactionCount = 0;

    for (const row of outputTaxData) {
      const item: Sst02LineItem = {
        taxRate: row.taxRate,
        taxableAmount: row.totalTaxableAmount,
        taxAmount: row.totalTaxAmount,
        transactionCount: row.transactionCount,
      };

      transactionCount += row.transactionCount;

      if (row.taxType === "sales_tax") {
        salesTaxItems.push(item);
        totalSalesTaxable = totalSalesTaxable.plus(row.totalTaxableAmount);
        totalSalesTax = totalSalesTax.plus(row.totalTaxAmount);
      } else {
        serviceTaxItems.push(item);
        totalServiceTaxable = totalServiceTaxable.plus(row.totalTaxableAmount);
        totalServiceTax = totalServiceTax.plus(row.totalTaxAmount);
      }
    }

    const totalOutputTax = totalSalesTax.plus(totalServiceTax);

    // Get input tax from SST Refundable account (1400)
    // This is SST paid on purchases that can be claimed
    const inputTaxAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.code, "1400") // SST Refundable
      ),
    });

    let totalInputTax = new Decimal(0);
    const inputTaxItems: Array<{ description: string; amount: string }> = [];

    if (inputTaxAccount) {
      // Get all debits to SST Refundable in the period (input tax claimed)
      const inputTaxTransactions = await db
        .select({
          description: ledgerTransactions.description,
          amount: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0) - COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
        })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.userId, userId),
            eq(ledgerTransactions.accountId, inputTaxAccount.id),
            gte(ledgerTransactions.transactionDate, startDateStr),
            lte(ledgerTransactions.transactionDate, endDateStr)
          )
        )
        .groupBy(ledgerTransactions.description);

      for (const tx of inputTaxTransactions) {
        const amount = new Decimal(tx.amount);
        if (amount.greaterThan(0)) {
          totalInputTax = totalInputTax.plus(amount);
          inputTaxItems.push({
            description: tx.description || "Input Tax",
            amount: amount.toFixed(2),
          });
        }
      }
    }

    // Calculate net payable
    const netTaxPayable = totalOutputTax.minus(totalInputTax);

    return {
      period: {
        code: periodCode,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      outputTax: {
        salesTax: {
          items: salesTaxItems,
          totalTaxableAmount: totalSalesTaxable.toFixed(2),
          totalTaxAmount: totalSalesTax.toFixed(2),
        },
        serviceTax: {
          items: serviceTaxItems,
          totalTaxableAmount: totalServiceTaxable.toFixed(2),
          totalTaxAmount: totalServiceTax.toFixed(2),
        },
        totalOutputTax: totalOutputTax.toFixed(2),
      },
      inputTax: {
        totalInputTax: totalInputTax.toFixed(2),
        items: inputTaxItems,
      },
      netTaxPayable: netTaxPayable.toFixed(2),
      transactionCount,
      summary: {
        totalTaxableAmount: totalSalesTaxable.plus(totalServiceTaxable).toFixed(2),
        totalOutputTax: totalOutputTax.toFixed(2),
        totalInputTax: totalInputTax.toFixed(2),
        netPayable: netTaxPayable.toFixed(2),
      },
    };
  },

  /**
   * Save a draft SST-02 return
   */
  saveDraftReturn: async (
    userId: string,
    periodCode: string,
    data: Sst02ReturnData,
    notes?: string
  ): Promise<SstReturnSubmission> => {
    // Check if a submission already exists for this period
    const existing = await db.query.sstReturnSubmissions.findFirst({
      where: and(
        eq(sstReturnSubmissions.userId, userId),
        eq(sstReturnSubmissions.taxPeriodCode, periodCode)
      ),
    });

    if (existing) {
      // Update existing draft
      if (existing.status !== "draft") {
        throw new Error("Cannot update a submitted return. Create an amendment instead.");
      }

      const [updated] = await db
        .update(sstReturnSubmissions)
        .set({
          totalSalesTax: data.outputTax.salesTax.totalTaxAmount,
          totalServiceTax: data.outputTax.serviceTax.totalTaxAmount,
          totalTaxableAmount: data.summary.totalTaxableAmount,
          transactionCount: data.transactionCount.toString(),
          notes: notes ?? existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(sstReturnSubmissions.id, existing.id))
        .returning();

      return updated!;
    }

    // Create new draft
    const [year, month] = periodCode.split("-").map(Number);
    const taxPeriodStart = new Date(year!, month! - 1, 1);
    const taxPeriodEnd = new Date(year!, month!, 0);

    const [submission] = await db
      .insert(sstReturnSubmissions)
      .values({
        userId,
        taxPeriodCode: periodCode,
        taxPeriodStart,
        taxPeriodEnd,
        totalSalesTax: data.outputTax.salesTax.totalTaxAmount,
        totalServiceTax: data.outputTax.serviceTax.totalTaxAmount,
        totalTaxableAmount: data.summary.totalTaxableAmount,
        transactionCount: data.transactionCount.toString(),
        status: "draft",
        notes,
      })
      .returning();

    return submission!;
  },

  /**
   * Mark a return as submitted
   */
  submitReturn: async (
    userId: string,
    submissionId: string,
    referenceNumber: string
  ): Promise<SstReturnSubmission> => {
    const [updated] = await db
      .update(sstReturnSubmissions)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        referenceNumber,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sstReturnSubmissions.id, submissionId),
          eq(sstReturnSubmissions.userId, userId),
          eq(sstReturnSubmissions.status, "draft")
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Submission not found or already submitted");
    }

    return updated;
  },

  /**
   * Get submission history
   */
  getSubmissions: async (
    userId: string,
    limit = 12
  ): Promise<SstReturnSubmission[]> => {
    return db.query.sstReturnSubmissions.findMany({
      where: eq(sstReturnSubmissions.userId, userId),
      orderBy: [desc(sstReturnSubmissions.taxPeriodCode)],
      limit,
    });
  },

  /**
   * Get a specific submission
   */
  getSubmission: async (
    userId: string,
    submissionId: string
  ): Promise<SstReturnSubmission | undefined> => {
    return db.query.sstReturnSubmissions.findFirst({
      where: and(
        eq(sstReturnSubmissions.id, submissionId),
        eq(sstReturnSubmissions.userId, userId)
      ),
    });
  },

  /**
   * Get SST summary by month for dashboard/charts
   */
  getMonthlySummary: async (
    userId: string,
    months = 12
  ): Promise<
    Array<{
      period: string;
      salesTax: string;
      serviceTax: string;
      totalTax: string;
      transactionCount: number;
    }>
  > => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const results = await db
      .select({
        period: sstTransactions.taxPeriod,
        taxType: sstTransactions.taxType,
        totalTax: sql<string>`COALESCE(SUM(${sstTransactions.taxAmount}), 0)`,
        transactionCount: sql<number>`COUNT(*)::int`,
      })
      .from(sstTransactions)
      .where(
        and(
          eq(sstTransactions.userId, userId),
          gte(
            sstTransactions.documentDate,
            new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          )
        )
      )
      .groupBy(sstTransactions.taxPeriod, sstTransactions.taxType)
      .orderBy(sstTransactions.taxPeriod);

    // Aggregate by period
    const periodMap = new Map<
      string,
      { salesTax: Decimal; serviceTax: Decimal; count: number }
    >();

    for (const row of results) {
      const existing = periodMap.get(row.period) || {
        salesTax: new Decimal(0),
        serviceTax: new Decimal(0),
        count: 0,
      };

      if (row.taxType === "sales_tax") {
        existing.salesTax = existing.salesTax.plus(row.totalTax);
      } else {
        existing.serviceTax = existing.serviceTax.plus(row.totalTax);
      }
      existing.count += row.transactionCount;

      periodMap.set(row.period, existing);
    }

    return Array.from(periodMap.entries()).map(([period, data]) => ({
      period,
      salesTax: data.salesTax.toFixed(2),
      serviceTax: data.serviceTax.toFixed(2),
      totalTax: data.salesTax.plus(data.serviceTax).toFixed(2),
      transactionCount: data.count,
    }));
  },
};

export type SstReportRepository = typeof sstReportRepository;
