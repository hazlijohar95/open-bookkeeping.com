/**
 * Quotations API v1
 * CRUD operations for quotation management
 */

import { Hono } from "hono";
import { z } from "zod";
import { quotationRepository } from "@open-bookkeeping/db";
import type { QuotationStatus } from "@open-bookkeeping/db";
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

const logger = createLogger("api-v1-quotations");

// Validation schemas matching CreateQuotationInput interface
const metadataItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(500),
});

const themeSchema = z.object({
  baseColor: z.string(),
  mode: z.enum(["dark", "light"]),
  template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
});

const billingDetailSchema = z.object({
  label: z.string().max(100),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
});

const quotationItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0),
  unitPrice: z.number(),
});

const companyDetailsSchema = z.object({
  name: z.string().max(255),
  address: z.string().max(1000), // Required
  logo: z.string().url().max(1000).optional().nullable(),
  signature: z.string().url().max(1000).optional().nullable(),
  metadata: z.array(metadataItemSchema).optional(),
});

const clientDetailsSchema = z.object({
  name: z.string().max(255),
  address: z.string().max(1000), // Required
  metadata: z.array(metadataItemSchema).optional(),
});

const quotationDetailsSchema = z.object({
  theme: themeSchema.optional(),
  currency: z.string().min(3).max(3),
  prefix: z.string().max(20),
  serialNumber: z.string().max(50),
  date: z.string().datetime().or(z.date()),
  validUntil: z.string().datetime().or(z.date()).nullable().optional(),
  paymentTerms: z.string().max(100).optional(),
  billingDetails: z.array(billingDetailSchema).optional(),
});

const quotationMetadataSchema = z.object({
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  paymentInformation: z.array(metadataItemSchema).optional(),
});

const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  validUntil: z.string().optional(), // Also at root level as a string
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  quotationDetails: quotationDetailsSchema,
  items: z.array(quotationItemSchema).min(1),
  metadata: quotationMetadataSchema.optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]),
});

export const quotationsRouter = new Hono();

/**
 * GET /api/v1/quotations
 * List all quotations with pagination
 */
quotationsRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const quotations = await quotationRepository.findManyLight(userId, { limit, offset });

    logger.debug({ userId, count: quotations.length }, "Listed quotations via API");
    return list(c, quotations, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list quotations");
    return internalError(c);
  }
});

/**
 * GET /api/v1/quotations/:id
 * Get a single quotation by ID with full details
 */
quotationsRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "quotation");
  if (validId instanceof Response) return validId;

  try {
    const quotation = await quotationRepository.findById(id, userId);
    if (!quotation) {
      return notFound(c, "Quotation", id);
    }

    return success(c, quotation);
  } catch (error) {
    logger.error({ error, quotationId: id }, "Failed to get quotation");
    return internalError(c);
  }
});

/**
 * POST /api/v1/quotations
 * Create a new quotation
 */
quotationsRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createQuotationSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    const result = await quotationRepository.create({
      userId,
      customerId: input.customerId,
      validUntil: input.validUntil,
      companyDetails: {
        name: input.companyDetails.name,
        address: input.companyDetails.address,
        logo: input.companyDetails.logo,
        signature: input.companyDetails.signature,
        metadata: input.companyDetails.metadata,
      },
      clientDetails: {
        name: input.clientDetails.name,
        address: input.clientDetails.address,
        metadata: input.clientDetails.metadata,
      },
      quotationDetails: {
        theme: input.quotationDetails.theme,
        currency: input.quotationDetails.currency,
        prefix: input.quotationDetails.prefix,
        serialNumber: input.quotationDetails.serialNumber,
        date: new Date(input.quotationDetails.date),
        validUntil: input.quotationDetails.validUntil ? new Date(input.quotationDetails.validUntil) : null,
        paymentTerms: input.quotationDetails.paymentTerms,
        billingDetails: input.quotationDetails.billingDetails,
      },
      items: input.items,
      metadata: input.metadata,
    });

    logger.info({ userId, quotationId: result.quotationId }, "Quotation created via API");
    return created(c, result);
  } catch (error) {
    logger.error({ error }, "Failed to create quotation");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/quotations/:id/status
 * Update quotation status
 */
quotationsRouter.patch("/:id/status", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "quotation");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const result = await quotationRepository.updateStatus(id, userId, parseResult.data.status as QuotationStatus);
    if (!result) {
      return notFound(c, "Quotation", id);
    }

    // Check if there was an error (converted quotations can't be updated)
    if ("error" in result) {
      return badRequest(c, result.error as string);
    }

    logger.info({ userId, quotationId: id, status: parseResult.data.status }, "Quotation status updated via API");
    return success(c, { id, status: parseResult.data.status });
  } catch (error) {
    logger.error({ error, quotationId: id }, "Failed to update quotation status");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/quotations/:id
 * Delete a quotation
 */
quotationsRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "quotation");
  if (validId instanceof Response) return validId;

  try {
    const result = await quotationRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Quotation", id);
    }

    logger.info({ userId, quotationId: id }, "Quotation deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, quotationId: id }, "Failed to delete quotation");
    return internalError(c);
  }
});

/**
 * POST /api/v1/quotations/:id/convert
 * Convert quotation to invoice
 */
quotationsRouter.post("/:id/convert", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "quotation");
  if (validId instanceof Response) return validId;

  try {
    const result = await quotationRepository.convertToInvoice(id, userId);

    // Check for error response
    if ("error" in result) {
      if (result.error === "Quotation not found") {
        return notFound(c, "Quotation", id);
      }
      return badRequest(c, result.error as string);
    }

    logger.info({ userId, quotationId: id, invoiceId: result.invoiceId }, "Quotation converted to invoice via API");
    return success(c, result);
  } catch (error) {
    logger.error({ error, quotationId: id }, "Failed to convert quotation");
    return internalError(c);
  }
});
