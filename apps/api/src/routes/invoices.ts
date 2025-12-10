/**
 * Invoice REST Routes
 * Provides REST API endpoints for invoice CRUD operations
 */

import { Hono } from "hono";
import { z } from "zod";
import { invoiceRepository } from "@open-bookkeeping/db";
import { authenticateRequest } from "../lib/auth-helpers";
import { metadataItemSchema, billingDetailSchema } from "../schemas/common";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Zod schemas for invoice operations
const invoiceItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const themeSchema = z.object({
  baseColor: z.string(),
  mode: z.enum(["dark", "light"]),
  template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyDetails: z.object({
    name: z.string().min(1),
    address: z.string(),
    logo: z.string().nullable().optional(),
    signature: z.string().nullable().optional(),
    metadata: z.array(metadataItemSchema).optional(),
  }),
  clientDetails: z.object({
    name: z.string().min(1),
    address: z.string(),
    metadata: z.array(metadataItemSchema).optional(),
  }),
  invoiceDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string().default("MYR"),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.string().transform((s) => new Date(s)),
    dueDate: z.string().transform((s) => new Date(s)).nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(invoiceItemSchema).min(1),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
    paymentInformation: z.array(metadataItemSchema).optional(),
  }).optional(),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(["pending", "success", "error", "expired", "refunded"]),
});

export const invoiceRoutes = new Hono();

// GET / - List all invoices with pagination (lightweight)
invoiceRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    // Use lightweight query for list views
    const invoices = await invoiceRepository.findManyLight(user.id, { limit, offset });
    return c.json(invoices);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching invoices:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch invoices");
  }
});

// GET /full - List all invoices with full details
invoiceRoutes.get("/full", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const invoices = await invoiceRepository.findMany(user.id, { limit, offset });
    return c.json(invoices);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching invoices:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch invoices");
  }
});

// GET /:id - Get single invoice with full details
invoiceRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid invoice ID format");
  }

  try {
    const invoice = await invoiceRepository.findById(id, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }
    return c.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch invoice");
  }
});

// POST / - Create new invoice
invoiceRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createInvoiceSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const invoice = await invoiceRepository.create({
      userId: user.id,
      customerId: input.customerId,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      invoiceDetails: input.invoiceDetails,
      items: input.items,
      metadata: input.metadata,
    });

    return c.json(invoice, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create invoice");
  }
});

// PATCH /:id/status - Update invoice status
invoiceRoutes.patch("/:id/status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid invoice ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateInvoiceStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { status } = parseResult.data;
    const invoice = await invoiceRepository.updateStatus(id, user.id, status);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }
    return c.json(invoice);
  } catch (error) {
    console.error("Error updating invoice status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update invoice status");
  }
});

// DELETE /:id - Delete invoice (soft delete)
invoiceRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid invoice ID format");
  }

  try {
    const deleted = await invoiceRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete invoice");
  }
});
