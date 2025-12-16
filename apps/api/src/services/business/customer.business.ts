/**
 * Customer Business Service
 *
 * Centralized business logic for customer operations.
 * Both REST routes and tRPC services should use this layer.
 */

import { customerRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("customer-business");

// ============================================
// Types
// ============================================

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface CustomerBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

// ============================================
// Business Service
// ============================================

export const customerBusiness = {
  /**
   * List all customers with pagination
   */
  async list(
    ctx: CustomerBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const customers = await customerRepository.findMany(ctx.userId, {
      limit,
      offset,
    });

    logger.debug(
      { userId: ctx.userId, count: customers.length },
      "Listed customers"
    );

    return customers;
  },

  /**
   * Search customers by name or email
   */
  async search(ctx: CustomerBusinessContext, query: string, limit = 10) {
    const customers = await customerRepository.search(ctx.userId, query, limit);

    logger.debug(
      { userId: ctx.userId, query, count: customers.length },
      "Searched customers"
    );

    return customers;
  },

  /**
   * Get a single customer by ID
   */
  async getById(ctx: CustomerBusinessContext, id: string) {
    const customer = await customerRepository.findById(id, ctx.userId);

    if (!customer) {
      logger.debug(
        { userId: ctx.userId, customerId: id },
        "Customer not found"
      );
      return null;
    }

    return customer;
  },

  /**
   * Create a new customer
   *
   * Side effects (non-blocking):
   * - Dispatches customer.created webhook
   */
  async create(ctx: CustomerBusinessContext, input: CreateCustomerInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const customer = await customerRepository.create({
      userId: ctx.userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      metadata: input.metadata,
    });

    logger.info(
      { userId: ctx.userId, customerId: customer?.id },
      "Customer created"
    );

    // Dispatch webhook (non-blocking)
    if (customer) {
      webhookDispatcher.customerCreated(ctx.userId, {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      });
    }

    return customer;
  },

  /**
   * Update an existing customer
   *
   * Side effects (non-blocking):
   * - Dispatches customer.updated webhook
   */
  async update(
    ctx: CustomerBusinessContext,
    id: string,
    input: UpdateCustomerInput
  ) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const customer = await customerRepository.update(id, ctx.userId, input);

    if (!customer) {
      logger.debug(
        { userId: ctx.userId, customerId: id },
        "Customer not found"
      );
      return null;
    }

    logger.info({ userId: ctx.userId, customerId: id }, "Customer updated");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.customerUpdated(ctx.userId, {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });

    return customer;
  },

  /**
   * Delete a customer (soft delete)
   *
   * Side effects (non-blocking):
   * - Dispatches customer.deleted webhook
   */
  async delete(ctx: CustomerBusinessContext, id: string) {
    const deleted = await customerRepository.delete(id, ctx.userId);

    if (!deleted) {
      logger.debug(
        { userId: ctx.userId, customerId: id },
        "Customer not found"
      );
      return false;
    }

    logger.info({ userId: ctx.userId, customerId: id }, "Customer deleted");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.customerDeleted(ctx.userId, id);

    return true;
  },

  /**
   * Check if a customer exists
   */
  async exists(ctx: CustomerBusinessContext, id: string) {
    return customerRepository.exists(id, ctx.userId);
  },
};

export type CustomerBusiness = typeof customerBusiness;
