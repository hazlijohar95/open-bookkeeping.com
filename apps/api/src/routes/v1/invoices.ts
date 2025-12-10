/**
 * Invoices API v1
 * CRUD operations for invoice management
 */

import { Hono } from "hono";
import { z } from "zod";
import { invoiceRepository } from "@open-bookkeeping/db";
import type { InvoiceStatus } from "@open-bookkeeping/db";
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

const logger = createLogger("api-v1-invoices");

// Validation schemas matching CreateInvoiceInput interface
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
  // SST fields for Malaysian Sales and Service Tax
  isSstTax: z.boolean().optional(),
  sstTaxType: z.enum(["sales_tax", "service_tax"]).optional(),
  sstRateCode: z.string().optional(),
});

const invoiceItemSchema = z.object({
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

const invoiceDetailsSchema = z.object({
  theme: themeSchema.optional(),
  currency: z.string().min(3).max(3),
  prefix: z.string().max(20),
  serialNumber: z.string().max(50),
  date: z.string().datetime().or(z.date()),
  dueDate: z.string().datetime().or(z.date()).nullable().optional(),
  paymentTerms: z.string().max(100).optional(),
  billingDetails: z.array(billingDetailSchema).optional(),
});

const invoiceMetadataSchema = z.object({
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  paymentInformation: z.array(metadataItemSchema).optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  invoiceDetails: invoiceDetailsSchema,
  items: z.array(invoiceItemSchema).min(1),
  metadata: invoiceMetadataSchema.optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "success", "error", "expired", "refunded"]),
});

export const invoicesRouter = new Hono();

/**
 * GET /api/v1/invoices
 * List all invoices with pagination
 */
invoicesRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const invoices = await invoiceRepository.findManyLight(userId, { limit, offset });

    logger.debug({ userId, count: invoices.length }, "Listed invoices via API");
    return list(c, invoices, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list invoices");
    return internalError(c);
  }
});

/**
 * GET /api/v1/invoices/:id
 * Get a single invoice by ID with full details
 */
invoicesRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "invoice");
  if (validId instanceof Response) return validId;

  try {
    const invoice = await invoiceRepository.findById(id, userId);
    if (!invoice) {
      return notFound(c, "Invoice", id);
    }

    return success(c, invoice);
  } catch (error) {
    logger.error({ error, invoiceId: id }, "Failed to get invoice");
    return internalError(c);
  }
});

/**
 * POST /api/v1/invoices
 * Create a new invoice
 */
invoicesRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createInvoiceSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    const result = await invoiceRepository.create({
      userId,
      customerId: input.customerId,
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
      invoiceDetails: {
        theme: input.invoiceDetails.theme,
        currency: input.invoiceDetails.currency,
        prefix: input.invoiceDetails.prefix,
        serialNumber: input.invoiceDetails.serialNumber,
        date: new Date(input.invoiceDetails.date),
        dueDate: input.invoiceDetails.dueDate ? new Date(input.invoiceDetails.dueDate) : null,
        paymentTerms: input.invoiceDetails.paymentTerms,
        billingDetails: input.invoiceDetails.billingDetails,
      },
      items: input.items,
      metadata: input.metadata,
    });

    logger.info({ userId, invoiceId: result.invoiceId }, "Invoice created via API");
    return created(c, result);
  } catch (error) {
    logger.error({ error }, "Failed to create invoice");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/invoices/:id/status
 * Update invoice status
 */
invoicesRouter.patch("/:id/status", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "invoice");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const result = await invoiceRepository.updateStatus(id, userId, parseResult.data.status as InvoiceStatus);
    if (!result) {
      return notFound(c, "Invoice", id);
    }

    logger.info({ userId, invoiceId: id, status: parseResult.data.status }, "Invoice status updated via API");
    return success(c, { id, status: parseResult.data.status });
  } catch (error) {
    logger.error({ error, invoiceId: id }, "Failed to update invoice status");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/invoices/:id
 * Delete an invoice
 */
invoicesRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "invoice");
  if (validId instanceof Response) return validId;

  try {
    const result = await invoiceRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Invoice", id);
    }

    logger.info({ userId, invoiceId: id }, "Invoice deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, invoiceId: id }, "Failed to delete invoice");
    return internalError(c);
  }
});

/**
 * GET /api/v1/invoices/customer/:customerId
 * Get invoices for a specific customer
 */
invoicesRouter.get("/customer/:customerId", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const customerId = c.req.param("customerId");
  const validId = validateUuid(c, customerId, "customer");
  if (validId instanceof Response) return validId;

  try {
    const { limit, offset } = parsePagination(c);
    const invoices = await invoiceRepository.findByCustomer(customerId, userId, { limit, offset });

    return list(c, invoices, { limit, offset });
  } catch (error) {
    logger.error({ error, customerId }, "Failed to get customer invoices");
    return internalError(c);
  }
});

/**
 * GET /api/v1/invoices/reports/aging
 * Get AR aging report
 */
invoicesRouter.get("/reports/aging", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const customerId = c.req.query("customerId");
    const report = await invoiceRepository.getAgingReport(userId, customerId);

    return success(c, report);
  } catch (error) {
    logger.error({ error }, "Failed to get aging report");
    return internalError(c);
  }
});
