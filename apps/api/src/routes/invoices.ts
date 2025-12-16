/**
 * Invoice REST Routes (V2)
 * Provides REST API endpoints for invoice CRUD operations using the V2 schema
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  invoiceV2Repository,
  isValidStatusTransition,
  getValidNextStatuses,
} from "@open-bookkeeping/db";
import { metadataItemSchema } from "../schemas/common";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// V2 Status enum
const invoiceStatusV2Schema = z.enum([
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "refunded",
]);

// Zod schemas for invoice operations (V2)
const invoiceItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  unit: z.string().optional(),
  sku: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).max(100).optional(),
});

const themeSchema = z.object({
  baseColor: z.string(),
  mode: z.enum(["dark", "light"]),
  template: z
    .enum(["default", "cynco", "classic", "zen", "executive"])
    .optional(),
});

// Billing detail schema for V2 (value as string for precision)
const billingDetailV2Schema = z.object({
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.union([z.string(), z.number()]).transform((v) => String(v)),
  isSstTax: z.boolean().optional(),
  sstTaxType: z.enum(["sales_tax", "service_tax"]).optional(),
  sstRateCode: z.string().optional(),
});

// Schema that accepts frontend's nested format and transforms to V2
const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  status: invoiceStatusV2Schema.optional().default("draft"),
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
    taxId: z.string().optional(),
    metadata: z.array(metadataItemSchema).optional(),
  }),
  invoiceDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string().default("MYR"),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
    dueDate: z
      .union([z.string(), z.date()])
      .transform((v) => new Date(v))
      .nullable()
      .optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailV2Schema).optional(),
  }),
  items: z.array(invoiceItemSchema).min(1),
  metadata: z
    .object({
      notes: z.string().optional(),
      terms: z.string().optional(),
      paymentInformation: z.array(metadataItemSchema).optional(),
    })
    .optional(),
});

const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusV2Schema,
});

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string(),
  method: z.string().optional(),
  reference: z.string().optional(),
  paidAt: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  notes: z.string().optional(),
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
    const invoices = await invoiceV2Repository.findManyLight(user.id, {
      limit,
      offset,
    });
    return c.json(invoices);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching invoices:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch invoices"
    );
  }
});

// GET /light - Lightweight list for table views (alias)
invoiceRoutes.get("/light", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const invoices = await invoiceV2Repository.findManyLight(user.id, {
      limit,
      offset,
    });
    return c.json(invoices);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching invoices:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch invoices"
    );
  }
});

// GET /:id - Get single invoice with full details
invoiceRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid invoice ID format"
    );
  }

  try {
    const invoice = await invoiceV2Repository.findById(id, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }
    return c.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch invoice"
    );
  }
});

// GET /:id/status-transitions - Get valid status transitions
invoiceRoutes.get("/:id/status-transitions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid invoice ID format"
    );
  }

  try {
    const invoice = await invoiceV2Repository.findById(id, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    return c.json({
      currentStatus: invoice.status,
      validNextStatuses: getValidNextStatuses(invoice.status),
    });
  } catch (error) {
    console.error("Error fetching status transitions:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch status transitions"
    );
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

    // Transform billing details value to string
    const billingDetails = input.invoiceDetails.billingDetails?.map((bd) => ({
      ...bd,
      value: String(bd.value),
    }));

    const invoice = await invoiceV2Repository.create({
      userId: user.id,
      customerId: input.customerId,
      vendorId: input.vendorId,
      status: input.status,
      prefix: input.invoiceDetails.prefix,
      serialNumber: input.invoiceDetails.serialNumber,
      currency: input.invoiceDetails.currency,
      invoiceDate: input.invoiceDetails.date,
      dueDate: input.invoiceDetails.dueDate,
      paymentTerms: input.invoiceDetails.paymentTerms,
      theme: input.invoiceDetails.theme,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      billingDetails,
      metadata: input.metadata,
      items: input.items,
    });

    return c.json(invoice, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to create invoice"
    );
  }
});

// PATCH /:id/status - Update invoice status
invoiceRoutes.patch("/:id/status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid invoice ID format"
    );
  }

  try {
    const body = await c.req.json();
    const parseResult = updateInvoiceStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { status } = parseResult.data;

    // Get current invoice to validate transition
    const existing = await invoiceV2Repository.findById(id, user.id);
    if (!existing) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    // Validate status transition
    if (!isValidStatusTransition(existing.status, status)) {
      const validStatuses = getValidNextStatuses(existing.status);
      return errorResponse(
        c,
        HTTP_STATUS.BAD_REQUEST,
        `Invalid status transition from '${existing.status}' to '${status}'. ` +
          `Valid transitions: ${validStatuses.length > 0 ? validStatuses.join(", ") : "none (terminal state)"}`
      );
    }

    const invoice = await invoiceV2Repository.updateStatus(id, user.id, status);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    return c.json(invoice);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid status")) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
    }
    console.error("Error updating invoice status:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to update invoice status"
    );
  }
});

// POST /:id/payments - Record a payment
invoiceRoutes.post("/:id/payments", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid invoice ID format"
    );
  }

  try {
    const body = await c.req.json();
    const parseResult = recordPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    // Verify invoice exists
    const invoice = await invoiceV2Repository.findById(id, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    const payment = await invoiceV2Repository.recordPayment({
      invoiceId: id,
      ...parseResult.data,
      createdBy: user.id,
    });

    return c.json(payment, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot record")) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
    }
    console.error("Error recording payment:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to record payment"
    );
  }
});

// DELETE /:id - Delete invoice (soft delete)
invoiceRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid invoice ID format"
    );
  }

  try {
    const deleted = await invoiceV2Repository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
    }
    console.error("Error deleting invoice:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to delete invoice"
    );
  }
});

// GET /by-customer/:customerId - Get invoices by customer
invoiceRoutes.get("/by-customer/:customerId", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const customerId = c.req.param("customerId");
  if (!uuidParamSchema.safeParse(customerId).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid customer ID format"
    );
  }

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const invoices = await invoiceV2Repository.findByCustomer(
      customerId,
      user.id,
      { limit, offset }
    );
    return c.json(invoices);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching customer invoices:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch customer invoices"
    );
  }
});

// GET /unpaid/by-customer/:customerId - Get unpaid invoices by customer
invoiceRoutes.get("/unpaid/by-customer/:customerId", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const customerId = c.req.param("customerId");
  if (!uuidParamSchema.safeParse(customerId).success) {
    return errorResponse(
      c,
      HTTP_STATUS.BAD_REQUEST,
      "Invalid customer ID format"
    );
  }

  try {
    const invoices = await invoiceV2Repository.getUnpaidByCustomer(
      customerId,
      user.id
    );
    return c.json(invoices);
  } catch (error) {
    console.error("Error fetching unpaid invoices:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to fetch unpaid invoices"
    );
  }
});

// GET /next-serial/:prefix - Get next serial number for a prefix
invoiceRoutes.get("/next-serial/:prefix", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const prefix = c.req.param("prefix");

  try {
    const serialNumber = await invoiceV2Repository.getNextSerialNumber(
      user.id,
      prefix
    );
    return c.json({ serialNumber });
  } catch (error) {
    console.error("Error getting next serial number:", error);
    return errorResponse(
      c,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to get next serial number"
    );
  }
});
