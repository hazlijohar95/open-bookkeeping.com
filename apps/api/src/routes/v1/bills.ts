/**
 * Bills API v1
 * CRUD operations for bill (accounts payable) management
 */

import { Hono } from "hono";
import { z } from "zod";
import { billRepository } from "@open-bookkeeping/db";
import type { BillStatus } from "@open-bookkeeping/db";
import { getApiKeyUserId } from "../../middleware/api-key-auth";
import {
  success,
  created,
  deleted,
  list,
  notFound,
  badRequest,
  validationError,
  internalError,
  parsePagination,
  validateUuid,
  handleZodError,
} from "../../lib/api-response";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("api-v1-bills");

// Valid bill statuses: draft, pending, paid, overdue, cancelled
const billStatusEnum = z.enum(["draft", "pending", "paid", "overdue", "cancelled"]);

// Validation schemas
const billItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.string(), // String to match repository
  unitPrice: z.string(), // String to match repository
});

const createBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().max(50),
  description: z.string().max(500).optional().nullable(),
  currency: z.string().min(3).max(3).default("MYR"),
  billDate: z.string().datetime().or(z.date()),
  dueDate: z.string().datetime().or(z.date()).optional().nullable(),
  status: billStatusEnum.optional(),
  notes: z.string().max(2000).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
  items: z.array(billItemSchema).optional(),
});

const updateBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  billDate: z.string().datetime().or(z.date()).optional(),
  dueDate: z.string().datetime().or(z.date()).optional().nullable(),
  status: billStatusEnum.optional(),
  notes: z.string().max(2000).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
  items: z.array(billItemSchema).optional(),
});

const updateStatusSchema = z.object({
  status: billStatusEnum,
});

export const billsRouter = new Hono();

/**
 * GET /api/v1/bills
 * List all bills with pagination
 */
billsRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const statusParam = c.req.query("status") as BillStatus | undefined;
    const vendorId = c.req.query("vendorId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const bills = await billRepository.findMany(userId, {
      limit,
      offset,
      status: statusParam,
      vendorId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    logger.debug({ userId, count: bills.length }, "Listed bills via API");
    return list(c, bills, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list bills");
    return internalError(c);
  }
});

/**
 * GET /api/v1/bills/:id
 * Get a single bill by ID with full details
 */
billsRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "bill");
  if (validId instanceof Response) return validId;

  try {
    const bill = await billRepository.findById(id, userId);
    if (!bill) {
      return notFound(c, "Bill", id);
    }

    return success(c, bill);
  } catch (error) {
    logger.error({ error, billId: id }, "Failed to get bill");
    return internalError(c);
  }
});

/**
 * POST /api/v1/bills
 * Create a new bill
 */
billsRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createBillSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    const bill = await billRepository.create({
      userId,
      vendorId: input.vendorId,
      billNumber: input.billNumber,
      description: input.description,
      currency: input.currency,
      billDate: new Date(input.billDate),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: input.status,
      notes: input.notes,
      attachmentUrl: input.attachmentUrl,
      items: input.items,
    });

    logger.info({ userId, billId: bill?.id }, "Bill created via API");
    return created(c, bill);
  } catch (error) {
    logger.error({ error }, "Failed to create bill");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/bills/:id
 * Update an existing bill
 */
billsRouter.patch("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "bill");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateBillSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    const bill = await billRepository.update(id, userId, {
      vendorId: input.vendorId,
      billNumber: input.billNumber,
      description: input.description,
      currency: input.currency,
      billDate: input.billDate ? new Date(input.billDate) : undefined,
      dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
      status: input.status,
      notes: input.notes,
      attachmentUrl: input.attachmentUrl,
      items: input.items,
    });

    if (!bill) {
      return notFound(c, "Bill", id);
    }

    logger.info({ userId, billId: id }, "Bill updated via API");
    return success(c, bill);
  } catch (error) {
    logger.error({ error, billId: id }, "Failed to update bill");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/bills/:id/status
 * Update bill status
 */
billsRouter.patch("/:id/status", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "bill");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const result = await billRepository.updateStatus(id, userId, parseResult.data.status as BillStatus);
    if (!result) {
      return notFound(c, "Bill", id);
    }

    logger.info({ userId, billId: id, status: parseResult.data.status }, "Bill status updated via API");
    return success(c, { id, status: parseResult.data.status });
  } catch (error) {
    logger.error({ error, billId: id }, "Failed to update bill status");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/bills/:id
 * Delete a bill
 */
billsRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "bill");
  if (validId instanceof Response) return validId;

  try {
    const result = await billRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Bill", id);
    }

    logger.info({ userId, billId: id }, "Bill deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, billId: id }, "Failed to delete bill");
    return internalError(c);
  }
});

/**
 * GET /api/v1/bills/vendor/:vendorId
 * Get bills for a specific vendor
 */
billsRouter.get("/vendor/:vendorId", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const vendorId = c.req.param("vendorId");
  const validId = validateUuid(c, vendorId, "vendor");
  if (validId instanceof Response) return validId;

  try {
    const { limit, offset } = parsePagination(c);
    const bills = await billRepository.findByVendor(vendorId, userId, { limit, offset });

    return list(c, bills, { limit, offset });
  } catch (error) {
    logger.error({ error, vendorId }, "Failed to get vendor bills");
    return internalError(c);
  }
});

/**
 * GET /api/v1/bills/reports/aging
 * Get accounts payable aging report
 */
billsRouter.get("/reports/aging", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const vendorId = c.req.query("vendorId");
    const report = await billRepository.getAgingReport(userId, vendorId);

    return success(c, report);
  } catch (error) {
    logger.error({ error }, "Failed to get AP aging report");
    return internalError(c);
  }
});
