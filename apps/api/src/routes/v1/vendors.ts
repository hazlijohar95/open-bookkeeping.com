/**
 * Vendors API v1
 * CRUD operations for vendor management
 */

import { Hono } from "hono";
import { z } from "zod";
import { vendorRepository } from "@open-bookkeeping/db";
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
  parseIntSafe,
} from "../../lib/api-response";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("api-v1-vendors");

// Validation schemas
const metadataItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(500),
});

const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  vatNumber: z.string().max(50).optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  bankName: z.string().max(255).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  bankRoutingNumber: z.string().max(50).optional().nullable(),
  bankSwiftCode: z.string().max(20).optional().nullable(),
  paymentTermsDays: z.number().min(0).max(365).optional().nullable(),
  preferredPaymentMethod: z.string().max(50).optional().nullable(),
  creditLimit: z.string().optional().nullable(), // Stored as decimal string
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateVendorSchema = createVendorSchema.partial();

export const vendorsRouter = new Hono();

/**
 * GET /api/v1/vendors
 * List all vendors with pagination
 */
vendorsRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const vendors = await vendorRepository.findMany(userId, { limit, offset });

    // Mask sensitive bank details in API response
    const maskedVendors = vendors.map((vendor) => ({
      ...vendor,
      bankAccountNumber: vendor.bankAccountNumber ? "****" + vendor.bankAccountNumber.slice(-4) : null,
      bankRoutingNumber: undefined, // Never expose routing number
    }));

    logger.debug({ userId, count: vendors.length }, "Listed vendors via API");
    return list(c, maskedVendors, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list vendors");
    return internalError(c);
  }
});

/**
 * GET /api/v1/vendors/search
 * Search vendors by name
 */
vendorsRouter.get("/search", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const query = c.req.query("q") ?? "";
    const limitParam = c.req.query("limit");
    const limit = parseIntSafe(limitParam, 10, { min: 1, max: 100 });

    const vendors = await vendorRepository.search(userId, query, limit);

    // Mask sensitive data
    const maskedVendors = vendors.map((vendor) => ({
      ...vendor,
      bankAccountNumber: vendor.bankAccountNumber ? "****" + vendor.bankAccountNumber.slice(-4) : null,
      bankRoutingNumber: undefined,
    }));

    return list(c, maskedVendors, { limit, offset: 0 });
  } catch (error) {
    logger.error({ error }, "Failed to search vendors");
    return internalError(c);
  }
});

/**
 * GET /api/v1/vendors/:id
 * Get a single vendor by ID
 */
vendorsRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "vendor");
  if (validId instanceof Response) return validId;

  try {
    const vendor = await vendorRepository.findById(id, userId);
    if (!vendor) {
      return notFound(c, "Vendor", id);
    }

    // Mask sensitive data
    const maskedVendor = {
      ...vendor,
      bankAccountNumber: vendor.bankAccountNumber ? "****" + vendor.bankAccountNumber.slice(-4) : null,
      bankRoutingNumber: undefined,
    };

    return success(c, maskedVendor);
  } catch (error) {
    logger.error({ error, vendorId: id }, "Failed to get vendor");
    return internalError(c);
  }
});

/**
 * POST /api/v1/vendors
 * Create a new vendor
 */
vendorsRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createVendorSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;
    const vendor = await vendorRepository.create({
      userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      website: input.website,
      taxId: input.taxId,
      vatNumber: input.vatNumber,
      registrationNumber: input.registrationNumber,
      bankName: input.bankName,
      bankAccountNumber: input.bankAccountNumber,
      bankRoutingNumber: input.bankRoutingNumber,
      bankSwiftCode: input.bankSwiftCode,
      paymentTermsDays: input.paymentTermsDays,
      preferredPaymentMethod: input.preferredPaymentMethod,
      creditLimit: input.creditLimit,
      metadata: input.metadata,
    });

    logger.info({ userId, vendorId: vendor?.id }, "Vendor created via API");
    return created(c, vendor);
  } catch (error) {
    logger.error({ error }, "Failed to create vendor");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/vendors/:id
 * Update an existing vendor
 */
vendorsRouter.patch("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "vendor");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateVendorSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;
    const vendor = await vendorRepository.update(id, userId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      website: input.website,
      taxId: input.taxId,
      vatNumber: input.vatNumber,
      registrationNumber: input.registrationNumber,
      bankName: input.bankName,
      bankAccountNumber: input.bankAccountNumber,
      bankRoutingNumber: input.bankRoutingNumber,
      bankSwiftCode: input.bankSwiftCode,
      paymentTermsDays: input.paymentTermsDays,
      preferredPaymentMethod: input.preferredPaymentMethod,
      creditLimit: input.creditLimit,
      metadata: input.metadata,
    });

    if (!vendor) {
      return notFound(c, "Vendor", id);
    }

    logger.info({ userId, vendorId: id }, "Vendor updated via API");
    return success(c, vendor);
  } catch (error) {
    logger.error({ error, vendorId: id }, "Failed to update vendor");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/vendors/:id
 * Delete a vendor (soft delete)
 */
vendorsRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "vendor");
  if (validId instanceof Response) return validId;

  try {
    const result = await vendorRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Vendor", id);
    }

    logger.info({ userId, vendorId: id }, "Vendor deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, vendorId: id }, "Failed to delete vendor");
    return internalError(c);
  }
});
