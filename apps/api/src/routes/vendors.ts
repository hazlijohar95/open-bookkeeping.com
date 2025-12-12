/**
 * Vendor REST Routes
 * Provides REST API endpoints for vendor CRUD operations
 */

import { Hono } from "hono";
import { z } from "zod";
import { vendorRepository } from "@open-bookkeeping/db";
import { authenticateRequest } from "../lib/auth-helpers";
import { metadataItemSchema } from "../schemas/common";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Zod schemas for vendor operations
const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
  // Bank Details
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),
  // Tax Identifiers
  taxId: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  // Payment Settings
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  preferredPaymentMethod: z.string().max(50).optional(),
  creditLimit: z.string().max(50).optional(),
  // Metadata
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateVendorSchema = createVendorSchema.partial();

export const vendorRoutes = new Hono();

// GET / - List all vendors with pagination
vendorRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const vendors = await vendorRepository.findMany(user.id, { limit, offset });
    return c.json(vendors);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching vendors:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch vendors");
  }
});

// GET /search - Search vendors
vendorRoutes.get("/search", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query("q") ?? "";
    const vendors = await vendorRepository.search(user.id, query);
    return c.json(vendors);
  } catch (error) {
    console.error("Error searching vendors:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to search vendors");
  }
});

// GET /:id - Get single vendor
vendorRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid vendor ID format");
  }

  try {
    const vendor = await vendorRepository.findById(id, user.id);
    if (!vendor) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Vendor not found");
    }
    return c.json(vendor);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch vendor");
  }
});

// POST / - Create new vendor
vendorRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createVendorSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const vendor = await vendorRepository.create({
      userId: user.id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      website: input.website ?? null,
      bankName: input.bankName ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      bankRoutingNumber: input.bankRoutingNumber ?? null,
      bankSwiftCode: input.bankSwiftCode ?? null,
      taxId: input.taxId ?? null,
      vatNumber: input.vatNumber ?? null,
      registrationNumber: input.registrationNumber ?? null,
      paymentTermsDays: input.paymentTermsDays ?? null,
      preferredPaymentMethod: input.preferredPaymentMethod ?? null,
      creditLimit: input.creditLimit ?? null,
      metadata: input.metadata,
    });

    return c.json(vendor, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating vendor:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create vendor");
  }
});

// PATCH /:id - Update vendor
vendorRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid vendor ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateVendorSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const vendor = await vendorRepository.update(id, user.id, {
      name: input.name,
      email: input.email !== undefined ? (input.email ?? null) : undefined,
      phone: input.phone !== undefined ? (input.phone ?? null) : undefined,
      address: input.address !== undefined ? (input.address ?? null) : undefined,
      website: input.website !== undefined ? (input.website ?? null) : undefined,
      bankName: input.bankName !== undefined ? (input.bankName ?? null) : undefined,
      bankAccountNumber: input.bankAccountNumber !== undefined ? (input.bankAccountNumber ?? null) : undefined,
      bankRoutingNumber: input.bankRoutingNumber !== undefined ? (input.bankRoutingNumber ?? null) : undefined,
      bankSwiftCode: input.bankSwiftCode !== undefined ? (input.bankSwiftCode ?? null) : undefined,
      taxId: input.taxId !== undefined ? (input.taxId ?? null) : undefined,
      vatNumber: input.vatNumber !== undefined ? (input.vatNumber ?? null) : undefined,
      registrationNumber: input.registrationNumber !== undefined ? (input.registrationNumber ?? null) : undefined,
      paymentTermsDays: input.paymentTermsDays,
      preferredPaymentMethod: input.preferredPaymentMethod !== undefined ? (input.preferredPaymentMethod ?? null) : undefined,
      creditLimit: input.creditLimit !== undefined ? (input.creditLimit ?? null) : undefined,
      metadata: input.metadata,
    });

    if (!vendor) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Vendor not found");
    }
    return c.json(vendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update vendor");
  }
});

// DELETE /:id - Delete vendor (soft delete)
vendorRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid vendor ID format");
  }

  try {
    const deleted = await vendorRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Vendor not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete vendor");
  }
});
