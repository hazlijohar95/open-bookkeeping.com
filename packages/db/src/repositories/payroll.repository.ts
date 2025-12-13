import { eq, and, isNull, desc, sql, ne } from "drizzle-orm";
import { db } from "../index";
import {
  payrollRuns,
  paySlips,
  paySlipItems,
  type PayrollRunStatus,
  type PaySlipStatus,
  type SalaryComponentType,
} from "../schema";

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreatePayrollRunInput {
  userId: string;
  runNumber: string;
  name?: string | null;
  periodYear: number;
  periodMonth: number;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
  notes?: string | null;
}

export interface UpdatePayrollRunTotalsInput {
  totalEmployees?: number;
  totalGrossSalary?: string;
  totalDeductions?: string;
  totalNetSalary?: string;
  totalEpfEmployer?: string;
  totalEpfEmployee?: string;
  totalSocsoEmployer?: string;
  totalSocsoEmployee?: string;
  totalEisEmployer?: string;
  totalEisEmployee?: string;
  totalPcb?: string;
}

export interface CreatePaySlipInput {
  payrollRunId: string;
  employeeId: string;
  slipNumber: string;
  // Employee snapshot
  employeeCode: string;
  employeeName: string;
  department?: string | null;
  position?: string | null;
  icNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  // Salary
  baseSalary: string;
  workingDays?: number;
  daysWorked?: number;
}

export interface UpdatePaySlipCalculationsInput {
  totalEarnings: string;
  grossSalary: string;
  epfEmployee: string;
  epfEmployer: string;
  epfWage: string;
  socsoEmployee: string;
  socsoEmployer: string;
  socsoWage: string;
  eisEmployee: string;
  eisEmployer: string;
  eisWage: string;
  pcb: string;
  pcbWage: string;
  totalDeductions: string;
  netSalary: string;
  ytdGrossSalary?: string;
  ytdEpfEmployee?: string;
  ytdPcb?: string;
}

export interface CreatePaySlipItemInput {
  paySlipId: string;
  salaryComponentId?: string | null;
  componentCode: string;
  componentName: string;
  componentType: SalaryComponentType;
  amount: string;
  calculationDetails?: {
    method: string;
    baseAmount?: string;
    percentage?: string;
    hours?: number;
    days?: number;
    rate?: string;
  };
  isEpfApplicable?: boolean;
  isSocsoApplicable?: boolean;
  isEisApplicable?: boolean;
  isPcbApplicable?: boolean;
  sortOrder?: number;
}

export interface PayrollRunQueryOptions {
  limit?: number;
  offset?: number;
  status?: PayrollRunStatus;
  year?: number;
  month?: number;
}

// ============================================================================
// PAYROLL RUN REPOSITORY
// ============================================================================

