import { eq, and, isNull, desc, asc, ilike, or, sql, lte } from "drizzle-orm";
import { db } from "../index";
import {
  fixedAssets,
  fixedAssetCategories,
  fixedAssetDepreciations,
  fixedAssetDisposals,
  type DepreciationMethod,
  type FixedAssetStatus,
  type AcquisitionMethod,
  type DisposalMethod,
} from "../schema";
import Decimal from "decimal.js";

// ============================================================================
// Types
// ============================================================================

export interface CreateFixedAssetCategoryInput {
  userId: string;
  code: string;
  name: string;
  description?: string;
  defaultUsefulLifeMonths?: number;
  defaultDepreciationMethod?: DepreciationMethod;
  defaultAssetAccountId?: string;
  defaultDepreciationExpenseAccountId?: string;
  defaultAccumulatedDepreciationAccountId?: string;
}

export interface UpdateFixedAssetCategoryInput {
  code?: string;
  name?: string;
  description?: string | null;
  defaultUsefulLifeMonths?: number | null;
  defaultDepreciationMethod?: DepreciationMethod | null;
  defaultAssetAccountId?: string | null;
  defaultDepreciationExpenseAccountId?: string | null;
  defaultAccumulatedDepreciationAccountId?: string | null;
}

export interface CreateFixedAssetInput {
  userId: string;
  name: string;
  description?: string;
  categoryId?: string;
  acquisitionDate: string; // ISO date
  acquisitionCost: string; // decimal string
  acquisitionMethod?: AcquisitionMethod;
  vendorId?: string;
  invoiceReference?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths: number;
  salvageValue?: string;
  depreciationStartDate: string; // ISO date
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  location?: string;
  serialNumber?: string;
  warrantyExpiry?: string;
  metadata?: Record<string, string>;
}

export interface UpdateFixedAssetInput {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  acquisitionDate?: string;
  acquisitionCost?: string;
  acquisitionMethod?: AcquisitionMethod;
  vendorId?: string | null;
  invoiceReference?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number;
  salvageValue?: string;
  depreciationStartDate?: string;
  assetAccountId?: string;
  depreciationExpenseAccountId?: string;
  accumulatedDepreciationAccountId?: string;
  location?: string;
  serialNumber?: string;
  warrantyExpiry?: string | null;
  metadata?: Record<string, string>;
}

export interface FixedAssetQueryOptions {
  limit?: number;
  offset?: number;
  status?: FixedAssetStatus;
  categoryId?: string;
  search?: string;
}

export interface DepreciationCalculation {
  year: number;
  periodStart: string;
  periodEnd: string;
  depreciationAmount: string;
  accumulatedDepreciation: string;
  netBookValue: string;
}

