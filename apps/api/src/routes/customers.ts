/**
 * Customer REST Routes
 * Provides REST API endpoints for customer CRUD operations
 */

import { Hono } from "hono";
import { z } from "zod";
import { customerRepository } from "@open-bookkeeping/db";
import { metadataItemSchema } from "../schemas/common";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Zod schemas for customer operations
const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

export const customerRoutes = new Hono();

// GET / - List all customers with pagination
customerRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);
    const customers = await customerRepository.findMany(user.id, { limit, offset });
    return c.json(customers);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching customers:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch customers");
  }
});

// GET /search - Search customers by name or email
customerRoutes.get("/search", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query("q") || "";
    const customers = await customerRepository.search(user.id, query);
    return c.json(customers);
  } catch (error) {
    console.error("Error searching customers:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to search customers");
  }
});

// GET /:id - Get single customer
customerRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid customer ID format");
  }

  try {
    const customer = await customerRepository.findById(id, user.id);
    if (!customer) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Customer not found");
    }
    return c.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch customer");
  }
});

// POST / - Create new customer
customerRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createCustomerSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const customer = await customerRepository.create({
      userId: user.id,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      metadata: input.metadata,
    });

    return c.json(customer, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating customer:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create customer");
  }
});

// PATCH /:id - Update customer
customerRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid customer ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateCustomerSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const input = parseResult.data;
    const customer = await customerRepository.update(id, user.id, {
      name: input.name,
      email: input.email !== undefined ? (input.email || null) : undefined,
      phone: input.phone !== undefined ? (input.phone || null) : undefined,
      address: input.address !== undefined ? (input.address || null) : undefined,
      metadata: input.metadata,
    });

    if (!customer) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Customer not found");
    }
    return c.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update customer");
  }
});

// DELETE /:id - Delete customer (soft delete)
customerRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid customer ID format");
  }

  try {
    const deleted = await customerRepository.delete(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Customer not found");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete customer");
  }
});
