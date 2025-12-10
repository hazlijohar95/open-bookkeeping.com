/**
 * Customers API v1
 * CRUD operations for customer management
 */

import { Hono } from "hono";
import { z } from "zod";
import { customerRepository } from "@open-bookkeeping/db";
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

const logger = createLogger("api-v1-customers");

// Validation schemas
const metadataItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(500),
});

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

export const customersRouter = new Hono();

/**
 * GET /api/v1/customers
 * List all customers with pagination
 */
customersRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const customers = await customerRepository.findMany(userId, { limit, offset });

    logger.debug({ userId, count: customers.length }, "Listed customers via API");
    return list(c, customers, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list customers");
    return internalError(c);
  }
});

/**
 * GET /api/v1/customers/search
 * Search customers by name or email
 */
customersRouter.get("/search", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const query = c.req.query("q") ?? "";
    const limitParam = c.req.query("limit");
    const limit = parseIntSafe(limitParam, 10, { min: 1, max: 100 });

    const customers = await customerRepository.search(userId, query, limit);

    return list(c, customers, { limit, offset: 0 });
  } catch (error) {
    logger.error({ error }, "Failed to search customers");
    return internalError(c);
  }
});

/**
 * GET /api/v1/customers/:id
 * Get a single customer by ID
 */
customersRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "customer");
  if (validId instanceof Response) return validId;

  try {
    const customer = await customerRepository.findById(id, userId);
    if (!customer) {
      return notFound(c, "Customer", id);
    }

    return success(c, customer);
  } catch (error) {
    logger.error({ error, customerId: id }, "Failed to get customer");
    return internalError(c);
  }
});

/**
 * POST /api/v1/customers
 * Create a new customer
 */
customersRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createCustomerSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;
    const customer = await customerRepository.create({
      userId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      metadata: input.metadata,
    });

    logger.info({ userId, customerId: customer?.id }, "Customer created via API");
    return created(c, customer);
  } catch (error) {
    logger.error({ error }, "Failed to create customer");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/customers/:id
 * Update an existing customer
 */
customersRouter.patch("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "customer");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateCustomerSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;
    const customer = await customerRepository.update(id, userId, {
      name: input.name,
      email: input.email !== undefined ? (input.email ?? null) : undefined,
      phone: input.phone !== undefined ? (input.phone ?? null) : undefined,
      address: input.address !== undefined ? (input.address ?? null) : undefined,
      metadata: input.metadata,
    });

    if (!customer) {
      return notFound(c, "Customer", id);
    }

    logger.info({ userId, customerId: id }, "Customer updated via API");
    return success(c, customer);
  } catch (error) {
    logger.error({ error, customerId: id }, "Failed to update customer");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/customers/:id
 * Delete a customer (soft delete)
 */
customersRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "customer");
  if (validId instanceof Response) return validId;

  try {
    const result = await customerRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Customer", id);
    }

    logger.info({ userId, customerId: id }, "Customer deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, customerId: id }, "Failed to delete customer");
    return internalError(c);
  }
});