export interface CreateDisposalInput {
  fixedAssetId: string;
  disposalDate: string;
  disposalMethod: DisposalMethod;
  proceeds?: string;
  buyerInfo?: {
    name?: string;
    contact?: string;
    reference?: string;
  };
  notes?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate next asset code: FA-YYYY-NNNNN
 */
async function generateAssetCode(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;

  // Find the highest existing code for this year
  const latest = await db.query.fixedAssets.findFirst({
    where: and(
      eq(fixedAssets.userId, userId),
      ilike(fixedAssets.assetCode, `${prefix}%`)
    ),
    orderBy: [desc(fixedAssets.assetCode)],
    columns: { assetCode: true },
  });

  let nextNumber = 1;
  if (latest?.assetCode) {
    const match = latest.assetCode.match(/FA-\d{4}-(\d+)/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
}

/**
 * Calculate annual depreciation based on method
 */
function calculateAnnualDepreciation(
  cost: Decimal,
  salvageValue: Decimal,
  accumulatedDepreciation: Decimal,
  usefulLifeMonths: number,
  method: DepreciationMethod,
  isPartialYear: boolean = false,
  monthsInYear: number = 12
): Decimal {
  const netBookValue = cost.minus(accumulatedDepreciation);
  const depreciableAmount = cost.minus(salvageValue);
  const usefulLifeYears = usefulLifeMonths / 12;

  // Don't depreciate below salvage value
  if (netBookValue.lte(salvageValue)) {
    return new Decimal(0);
  }

  let annualAmount: Decimal;

  switch (method) {
    case "straight_line":
      // Equal amount each year
      annualAmount = depreciableAmount.div(usefulLifeYears);
      break;

    case "declining_balance":
      // NBV × (1/Life)
      const dbRate = new Decimal(1).div(usefulLifeYears);
      annualAmount = netBookValue.mul(dbRate);
      break;

    case "double_declining":
      // NBV × (2/Life)
      const ddRate = new Decimal(2).div(usefulLifeYears);
      annualAmount = netBookValue.mul(ddRate);
      break;

    default:
      annualAmount = depreciableAmount.div(usefulLifeYears);
  }

  // Pro-rate for partial year
  if (isPartialYear && monthsInYear < 12) {
    annualAmount = annualAmount.mul(monthsInYear).div(12);
  }

  // Cap at remaining depreciable amount
  const maxDepreciation = netBookValue.minus(salvageValue);
  return Decimal.min(annualAmount, maxDepreciation).toDecimalPlaces(2);
}

/**
 * Generate depreciation schedule for an asset
 */
function generateDepreciationSchedule(
  cost: string,
  salvageValue: string,
  usefulLifeMonths: number,
  depreciationMethod: DepreciationMethod,
  depreciationStartDate: string
): DepreciationCalculation[] {
  const schedule: DepreciationCalculation[] = [];
  const costDecimal = new Decimal(cost);
  const salvageDecimal = new Decimal(salvageValue);
  const startDate = new Date(depreciationStartDate);
  const usefulLifeYears = Math.ceil(usefulLifeMonths / 12);

  let accumulatedDep = new Decimal(0);

  for (let yearIndex = 0; yearIndex < usefulLifeYears; yearIndex++) {
    const year = startDate.getFullYear() + yearIndex;

    // Calculate period start and end
    let periodStart: Date;
    let periodEnd: Date;
    let monthsInYear: number;

    if (yearIndex === 0) {
      // First year: start from depreciation start date
      periodStart = new Date(startDate);
      periodEnd = new Date(year, 11, 31); // Dec 31
      monthsInYear = 12 - startDate.getMonth();
    } else {
      // Subsequent years: full year
      periodStart = new Date(year, 0, 1); // Jan 1
      periodEnd = new Date(year, 11, 31); // Dec 31
      monthsInYear = 12;
    }

    const isPartialYear = monthsInYear < 12;

    const depAmount = calculateAnnualDepreciation(
      costDecimal,
      salvageDecimal,
      accumulatedDep,
      usefulLifeMonths,
      depreciationMethod,
      isPartialYear,
      monthsInYear
    );

    if (depAmount.lte(0)) {
      break; // Stop when fully depreciated
    }

    accumulatedDep = accumulatedDep.plus(depAmount);
    const netBookValue = costDecimal.minus(accumulatedDep);

    schedule.push({
      year,
      periodStart: periodStart.toISOString().split("T")[0] ?? "",
      periodEnd: periodEnd.toISOString().split("T")[0] ?? "",
      depreciationAmount: depAmount.toString(),
      accumulatedDepreciation: accumulatedDep.toString(),
      netBookValue: netBookValue.toString(),
    });
  }

  return schedule;
}

// ============================================================================
// Category Repository
// ============================================================================

export const fixedAssetCategoryRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.fixedAssetCategories.findFirst({
      where: and(
        eq(fixedAssetCategories.id, id),
        eq(fixedAssetCategories.userId, userId),
        isNull(fixedAssetCategories.deletedAt)
      ),
      with: {
        defaultAssetAccount: true,
        defaultDepreciationExpenseAccount: true,
        defaultAccumulatedDepreciationAccount: true,
      },
    });
  },

  findMany: async (userId: string, limit = 50, offset = 0) => {
    return db.query.fixedAssetCategories.findMany({
      where: and(
        eq(fixedAssetCategories.userId, userId),
        isNull(fixedAssetCategories.deletedAt)
      ),
      with: {
        defaultAssetAccount: true,
        defaultDepreciationExpenseAccount: true,
        defaultAccumulatedDepreciationAccount: true,
      },
      limit,
      offset,
      orderBy: [asc(fixedAssetCategories.code)],
    });
  },

  create: async (input: CreateFixedAssetCategoryInput) => {
    const [category] = await db
      .insert(fixedAssetCategories)
      .values({
        userId: input.userId,
        code: input.code,
        name: input.name,
        description: input.description,
        defaultUsefulLifeMonths: input.defaultUsefulLifeMonths,
        defaultDepreciationMethod: input.defaultDepreciationMethod,
        defaultAssetAccountId: input.defaultAssetAccountId,
        defaultDepreciationExpenseAccountId: input.defaultDepreciationExpenseAccountId,
        defaultAccumulatedDepreciationAccountId: input.defaultAccumulatedDepreciationAccountId,
      })
      .returning();

    return category;
  },

  update: async (id: string, userId: string, input: UpdateFixedAssetCategoryInput) => {
    const [updated] = await db
      .update(fixedAssetCategories)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fixedAssetCategories.id, id),
          eq(fixedAssetCategories.userId, userId),
          isNull(fixedAssetCategories.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  delete: async (id: string, userId: string) => {
    const [deleted] = await db
      .update(fixedAssetCategories)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(fixedAssetCategories.id, id),
          eq(fixedAssetCategories.userId, userId),
          isNull(fixedAssetCategories.deletedAt)
        )
      )
      .returning();

    return !!deleted;
  },
};

