/**
 * Quotation REST Routes
 * Provides REST API endpoints for quotation CRUD operations
 */

import { Hono } from "hono";
import { z } from "zod";
import { quotationRepository } from "@open-bookkeeping/db";
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

// Zod schemas for quotation operations
const quotationItemSchema = z.object({
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

const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  validUntil: z.string().optional(),
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
  quotationDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string().default("MYR"),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.string().transform((s) => new Date(s)),
    validUntil: z.string().transform((s) => new Date(s)).nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(quotationItemSchema).min(1),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
    paymentInformation: z.array(metadataItemSchema).optional(),
  }).optional(),
});

const updateQuotationStatusSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
});

export const quotationRoutes = new Hono();

// GET / - List all quotations with pagination (lightweight)
quotationRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    // Use lightweight query for list views
    const quotations = await quotationRepository.findManyLight(user.id, { limit, offset });
    return c.json(quotations);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching quotations:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch quotations");
  }
});

// GET /full - List all quotations with full details
quotationRoutes.get("/full", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const quotations = await quotationRepository.findMany(user.id, { limit, offset });
    return c.json(quotations);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching quotations:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch quotations");
  }
});

// GET /:id - Get single quotation with full details
quotationRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid quotation ID format");
  }

  try {
    const quotation = await quotationRepository.findById(id, user.id);
    if (!quotation) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Quotation not found");
    }
    return c.json(quotation);
  } catch (error) {
    console.error("Error fetching quotation:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch quotation");
  }
});

// POST / - Create new quotation
quotationRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createQuotationSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const quotation = await quotationRepository.create({
      userId: user.id,
      customerId: input.customerId,
      validUntil: input.validUntil,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      quotationDetails: input.quotationDetails,
      items: input.items,
      metadata: input.metadata,
    });

    return c.json(quotation, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating quotation:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create quotation");
  }
});

// PATCH /:id/status - Update quotation status
quotationRoutes.patch("/:id/status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid quotation ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateQuotationStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { status } = parseResult.data;
    const quotation = await quotationRepository.updateStatus(id, user.id, status);
    if (!quotation) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Quotation not found");
    }
    return c.json(quotation);
  } catch (error) {
    console.error("Error updating quotation status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update quotation status");
  }
});

// POST /:id/convert - Convert quotation to invoice
quotationRoutes.post("/:id/convert", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid quotation ID format");
  }

  try {
    const invoice = await quotationRepository.convertToInvoice(id, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Quotation not found or already converted");
    }
    return c.json(invoice, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error converting quotation:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to convert quotation to invoice");
  }
});

// DELETE /:id - Delete quotation (soft delete)
quotationRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid quotation ID format");
  }

  try {
    const deleted = await quotationRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Quotation not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete quotation");
  }
});
