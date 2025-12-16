/**
 * Fixed Asset REST Routes
 * Provides REST API endpoints for fixed asset management
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  fixedAssetRepository,
  fixedAssetCategoryRepository,
  journalEntryRepository,
} from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Zod schemas
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

const updateCategorySchema = createCategorySchema.partial();

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
  salvageValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  depreciationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assetAccountId: z.string().uuid(),
  depreciationExpenseAccountId: z.string().uuid(),
  accumulatedDepreciationAccountId: z.string().uuid(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  warrantyExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const updateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const assetQuerySchema = paginationQuerySchema.extend({
  status: fixedAssetStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

const disposeAssetSchema = z.object({
  disposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disposalMethod: disposalMethodSchema,
  proceeds: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  buyerInfo: z
    .object({
      name: z.string().max(200).optional(),
      contact: z.string().max(200).optional(),
      reference: z.string().max(100).optional(),
    })
    .optional(),
  notes: z.string().max(1000).optional(),
});

const previewDepreciationSchema = z.object({
  acquisitionCost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  salvageValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("0"),
  usefulLifeMonths: z.number().int().min(1).max(600),
  depreciationMethod: depreciationMethodSchema,
  depreciationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const fixedAssetRoutes = new Hono();

// ============================================================================
// Asset Routes
// ============================================================================

// GET / - List all assets
fixedAssetRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const parsed = assetQuerySchema.parse({
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });

    const [assets, total] = await Promise.all([
      fixedAssetRepository.findMany(user.id, parsed),
      fixedAssetRepository.count(user.id, parsed),
    ]);

    return c.json({ assets, total });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching fixed assets:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch assets"
    );
  }
});

// GET /summary - Get summary statistics
fixedAssetRoutes.get("/summary", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const summary = await fixedAssetRepository.getSummary(user.id);
    return c.json(summary);
  } catch (error) {
    console.error("Error fetching asset summary:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch summary"
    );
  }
});

// GET /pending-depreciations - Get pending depreciations
fixedAssetRoutes.get("/pending-depreciations", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const beforeDate = c.req.query("beforeDate");
    const pending = await fixedAssetRepository.getPendingDepreciations(
      user.id,
      beforeDate
    );
    return c.json(pending);
  } catch (error) {
    console.error("Error fetching pending depreciations:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch pending depreciations"
    );
  }
});

// POST /preview-depreciation - Preview depreciation schedule
fixedAssetRoutes.post("/preview-depreciation", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await c.req.json();
    const parsed = previewDepreciationSchema.parse(body);

    const schedule = fixedAssetRepository.previewDepreciationSchedule(
      parsed.acquisitionCost,
      parsed.salvageValue,
      parsed.usefulLifeMonths,
      parsed.depreciationMethod,
      parsed.depreciationStartDate
    );

    return c.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error previewing depreciation:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to preview depreciation"
    );
  }
});

// ============================================================================
// Category Routes (nested under /categories)
// IMPORTANT: These must be defined BEFORE /:id routes to avoid route conflicts
// ============================================================================

// GET /categories - List all categories
fixedAssetRoutes.get("/categories", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const limit = query.limit ? Number(query.limit) : 50;
    const offset = query.offset ? Number(query.offset) : 0;

    const categories = await fixedAssetCategoryRepository.findMany(
      user.id,
      limit,
      offset
    );
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch categories"
    );
  }
});

// GET /categories/:id - Get single category
fixedAssetRoutes.get("/categories/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid category ID format"
    );
  }

  try {
    const category = await fixedAssetCategoryRepository.findById(id, user.id);
    if (!category) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Category not found");
    }
    return c.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch category"
    );
  }
});

// POST /categories - Create category
fixedAssetRoutes.post("/categories", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parsed = createCategorySchema.parse(body);

    const category = await fixedAssetCategoryRepository.create({
      userId: user.id,
      ...parsed,
    });

    return c.json(category, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error creating category:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to create category"
    );
  }
});

// PATCH /categories/:id - Update category
fixedAssetRoutes.patch("/categories/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid category ID format"
    );
  }

  try {
    const body = await c.req.json();
    const parsed = updateCategorySchema.parse(body);

    const category = await fixedAssetCategoryRepository.update(
      id,
      user.id,
      parsed
    );
    if (!category) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Category not found");
    }
    return c.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error updating category:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to update category"
    );
  }
});

// DELETE /categories/:id - Delete category
fixedAssetRoutes.delete("/categories/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid category ID format"
    );
  }

  try {
    const deleted = await fixedAssetCategoryRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Category not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to delete category"
    );
  }
});

// ============================================================================
// Asset Routes with parameters (must come AFTER static routes like /categories)
// ============================================================================

// GET /:id - Get single asset
fixedAssetRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    const asset = await fixedAssetRepository.findById(id, user.id);
    if (!asset) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Asset not found");
    }
    return c.json(asset);
  } catch (error) {
    console.error("Error fetching asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch asset"
    );
  }
});

// POST / - Create new asset
fixedAssetRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parsed = createAssetSchema.parse(body);

    const asset = await fixedAssetRepository.create({
      userId: user.id,
      ...parsed,
    });

    return c.json(asset, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error creating asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to create asset"
    );
  }
});

// PATCH /:id - Update asset
fixedAssetRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    const body = await c.req.json();
    const parsed = updateAssetSchema.parse(body);

    const asset = await fixedAssetRepository.update(id, user.id, parsed);
    if (!asset) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Asset not found");
    }
    return c.json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error updating asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to update asset"
    );
  }
});

// DELETE /:id - Delete asset (draft only)
fixedAssetRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    const deleted = await fixedAssetRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(
        c,
        HTTP_STATUS.BAD_REQUEST,
        "Asset not found or cannot be deleted"
      );
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to delete asset"
    );
  }
});

// POST /:id/activate - Activate asset
fixedAssetRoutes.post("/:id/activate", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    const asset = await fixedAssetRepository.activate(id, user.id);
    if (!asset) {
      return errorResponse(
        c,
        HTTP_STATUS.BAD_REQUEST,
        "Asset not found or not in draft status"
      );
    }

    // Generate depreciation schedule
    await fixedAssetRepository.createDepreciationSchedule(id, user.id);

    return c.json(asset);
  } catch (error) {
    console.error("Error activating asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to activate asset"
    );
  }
});

// GET /:id/depreciation-schedule - Get depreciation schedule
fixedAssetRoutes.get("/:id/depreciation-schedule", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    // Verify asset belongs to user
    const asset = await fixedAssetRepository.findById(id, user.id);
    if (!asset) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Asset not found");
    }

    const schedule = await fixedAssetRepository.getDepreciationSchedule(id);
    return c.json(schedule);
  } catch (error) {
    console.error("Error fetching depreciation schedule:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch schedule"
    );
  }
});

// POST /:id/dispose - Dispose of asset
fixedAssetRoutes.post("/:id/dispose", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid asset ID format");
  }

  try {
    // Verify asset belongs to user
    const asset = await fixedAssetRepository.findById(id, user.id);
    if (!asset) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Asset not found");
    }

    if (asset.status === "disposed") {
      return errorResponse(
        c,
        HTTP_STATUS.BAD_REQUEST,
        "Asset already disposed"
      );
    }

    const body = await c.req.json();
    const parsed = disposeAssetSchema.parse(body);

    const disposal = await fixedAssetRepository.dispose({
      fixedAssetId: id,
      ...parsed,
    });

    return c.json(disposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error disposing asset:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to dispose asset"
    );
  }
});

// POST /depreciation/:id/run - Run depreciation for a period
fixedAssetRoutes.post("/depreciation/:id/run", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const depreciationId = c.req.param("id");
  if (!uuidParamSchema.safeParse(depreciationId).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid depreciation ID format"
    );
  }

  try {
    // Get depreciation record
    const schedule =
      await fixedAssetRepository.getDepreciationSchedule(depreciationId);
    const depreciation = schedule.find((s) => s.id === depreciationId);

    if (!depreciation) {
      return errorResponse(
        c,
        HTTP_STATUS.NOT_FOUND,
        "Depreciation record not found"
      );
    }

    if (depreciation.status !== "scheduled") {
      return errorResponse(
        c,
        HTTP_STATUS.BAD_REQUEST,
        "Depreciation already processed"
      );
    }

    // Get asset details
    const asset = await fixedAssetRepository.findById(
      depreciation.fixedAssetId,
      user.id
    );
    if (!asset) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Asset not found");
    }

    // Create journal entry
    const journalEntry = await journalEntryRepository.create({
      userId: user.id,
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
    await journalEntryRepository.post(journalEntry.id, user.id);

    // Link depreciation to journal entry
    await fixedAssetRepository.postDepreciation(
      depreciationId,
      journalEntry.id
    );

    return c.json({ success: true, journalEntryId: journalEntry.id });
  } catch (error) {
    console.error("Error running depreciation:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to run depreciation"
    );
  }
});

// POST /depreciation/:id/skip - Skip a depreciation period
fixedAssetRoutes.post("/depreciation/:id/skip", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  const depreciationId = c.req.param("id");
  if (!uuidParamSchema.safeParse(depreciationId).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid depreciation ID format"
    );
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const notes = body.notes as string | undefined;

    const updated = await fixedAssetRepository.skipDepreciation(
      depreciationId,
      notes
    );
    if (!updated) {
      return errorResponse(
        c,
        HTTP_STATUS.NOT_FOUND,
        "Depreciation record not found"
      );
    }
    return c.json(updated);
  } catch (error) {
    console.error("Error skipping depreciation:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to skip depreciation"
    );
  }
});
