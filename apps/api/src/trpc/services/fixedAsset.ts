import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  fixedAssetRepository,
  fixedAssetCategoryRepository,
  journalEntryRepository,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("fixed-asset-service");

// ============================================================================
// Zod Schemas
// ============================================================================

const depreciationMethodSchema = z.enum([
  "straight_line",
  "declining_balance",
  "double_declining",
]);

const acquisitionMethodSchema = z.enum([
  "purchase",
  "donation",
  "transfer",
  "lease_to_own",
]);

const fixedAssetStatusSchema = z.enum([
  "draft",
  "active",
  "fully_depreciated",
  "disposed",
]);

const disposalMethodSchema = z.enum([
  "sale",
  "scrapped",
  "donation",
  "trade_in",
]);

// Category schemas
const createCategorySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultUsefulLifeMonths: z.number().int().min(1).max(600).optional(),
  defaultDepreciationMethod: depreciationMethodSchema.optional(),
  defaultAssetAccountId: z.string().uuid().optional(),
  defaultDepreciationExpenseAccountId: z.string().uuid().optional(),
  defaultAccumulatedDepreciationAccountId: z.string().uuid().optional(),
});

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  defaultUsefulLifeMonths: z.number().int().min(1).max(600).optional().nullable(),
  defaultDepreciationMethod: depreciationMethodSchema.optional().nullable(),
  defaultAssetAccountId: z.string().uuid().optional().nullable(),
  defaultDepreciationExpenseAccountId: z.string().uuid().optional().nullable(),
  defaultAccumulatedDepreciationAccountId: z.string().uuid().optional().nullable(),
});

// Asset schemas
const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionCost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  acquisitionMethod: acquisitionMethodSchema.optional(),
  vendorId: z.string().uuid().optional(),
  invoiceReference: z.string().max(100).optional(),
  depreciationMethod: depreciationMethodSchema.optional(),
  usefulLifeMonths: z.number().int().min(1).max(600),
  salvageValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  depreciationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assetAccountId: z.string().uuid(),
  depreciationExpenseAccountId: z.string().uuid(),
  accumulatedDepreciationAccountId: z.string().uuid(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  warrantyExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metadata: z.record(z.string()).optional(),
});

const updateAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  acquisitionCost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  acquisitionMethod: acquisitionMethodSchema.optional(),
  vendorId: z.string().uuid().optional().nullable(),
  invoiceReference: z.string().max(100).optional(),
  depreciationMethod: depreciationMethodSchema.optional(),
  usefulLifeMonths: z.number().int().min(1).max(600).optional(),
  salvageValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  depreciationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assetAccountId: z.string().uuid().optional(),
  depreciationExpenseAccountId: z.string().uuid().optional(),
  accumulatedDepreciationAccountId: z.string().uuid().optional(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  warrantyExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  metadata: z.record(z.string()).optional(),
});

const queryOptionsSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  status: fixedAssetStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
}).optional();

const disposeAssetSchema = z.object({
  assetId: z.string().uuid(),
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disposalMethod: disposalMethodSchema,
  proceeds: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  buyerInfo: z.object({
    name: z.string().max(200).optional(),
    contact: z.string().max(200).optional(),
    reference: z.string().max(100).optional(),
  }).optional(),
  notes: z.string().max(1000).optional(),
});

const previewDepreciationSchema = z.object({
  acquisitionCost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  salvageValue: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  usefulLifeMonths: z.number().int().min(1).max(600),
  depreciationMethod: depreciationMethodSchema,
  depreciationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ============================================================================
// Category Router
// ============================================================================

export const fixedAssetCategoryRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};
      return fixedAssetCategoryRepository.findMany(ctx.user.id, limit, offset);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const category = await fixedAssetCategoryRepository.findById(input.id, ctx.user.id);
      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }
      return category;
    }),

  create: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const category = await fixedAssetCategoryRepository.create({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, categoryId: category?.id }, "Fixed asset category created");
      return category;
    }),

  update: protectedProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await fixedAssetCategoryRepository.update(id, ctx.user.id, data);
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }
      logger.info({ userId: ctx.user.id, categoryId: id }, "Fixed asset category updated");
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await fixedAssetCategoryRepository.delete(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }
      logger.info({ userId: ctx.user.id, categoryId: input.id }, "Fixed asset category deleted");
      return { success: true };
    }),
});

