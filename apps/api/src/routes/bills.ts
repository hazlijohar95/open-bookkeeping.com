/**
 * Bill REST Routes
 * Provides REST API endpoints for bill (vendor invoice) CRUD operations
 * Uses billBusiness service for all operations (includes webhooks, journal entries)
 */

import { Hono } from "hono";
import { z } from "zod";
import { billBusiness } from "../services/business";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Zod schemas for bill operations
const billItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.string(),
  unitPrice: z.string(),
});

const billStatusSchema = z.enum([
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

const createBillSchema = z.object({
  vendorId: z.string().uuid().nullable().optional(),
  billNumber: z.string().min(1),
  description: z.string().nullable().optional(),
  currency: z.string().default("MYR"),
  billDate: z.string().transform((s) => new Date(s)),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .nullable()
    .optional(),
  status: billStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  items: z.array(billItemSchema).optional(),
  taxRate: z.string().nullable().optional(),
});

const updateBillSchema = z.object({
  vendorId: z.string().uuid().nullable().optional(),
  billNumber: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  currency: z.string().optional(),
  billDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .nullable()
    .optional(),
  status: billStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  items: z.array(billItemSchema).optional(),
});

// Extended query schema for bills with filters
const billQuerySchema = paginationQuerySchema.extend({
  vendorId: z.string().uuid().optional(),
  status: billStatusSchema.optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
});

export const billRoutes = new Hono();

// GET / - List all bills with pagination and filters
billRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const parsed = billQuerySchema.parse(query);
    const { limit, offset, vendorId, status, startDate, endDate } = parsed;

    const bills = await billBusiness.list(
      { userId: user.id },
      { limit, offset, vendorId, status, startDate, endDate }
    );
    return c.json(bills);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching bills:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch bills"
    );
  }
});

// GET /:id - Get single bill
billRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid bill ID format");
  }

  try {
    const bill = await billBusiness.getById({ userId: user.id }, id);
    if (!bill) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bill not found");
    }
    return c.json(bill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch bill"
    );
  }
});

// POST / - Create new bill
billRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createBillSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const bill = await billBusiness.create(
      {
        userId: user.id,
        allowedSavingData: user.allowedSavingData,
      },
      {
        vendorId: input.vendorId,
        billNumber: input.billNumber,
        description: input.description,
        currency: input.currency,
        billDate: input.billDate,
        dueDate: input.dueDate,
        status: input.status,
        notes: input.notes,
        attachmentUrl: input.attachmentUrl,
        items: input.items,
        taxRate: input.taxRate,
      }
    );

    return c.json(bill, HTTP_STATUS.CREATED);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "You have disabled data saving"
    ) {
      return errorResponse(c, HTTP_STATUS.FORBIDDEN, error.message);
    }
    console.error("Error creating bill:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to create bill"
    );
  }
});

// PATCH /:id - Update bill
billRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid bill ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateBillSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const bill = await billBusiness.update(
      {
        userId: user.id,
        allowedSavingData: user.allowedSavingData,
      },
      id,
      {
        vendorId: input.vendorId,
        billNumber: input.billNumber,
        description: input.description,
        currency: input.currency,
        billDate: input.billDate,
        dueDate: input.dueDate,
        status: input.status,
        notes: input.notes,
        attachmentUrl: input.attachmentUrl,
        items: input.items,
      }
    );

    if (!bill) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bill not found");
    }
    return c.json(bill);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "You have disabled data saving"
    ) {
      return errorResponse(c, HTTP_STATUS.FORBIDDEN, error.message);
    }
    console.error("Error updating bill:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to update bill"
    );
  }
});

// PATCH /:id/status - Update bill status
billRoutes.patch("/:id/status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid bill ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = z
      .object({
        status: billStatusSchema,
        paidAt: z
          .string()
          .transform((s) => new Date(s))
          .optional(),
      })
      .safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const bill = await billBusiness.updateStatus(
      { userId: user.id },
      id,
      parseResult.data.status,
      parseResult.data.paidAt
    );

    if (!bill) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bill not found");
    }
    return c.json(bill);
  } catch (error) {
    console.error("Error updating bill status:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to update bill status"
    );
  }
});

// DELETE /:id - Delete bill (soft delete)
billRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid bill ID format");
  }

  try {
    const deleted = await billBusiness.delete({ userId: user.id }, id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bill not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting bill:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to delete bill"
    );
  }
});
