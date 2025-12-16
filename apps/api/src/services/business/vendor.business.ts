/**
 * Vendor Business Service
 *
 * Centralized business logic for vendor operations.
 * Both REST routes and tRPC services should use this layer.
 */

import { vendorRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("vendor-business");

// ============================================
// Types
// ============================================

export interface CreateVendorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingNumber?: string | null;
  bankSwiftCode?: string | null;
  taxId?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  paymentTermsDays?: number | null;
  preferredPaymentMethod?: string | null;
  creditLimit?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface UpdateVendorInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingNumber?: string | null;
  bankSwiftCode?: string | null;
  taxId?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  paymentTermsDays?: number | null;
  preferredPaymentMethod?: string | null;
  creditLimit?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface VendorBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

// ============================================
// Business Service
// ============================================

export const vendorBusiness = {
  /**
   * List all vendors with pagination
   */
  async list(
    ctx: VendorBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const vendors = await vendorRepository.findMany(ctx.userId, {
      limit,
      offset,
    });

    logger.debug(
      { userId: ctx.userId, count: vendors.length },
      "Listed vendors"
    );

    return vendors;
  },

  /**
   * Search vendors by name or email
   */
  async search(ctx: VendorBusinessContext, query: string, limit = 10) {
    const vendors = await vendorRepository.search(ctx.userId, query, limit);

    logger.debug(
      { userId: ctx.userId, query, count: vendors.length },
      "Searched vendors"
    );

    return vendors;
  },

  /**
   * Get a single vendor by ID
   */
  async getById(ctx: VendorBusinessContext, id: string) {
    const vendor = await vendorRepository.findById(id, ctx.userId);

    if (!vendor) {
      logger.debug({ userId: ctx.userId, vendorId: id }, "Vendor not found");
      return null;
    }

    return vendor;
  },

  /**
   * Create a new vendor
   *
   * Side effects (non-blocking):
   * - Dispatches vendor.created webhook
   */
  async create(ctx: VendorBusinessContext, input: CreateVendorInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const vendor = await vendorRepository.create({
      userId: ctx.userId,
      ...input,
    });

    logger.info({ userId: ctx.userId, vendorId: vendor?.id }, "Vendor created");

    // Dispatch webhook (non-blocking)
    if (vendor) {
      webhookDispatcher.vendorCreated(ctx.userId, {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
      });
    }

    return vendor;
  },

  /**
   * Update an existing vendor
   *
   * Side effects (non-blocking):
   * - Dispatches vendor.updated webhook
   */
  async update(
    ctx: VendorBusinessContext,
    id: string,
    input: UpdateVendorInput
  ) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const vendor = await vendorRepository.update(id, ctx.userId, input);

    if (!vendor) {
      logger.debug({ userId: ctx.userId, vendorId: id }, "Vendor not found");
      return null;
    }

    logger.info({ userId: ctx.userId, vendorId: id }, "Vendor updated");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.vendorUpdated(ctx.userId, {
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
    });

    return vendor;
  },

  /**
   * Delete a vendor (soft delete)
   *
   * Side effects (non-blocking):
   * - Dispatches vendor.deleted webhook
   */
  async delete(ctx: VendorBusinessContext, id: string) {
    const deleted = await vendorRepository.delete(id, ctx.userId);

    if (!deleted) {
      logger.debug({ userId: ctx.userId, vendorId: id }, "Vendor not found");
      return false;
    }

    logger.info({ userId: ctx.userId, vendorId: id }, "Vendor deleted");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.vendorDeleted(ctx.userId, id);

    return true;
  },

  /**
   * Check if a vendor exists
   */
  async exists(ctx: VendorBusinessContext, id: string) {
    return vendorRepository.exists(id, ctx.userId);
  },
};

export type VendorBusiness = typeof vendorBusiness;