// ============================================================================
// Fixed Asset Router
// ============================================================================

export const fixedAssetRouter = router({
  // List all assets with optional filters
  list: protectedProcedure
    .input(queryOptionsSchema)
    .query(async ({ ctx, input }) => {
      const options = input ?? {};
      const [assets, total] = await Promise.all([
        fixedAssetRepository.findMany(ctx.user.id, options),
        fixedAssetRepository.count(ctx.user.id, options),
      ]);
      return { assets, total };
    }),

  // Get single asset with all details
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const asset = await fixedAssetRepository.findById(input.id, ctx.user.id);
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      return asset;
    }),

  // Create new asset
  create: protectedProcedure
    .input(createAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const asset = await fixedAssetRepository.create({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, assetId: asset?.id, assetCode: asset?.assetCode }, "Fixed asset created");
      return asset;
    }),

  // Update asset (only draft or specific fields for active)
  update: protectedProcedure
    .input(updateAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if asset exists and get current status
      const existing = await fixedAssetRepository.findById(id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Restrict updates for non-draft assets
      if (existing.status !== "draft") {
        const allowedFields = ["name", "description", "location", "serialNumber", "metadata"];
        const attemptedFields = Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined);
        const restrictedFields = attemptedFields.filter(f => !allowedFields.includes(f));

        if (restrictedFields.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot update ${restrictedFields.join(", ")} on non-draft asset`,
          });
        }
      }

      const updated = await fixedAssetRepository.update(id, ctx.user.id, data);
      logger.info({ userId: ctx.user.id, assetId: id }, "Fixed asset updated");
      return updated;
    }),

  // Delete asset (draft only)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await fixedAssetRepository.delete(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Asset not found or cannot be deleted (must be in draft status)",
        });
      }
      logger.info({ userId: ctx.user.id, assetId: input.id }, "Fixed asset deleted");
      return { success: true };
    }),

  // Activate asset (draft -> active)
  activate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await fixedAssetRepository.activate(input.id, ctx.user.id);
      if (!asset) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Asset not found or is not in draft status",
        });
      }

      // Generate depreciation schedule
      await fixedAssetRepository.createDepreciationSchedule(input.id, ctx.user.id);

      logger.info({ userId: ctx.user.id, assetId: input.id }, "Fixed asset activated");
      return asset;
    }),

  // Preview depreciation schedule (without saving)
  previewDepreciation: protectedProcedure
    .input(previewDepreciationSchema)
    .query(async ({ input }) => {
      return fixedAssetRepository.previewDepreciationSchedule(
        input.acquisitionCost,
        input.salvageValue,
        input.usefulLifeMonths,
        input.depreciationMethod,
        input.depreciationStartDate
      );
    }),

  // Get depreciation schedule for an asset
  getDepreciationSchedule: protectedProcedure
    .input(z.object({ assetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify asset belongs to user
      const asset = await fixedAssetRepository.findById(input.assetId, ctx.user.id);
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      return fixedAssetRepository.getDepreciationSchedule(input.assetId);
    }),

  // Run depreciation for a specific period
  runDepreciation: protectedProcedure
    .input(z.object({ depreciationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get depreciation record with asset
      const schedule = await fixedAssetRepository.getDepreciationSchedule(input.depreciationId);
      const depreciation = schedule.find(s => s.id === input.depreciationId);

      if (!depreciation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Depreciation record not found",
        });
      }

      if (depreciation.status !== "scheduled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Depreciation already processed",
        });
      }

      // Get asset details
      const asset = await fixedAssetRepository.findById(depreciation.fixedAssetId, ctx.user.id);
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Create journal entry for depreciation
      const journalEntry = await journalEntryRepository.create({
        userId: ctx.user.id,
        entryDate: depreciation.periodEnd,
        description: `Depreciation - ${asset.name} (${asset.assetCode}) - Year ${depreciation.year}`,
        sourceType: "fixed_asset_depreciation",
        sourceId: depreciation.id,
        lines: [
          {
            accountId: asset.depreciationExpenseAccountId,
            debitAmount: depreciation.depreciationAmount,
            creditAmount: "0",
            description: `Depreciation expense - ${asset.assetCode}`,
          },
          {
            accountId: asset.accumulatedDepreciationAccountId,
            debitAmount: "0",
            creditAmount: depreciation.depreciationAmount,
            description: `Accumulated depreciation - ${asset.assetCode}`,
          },
        ],
      });

      // Post the journal entry
      await journalEntryRepository.post(journalEntry.id, ctx.user.id);

      // Link depreciation to journal entry and update asset
      await fixedAssetRepository.postDepreciation(input.depreciationId, journalEntry.id);

      logger.info({
        userId: ctx.user.id,
        assetId: asset.id,
        depreciationId: input.depreciationId,
        journalEntryId: journalEntry.id,
      }, "Depreciation posted");

      return { success: true, journalEntryId: journalEntry.id };
    }),

  // Run all pending depreciations up to a date
  runBulkDepreciation: protectedProcedure
    .input(z.object({ beforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const pending = await fixedAssetRepository.getPendingDepreciations(ctx.user.id, input.beforeDate);
      const results: { assetId: string; journalEntryId: string; year: number }[] = [];

      for (const depreciation of pending) {
        if (!depreciation.fixedAsset) continue;

        try {
          // Create journal entry
          const journalEntry = await journalEntryRepository.create({
            userId: ctx.user.id,
            entryDate: depreciation.periodEnd,
            description: `Depreciation - ${depreciation.fixedAsset.name} (${depreciation.fixedAsset.assetCode}) - Year ${depreciation.year}`,
            sourceType: "fixed_asset_depreciation",
            sourceId: depreciation.id,
            lines: [
              {
                accountId: depreciation.fixedAsset.depreciationExpenseAccountId,
                debitAmount: depreciation.depreciationAmount,
                creditAmount: "0",
              },
              {
                accountId: depreciation.fixedAsset.accumulatedDepreciationAccountId,
                debitAmount: "0",
                creditAmount: depreciation.depreciationAmount,
              },
            ],
          });

          await journalEntryRepository.post(journalEntry.id, ctx.user.id);
          await fixedAssetRepository.postDepreciation(depreciation.id, journalEntry.id);

          results.push({
            assetId: depreciation.fixedAssetId,
            journalEntryId: journalEntry.id,
            year: depreciation.year,
          });
        } catch (error) {
          logger.error({ error, depreciationId: depreciation.id }, "Failed to process depreciation");
        }
      }

      logger.info({ userId: ctx.user.id, count: results.length }, "Bulk depreciation completed");
      return { processed: results.length, results };
    }),

  // Skip a depreciation period
  skipDepreciation: protectedProcedure
    .input(z.object({
      depreciationId: z.string().uuid(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await fixedAssetRepository.skipDepreciation(input.depreciationId, input.notes);
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Depreciation record not found",
        });
      }
      logger.info({ userId: ctx.user.id, depreciationId: input.depreciationId }, "Depreciation skipped");
      return updated;
    }),

  // Dispose of an asset
  dispose: protectedProcedure
    .input(disposeAssetSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify asset belongs to user
      const asset = await fixedAssetRepository.findById(input.assetId, ctx.user.id);
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      if (asset.status === "disposed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Asset already disposed",
        });
      }

      // Create disposal record
      const disposal = await fixedAssetRepository.dispose({
        fixedAssetId: input.assetId,
        disposalDate: input.disposalDate,
        disposalMethod: input.disposalMethod,
        proceeds: input.proceeds,
        buyerInfo: input.buyerInfo,
        notes: input.notes,
      });

      if (!disposal) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create disposal record",
        });
      }

      // TODO: Create disposal journal entry
      // This requires additional accounts (gain/loss on disposal)
      // For now, we just record the disposal

      logger.info({
        userId: ctx.user.id,
        assetId: input.assetId,
        disposalId: disposal.id,
        gainLoss: disposal.gainLoss,
      }, "Asset disposed");

      return disposal;
    }),

  // Get summary statistics
  summary: protectedProcedure.query(async ({ ctx }) => {
    return fixedAssetRepository.getSummary(ctx.user.id);
  }),

  // Get pending depreciations
  getPendingDepreciations: protectedProcedure
    .input(z.object({ beforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return fixedAssetRepository.getPendingDepreciations(ctx.user.id, input?.beforeDate);
    }),

  // Category routes (nested)
  category: fixedAssetCategoryRouter,
});