export const payrollRunRepository = {
  // Find by ID
  findById: async (id: string, userId: string) => {
    return db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.id, id),
        eq(payrollRuns.userId, userId),
        isNull(payrollRuns.deletedAt)
      ),
      with: {
        paySlips: {
          with: {
            items: {
              orderBy: (items, { asc }) => [asc(items.sortOrder)],
            },
          },
        },
        journalEntry: true,
      },
    });
  },

  // Find by run number
  findByRunNumber: async (runNumber: string, userId: string) => {
    return db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.runNumber, runNumber),
        eq(payrollRuns.userId, userId),
        isNull(payrollRuns.deletedAt)
      ),
    });
  },

  // Find by period
  findByPeriod: async (userId: string, year: number, month: number) => {
    return db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.userId, userId),
        eq(payrollRuns.periodYear, year),
        eq(payrollRuns.periodMonth, month),
        isNull(payrollRuns.deletedAt)
      ),
      with: {
        paySlips: {
          with: {
            items: true,
          },
        },
      },
    });
  },

  // List payroll runs
  findMany: async (userId: string, options?: PayrollRunQueryOptions) => {
    const { limit = 50, offset = 0, status, year, month } = options ?? {};

    const conditions = [
      eq(payrollRuns.userId, userId),
      isNull(payrollRuns.deletedAt),
    ];

    if (status) {
      conditions.push(eq(payrollRuns.status, status));
    }
    if (year) {
      conditions.push(eq(payrollRuns.periodYear, year));
    }
    if (month) {
      conditions.push(eq(payrollRuns.periodMonth, month));
    }

    return db.query.payrollRuns.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [
        desc(payrollRuns.periodYear),
        desc(payrollRuns.periodMonth),
        desc(payrollRuns.createdAt),
      ],
    });
  },

  // Create payroll run
  create: async (input: CreatePayrollRunInput) => {
    const [run] = await db
      .insert(payrollRuns)
      .values({
        userId: input.userId,
        runNumber: input.runNumber,
        name: input.name ?? `${getMonthName(input.periodMonth)} ${input.periodYear} Payroll`,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        payDate: input.payDate,
        periodStartDate: input.periodStartDate,
        periodEndDate: input.periodEndDate,
        notes: input.notes ?? null,
        status: "draft",
      })
      .returning();

    return run;
  },

  // Update status
  updateStatus: async (
    id: string,
    userId: string,
    status: PayrollRunStatus,
    actionBy?: string
  ) => {
    const now = new Date();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    // Set appropriate timestamp based on status
    if (status === "calculating" || status === "pending_review") {
      updates.calculatedAt = now;
      if (actionBy) updates.calculatedBy = actionBy;
    } else if (status === "approved") {
      updates.approvedAt = now;
      if (actionBy) updates.approvedBy = actionBy;
    } else if (status === "finalized") {
      updates.finalizedAt = now;
      if (actionBy) updates.finalizedBy = actionBy;
    } else if (status === "paid") {
      updates.paidAt = now;
      if (actionBy) updates.paidBy = actionBy;
    }

    const [updated] = await db
      .update(payrollRuns)
      .set(updates)
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.userId, userId),
          isNull(payrollRuns.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  // Update totals
  updateTotals: async (id: string, userId: string, input: UpdatePayrollRunTotalsInput) => {
    const [updated] = await db
      .update(payrollRuns)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.userId, userId),
          isNull(payrollRuns.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  // Link journal entry
  linkJournalEntry: async (id: string, userId: string, journalEntryId: string) => {
    const [updated] = await db
      .update(payrollRuns)
      .set({
        journalEntryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.userId, userId),
          isNull(payrollRuns.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  // Soft delete
  delete: async (id: string, userId: string) => {
    // Only allow delete if status is draft or cancelled
    const existingRun = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.id, id),
        eq(payrollRuns.userId, userId),
        isNull(payrollRuns.deletedAt)
      ),
    });

    if (!existingRun) {
      return false;
    }

    if (!["draft", "cancelled"].includes(existingRun.status)) {
      throw new Error("Can only delete draft or cancelled payroll runs");
    }

    await db
      .update(payrollRuns)
      .set({ deletedAt: new Date() })
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.userId, userId)));

    return true;
  },

  // Generate next run number
  getNextRunNumber: async (userId: string, year: number) => {
    const latestRun = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.userId, userId),
        eq(payrollRuns.periodYear, year)
      ),
      orderBy: [desc(payrollRuns.createdAt)],
      columns: { runNumber: true },
    });

    if (!latestRun) {
      return `PR-${year}-01`;
    }

    // Extract sequence number
    const match = latestRun.runNumber.match(/PR-\d{4}-(\d+)/);
    const nextSeq = match?.[1] ? parseInt(match[1], 10) + 1 : 1;
    return `PR-${year}-${nextSeq.toString().padStart(2, "0")}`;
  },

  // Check if period exists (excluding cancelled runs - they can be replaced)
  periodExists: async (userId: string, year: number, month: number, excludeId?: string) => {
    const conditions = [
      eq(payrollRuns.userId, userId),
      eq(payrollRuns.periodYear, year),
      eq(payrollRuns.periodMonth, month),
      isNull(payrollRuns.deletedAt),
      ne(payrollRuns.status, "cancelled"), // Allow creating new run if previous was cancelled
    ];

    const run = await db.query.payrollRuns.findFirst({
      where: and(...conditions),
      columns: { id: true },
    });

    if (!run) return false;
    return excludeId ? run.id !== excludeId : true;
  },

  // Hard-delete cancelled runs for a period (to allow creating new ones)
  // Note: Hard delete is needed because unique constraint doesn't include deletedAt
  deleteCancelledForPeriod: async (userId: string, year: number, month: number) => {
    await db
      .delete(payrollRuns)
      .where(
        and(
          eq(payrollRuns.userId, userId),
          eq(payrollRuns.periodYear, year),
          eq(payrollRuns.periodMonth, month),
          eq(payrollRuns.status, "cancelled")
        )
      );
  },
};