// ============================================================================
// Fixed Asset Repository
// ============================================================================

export const fixedAssetRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.fixedAssets.findFirst({
      where: and(
        eq(fixedAssets.id, id),
        eq(fixedAssets.userId, userId),
        isNull(fixedAssets.deletedAt)
      ),
      with: {
        category: true,
        vendor: true,
        assetAccount: true,
        depreciationExpenseAccount: true,
        accumulatedDepreciationAccount: true,
        depreciations: {
          orderBy: [asc(fixedAssetDepreciations.year)],
        },
        disposals: true,
      },
    });
  },

  findMany: async (userId: string, options?: FixedAssetQueryOptions) => {
    const { limit = 50, offset = 0, status, categoryId, search } = options ?? {};

    const conditions = [
      eq(fixedAssets.userId, userId),
      isNull(fixedAssets.deletedAt),
    ];

    if (status) {
      conditions.push(eq(fixedAssets.status, status));
    }

    if (categoryId) {
      conditions.push(eq(fixedAssets.categoryId, categoryId));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(fixedAssets.name, searchPattern),
          ilike(fixedAssets.assetCode, searchPattern),
          ilike(fixedAssets.serialNumber, searchPattern)
        )!
      );
    }

    return db.query.fixedAssets.findMany({
      where: and(...conditions),
      with: {
        category: true,
        assetAccount: true,
      },
      limit,
      offset,
      orderBy: [desc(fixedAssets.createdAt)],
    });
  },

  count: async (userId: string, options?: FixedAssetQueryOptions) => {
    const { status, categoryId } = options ?? {};

    const conditions = [
      eq(fixedAssets.userId, userId),
      isNull(fixedAssets.deletedAt),
    ];

    if (status) {
      conditions.push(eq(fixedAssets.status, status));
    }

    if (categoryId) {
      conditions.push(eq(fixedAssets.categoryId, categoryId));
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(fixedAssets)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  },

  create: async (input: CreateFixedAssetInput) => {
    const assetCode = await generateAssetCode(input.userId);
    const acquisitionCost = new Decimal(input.acquisitionCost);
    const salvageValue = new Decimal(input.salvageValue ?? "0");

    const [asset] = await db
      .insert(fixedAssets)
      .values({
        userId: input.userId,
        assetCode,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        acquisitionDate: input.acquisitionDate,
        acquisitionCost: input.acquisitionCost,
        acquisitionMethod: input.acquisitionMethod ?? "purchase",
        vendorId: input.vendorId,
        invoiceReference: input.invoiceReference,
        depreciationMethod: input.depreciationMethod ?? "straight_line",
        usefulLifeMonths: input.usefulLifeMonths,
        salvageValue: salvageValue.toString(),
        depreciationStartDate: input.depreciationStartDate,
        accumulatedDepreciation: "0",
        netBookValue: acquisitionCost.toString(),
        assetAccountId: input.assetAccountId,
        depreciationExpenseAccountId: input.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: input.accumulatedDepreciationAccountId,
        status: "draft",
        location: input.location,
        serialNumber: input.serialNumber,
        warrantyExpiry: input.warrantyExpiry,
        metadata: input.metadata,
      })
      .returning();

    return asset;
  },

  update: async (id: string, userId: string, input: UpdateFixedAssetInput) => {
    const existing = await db.query.fixedAssets.findFirst({
      where: and(
        eq(fixedAssets.id, id),
        eq(fixedAssets.userId, userId),
        isNull(fixedAssets.deletedAt)
      ),
    });

    if (!existing) {
      return null;
    }

    // If cost changes, recalculate NBV
    let netBookValue = existing.netBookValue;
    if (input.acquisitionCost) {
      const newCost = new Decimal(input.acquisitionCost);
      const accDep = new Decimal(existing.accumulatedDepreciation);
      netBookValue = newCost.minus(accDep).toString();
    }

    const [updated] = await db
      .update(fixedAssets)
      .set({
        ...input,
        netBookValue,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fixedAssets.id, id),
          eq(fixedAssets.userId, userId),
          isNull(fixedAssets.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  delete: async (id: string, userId: string) => {
    // Only allow deletion of draft assets
    const existing = await db.query.fixedAssets.findFirst({
      where: and(
        eq(fixedAssets.id, id),
        eq(fixedAssets.userId, userId),
        eq(fixedAssets.status, "draft"),
        isNull(fixedAssets.deletedAt)
      ),
    });

    if (!existing) {
      return false;
    }

    await db
      .update(fixedAssets)
      .set({ deletedAt: new Date() })
      .where(eq(fixedAssets.id, id));

    return true;
  },

  /**
   * Activate an asset (change status from draft to active)
   */
  activate: async (id: string, userId: string) => {
    const [updated] = await db
      .update(fixedAssets)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fixedAssets.id, id),
          eq(fixedAssets.userId, userId),
          eq(fixedAssets.status, "draft"),
          isNull(fixedAssets.deletedAt)
        )
      )
      .returning();

    return updated;
  },

  /**
   * Generate depreciation schedule preview (without saving)
   */
  previewDepreciationSchedule: (
    cost: string,
    salvageValue: string,
    usefulLifeMonths: number,
    depreciationMethod: DepreciationMethod,
    depreciationStartDate: string
  ): DepreciationCalculation[] => {
    return generateDepreciationSchedule(
      cost,
      salvageValue,
      usefulLifeMonths,
      depreciationMethod,
      depreciationStartDate
    );
  },

  /**
   * Create depreciation schedule records for an asset
   */
  createDepreciationSchedule: async (assetId: string, userId: string) => {
    const asset = await db.query.fixedAssets.findFirst({
      where: and(
        eq(fixedAssets.id, assetId),
        eq(fixedAssets.userId, userId),
        isNull(fixedAssets.deletedAt)
      ),
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    const schedule = generateDepreciationSchedule(
      asset.acquisitionCost,
      asset.salvageValue,
      asset.usefulLifeMonths,
      asset.depreciationMethod,
      asset.depreciationStartDate
    );

    if (schedule.length === 0) {
      return [];
    }

    const records = await db
      .insert(fixedAssetDepreciations)
      .values(
        schedule.map((s) => ({
          fixedAssetId: assetId,
          year: s.year,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          depreciationAmount: s.depreciationAmount,
          accumulatedDepreciation: s.accumulatedDepreciation,
          netBookValue: s.netBookValue,
          status: "scheduled" as const,
        }))
      )
      .returning();

    return records;
  },

  /**
   * Get depreciation schedule for an asset
   */
  getDepreciationSchedule: async (assetId: string) => {
    return db.query.fixedAssetDepreciations.findMany({
      where: eq(fixedAssetDepreciations.fixedAssetId, assetId),
      orderBy: [asc(fixedAssetDepreciations.year)],
    });
  },

  /**
   * Post depreciation (mark as posted and link to journal entry)
   */
  postDepreciation: async (
    depreciationId: string,
    journalEntryId: string
  ) => {
    return db.transaction(async (tx) => {
      // Update depreciation record
      const [depreciation] = await tx
        .update(fixedAssetDepreciations)
        .set({
          status: "posted",
          journalEntryId,
          postedAt: new Date(),
        })
        .where(eq(fixedAssetDepreciations.id, depreciationId))
        .returning();

      if (!depreciation) {
        throw new Error("Depreciation record not found");
      }

      // Update asset's accumulated depreciation and NBV
      const asset = await tx.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, depreciation.fixedAssetId),
      });

      if (asset) {
        const newAccumulatedDep = depreciation.accumulatedDepreciation;
        const newNBV = depreciation.netBookValue;
        const salvage = new Decimal(asset.salvageValue);
        const nbv = new Decimal(newNBV);

        // Check if fully depreciated
        const newStatus: FixedAssetStatus = nbv.lte(salvage)
          ? "fully_depreciated"
          : asset.status;

        await tx
          .update(fixedAssets)
          .set({
            accumulatedDepreciation: newAccumulatedDep,
            netBookValue: newNBV,
            lastDepreciationDate: depreciation.periodEnd,
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(fixedAssets.id, depreciation.fixedAssetId));
      }

      return depreciation;
    });
  },

  /**
   * Skip a depreciation period
   */
  skipDepreciation: async (depreciationId: string, notes?: string) => {
    const [updated] = await db
      .update(fixedAssetDepreciations)
      .set({
        status: "skipped",
        notes,
      })
      .where(eq(fixedAssetDepreciations.id, depreciationId))
      .returning();

    return updated;
  },

  /**
   * Get pending depreciations (scheduled but not posted)
   */
  getPendingDepreciations: async (userId: string, beforeDate?: string) => {
    const conditions = [
      eq(fixedAssetDepreciations.status, "scheduled"),
    ];

    if (beforeDate) {
      conditions.push(lte(fixedAssetDepreciations.periodEnd, beforeDate));
    }

    const depreciations = await db.query.fixedAssetDepreciations.findMany({
      where: and(...conditions),
      with: {
        fixedAsset: {
          with: {
            depreciationExpenseAccount: true,
            accumulatedDepreciationAccount: true,
          },
        },
      },
      orderBy: [asc(fixedAssetDepreciations.year)],
    });

    // Filter by user
    return depreciations.filter((d) => d.fixedAsset?.userId === userId);
  },

  /**
   * Create disposal record and update asset status
   */
  dispose: async (input: CreateDisposalInput) => {
    return db.transaction(async (tx) => {
      const asset = await tx.query.fixedAssets.findFirst({
        where: eq(fixedAssets.id, input.fixedAssetId),
      });

      if (!asset) {
        throw new Error("Asset not found");
      }

      if (asset.status === "disposed") {
        throw new Error("Asset already disposed");
      }

      const proceeds = new Decimal(input.proceeds ?? "0");
      const nbv = new Decimal(asset.netBookValue);
      const gainLoss = proceeds.minus(nbv);

      // Create disposal record
      const [disposal] = await tx
        .insert(fixedAssetDisposals)
        .values({
          fixedAssetId: input.fixedAssetId,
          disposalDate: input.disposalDate,
          disposalMethod: input.disposalMethod,
          proceeds: proceeds.toString(),
          netBookValueAtDisposal: nbv.toString(),
          gainLoss: gainLoss.toString(),
          buyerInfo: input.buyerInfo,
          notes: input.notes,
        })
        .returning();

      // Update asset status
      await tx
        .update(fixedAssets)
        .set({
          status: "disposed",
          updatedAt: new Date(),
        })
        .where(eq(fixedAssets.id, input.fixedAssetId));

      return disposal;
    });
  },

  /**
   * Link disposal to journal entry
   */
  linkDisposalToJournalEntry: async (
    disposalId: string,
    journalEntryId: string
  ) => {
    const [updated] = await db
      .update(fixedAssetDisposals)
      .set({ journalEntryId })
      .where(eq(fixedAssetDisposals.id, disposalId))
      .returning();

    return updated;
  },

  /**
   * Get disposal record
   */
  getDisposal: async (disposalId: string) => {
    return db.query.fixedAssetDisposals.findFirst({
      where: eq(fixedAssetDisposals.id, disposalId),
      with: {
        fixedAsset: true,
        journalEntry: true,
      },
    });
  },

  /**
   * Get summary statistics for fixed assets
   */
  getSummary: async (userId: string) => {
    const assets = await db.query.fixedAssets.findMany({
      where: and(
        eq(fixedAssets.userId, userId),
        isNull(fixedAssets.deletedAt)
      ),
      columns: {
        status: true,
        acquisitionCost: true,
        netBookValue: true,
        accumulatedDepreciation: true,
      },
    });

    const summary = {
      totalAssets: assets.length,
      totalCost: new Decimal(0),
      totalNetBookValue: new Decimal(0),
      totalAccumulatedDepreciation: new Decimal(0),
      byStatus: {
        draft: 0,
        active: 0,
        fully_depreciated: 0,
        disposed: 0,
      },
    };

    for (const asset of assets) {
      summary.totalCost = summary.totalCost.plus(asset.acquisitionCost);
      summary.totalNetBookValue = summary.totalNetBookValue.plus(asset.netBookValue);
      summary.totalAccumulatedDepreciation = summary.totalAccumulatedDepreciation.plus(
        asset.accumulatedDepreciation
      );
      summary.byStatus[asset.status]++;
    }

    return {
      totalAssets: summary.totalAssets,
      totalCost: summary.totalCost.toString(),
      totalNetBookValue: summary.totalNetBookValue.toString(),
      totalAccumulatedDepreciation: summary.totalAccumulatedDepreciation.toString(),
      byStatus: summary.byStatus,
    };
  },
};

// Export types
export type FixedAssetCategoryRepository = typeof fixedAssetCategoryRepository;
export type FixedAssetRepository = typeof fixedAssetRepository;