// ============================================================================
// PAY SLIP REPOSITORY
// ============================================================================

export const paySlipRepository = {
  // Find by ID
  findById: async (id: string) => {
    return db.query.paySlips.findFirst({
      where: eq(paySlips.id, id),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
        employee: true,
        payrollRun: true,
      },
    });
  },

  // Find by slip number
  findBySlipNumber: async (slipNumber: string) => {
    return db.query.paySlips.findFirst({
      where: eq(paySlips.slipNumber, slipNumber),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
        employee: true,
        payrollRun: true,
      },
    });
  },

  // Find by payroll run
  findByPayrollRun: async (payrollRunId: string) => {
    return db.query.paySlips.findMany({
      where: eq(paySlips.payrollRunId, payrollRunId),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
        employee: true,
      },
      orderBy: [desc(paySlips.employeeCode)],
    });
  },

  // Find by employee
  findByEmployee: async (employeeId: string, limit = 12) => {
    return db.query.paySlips.findMany({
      where: eq(paySlips.employeeId, employeeId),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
        payrollRun: true,
      },
      orderBy: [desc(paySlips.createdAt)],
      limit,
    });
  },

  // Create pay slip
  create: async (input: CreatePaySlipInput) => {
    const [slip] = await db
      .insert(paySlips)
      .values({
        payrollRunId: input.payrollRunId,
        employeeId: input.employeeId,
        slipNumber: input.slipNumber,
        employeeCode: input.employeeCode,
        employeeName: input.employeeName,
        department: input.department ?? null,
        position: input.position ?? null,
        icNumber: input.icNumber ?? null,
        bankName: input.bankName ?? null,
        bankAccountNumber: input.bankAccountNumber ?? null,
        baseSalary: input.baseSalary,
        workingDays: input.workingDays ?? 0,
        daysWorked: input.daysWorked ?? 0,
        totalEarnings: "0",
        grossSalary: input.baseSalary,
        totalDeductions: "0",
        netSalary: input.baseSalary,
        status: "draft",
      })
      .returning();

    return slip;
  },

  // Update calculations
  updateCalculations: async (id: string, input: UpdatePaySlipCalculationsInput) => {
    const [updated] = await db
      .update(paySlips)
      .set({
        ...input,
        status: "calculated",
        updatedAt: new Date(),
      })
      .where(eq(paySlips.id, id))
      .returning();

    return updated;
  },

  // Update status
  updateStatus: async (id: string, status: PaySlipStatus) => {
    const [updated] = await db
      .update(paySlips)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(paySlips.id, id))
      .returning();

    return updated;
  },

  // Bulk update status
  bulkUpdateStatus: async (payrollRunId: string, status: PaySlipStatus) => {
    await db
      .update(paySlips)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(paySlips.payrollRunId, payrollRunId));

    return true;
  },

  // Delete pay slip
  delete: async (id: string) => {
    // Delete items first
    await db.delete(paySlipItems).where(eq(paySlipItems.paySlipId, id));
    // Then delete slip
    await db.delete(paySlips).where(eq(paySlips.id, id));
    return true;
  },

  // Delete all slips for a run
  deleteByPayrollRun: async (payrollRunId: string) => {
    // Get all slip IDs
    const slips = await db.query.paySlips.findMany({
      where: eq(paySlips.payrollRunId, payrollRunId),
      columns: { id: true },
    });

    const slipIds = slips.map((s) => s.id);

    if (slipIds.length > 0) {
      // Delete items first
      for (const slipId of slipIds) {
        await db.delete(paySlipItems).where(eq(paySlipItems.paySlipId, slipId));
      }
    }

    // Then delete slips
    await db.delete(paySlips).where(eq(paySlips.payrollRunId, payrollRunId));

    return true;
  },

  // Generate next slip number
  getNextSlipNumber: async (payrollRunId: string, runNumber: string) => {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(paySlips)
      .where(eq(paySlips.payrollRunId, payrollRunId));

    const nextSeq = (count[0]?.count ?? 0) + 1;
    // e.g., PS-PR-2024-01-001
    return `PS-${runNumber}-${nextSeq.toString().padStart(3, "0")}`;
  },

  // Get YTD totals for an employee
  getYTDTotals: async (employeeId: string, year: number, beforeMonth: number) => {
    const slips = await db.query.paySlips.findMany({
      where: eq(paySlips.employeeId, employeeId),
      with: {
        payrollRun: {
          columns: {
            periodYear: true,
            periodMonth: true,
            status: true,
          },
        },
      },
    });

    // Filter to same year, before current month, and finalized/paid
    const relevantSlips = slips.filter((slip) => {
      const run = slip.payrollRun;
      return (
        run &&
        run.periodYear === year &&
        run.periodMonth < beforeMonth &&
        ["finalized", "paid"].includes(run.status)
      );
    });

    // Sum up totals
    const ytdGrossSalary = relevantSlips.reduce(
      (sum, slip) => sum + parseFloat(slip.grossSalary),
      0
    );
    const ytdEpfEmployee = relevantSlips.reduce(
      (sum, slip) => sum + parseFloat(slip.epfEmployee),
      0
    );
    // SOCSO + EIS employee contributions for tax relief calculation
    const ytdSocsoEis = relevantSlips.reduce(
      (sum, slip) => sum + parseFloat(slip.socsoEmployee) + parseFloat(slip.eisEmployee),
      0
    );
    const ytdPcb = relevantSlips.reduce(
      (sum, slip) => sum + parseFloat(slip.pcb),
      0
    );

    return {
      ytdGrossSalary: ytdGrossSalary.toFixed(2),
      ytdEpfEmployee: ytdEpfEmployee.toFixed(2),
      ytdSocsoEis: ytdSocsoEis.toFixed(2),
      ytdPcb: ytdPcb.toFixed(2),
    };
  },
};

// ============================================================================
// PAY SLIP ITEM REPOSITORY
// ============================================================================

export const paySlipItemRepository = {
  // Find by ID
  findById: async (id: string) => {
    return db.query.paySlipItems.findFirst({
      where: eq(paySlipItems.id, id),
    });
  },

  // Find by pay slip
  findByPaySlip: async (paySlipId: string) => {
    return db.query.paySlipItems.findMany({
      where: eq(paySlipItems.paySlipId, paySlipId),
      orderBy: [desc(paySlipItems.sortOrder)],
    });
  },

  // Create item
  create: async (input: CreatePaySlipItemInput) => {
    const [item] = await db
      .insert(paySlipItems)
      .values({
        paySlipId: input.paySlipId,
        salaryComponentId: input.salaryComponentId ?? null,
        componentCode: input.componentCode,
        componentName: input.componentName,
        componentType: input.componentType,
        amount: input.amount,
        calculationDetails: input.calculationDetails ?? null,
        isEpfApplicable: input.isEpfApplicable ?? true,
        isSocsoApplicable: input.isSocsoApplicable ?? true,
        isEisApplicable: input.isEisApplicable ?? true,
        isPcbApplicable: input.isPcbApplicable ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    return item;
  },

  // Bulk create items
  bulkCreate: async (items: CreatePaySlipItemInput[]) => {
    if (items.length === 0) return [];

    const inserted = await db
      .insert(paySlipItems)
      .values(
        items.map((input) => ({
          paySlipId: input.paySlipId,
          salaryComponentId: input.salaryComponentId ?? null,
          componentCode: input.componentCode,
          componentName: input.componentName,
          componentType: input.componentType,
          amount: input.amount,
          calculationDetails: input.calculationDetails ?? null,
          isEpfApplicable: input.isEpfApplicable ?? true,
          isSocsoApplicable: input.isSocsoApplicable ?? true,
          isEisApplicable: input.isEisApplicable ?? true,
          isPcbApplicable: input.isPcbApplicable ?? true,
          sortOrder: input.sortOrder ?? 0,
        }))
      )
      .returning();

    return inserted;
  },

  // Delete item
  delete: async (id: string) => {
    await db.delete(paySlipItems).where(eq(paySlipItems.id, id));
    return true;
  },

  // Delete all items for a pay slip
  deleteByPaySlip: async (paySlipId: string) => {
    await db.delete(paySlipItems).where(eq(paySlipItems.paySlipId, paySlipId));
    return true;
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1] || "";
}

// Export types
export type PayrollRunRepository = typeof payrollRunRepository;
export type PaySlipRepository = typeof paySlipRepository;
export type PaySlipItemRepository = typeof paySlipItemRepository;
