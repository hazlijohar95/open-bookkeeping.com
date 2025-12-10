import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { vendorRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { assertFound } from "../../lib/errors";
import { metadataItemSchema } from "../../schemas/common";

const logger = createLogger("vendor-service");

// Zod schemas for vendor operations

const createVendorSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.number().int().positive().max(365).optional(),
  preferredPaymentMethod: z.string().max(100).optional(),
  creditLimit: z.string().max(50).optional(), // Store as string for decimal precision

  // Custom metadata
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateVendorSchema = z.object({
  id: z.string().uuid(),
  // Basic Information
  name: z.string().min(1, "Name is required").max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.number().int().positive().max(365).optional().nullable(),
  preferredPaymentMethod: z.string().max(100).optional(),
  creditLimit: z.string().max(50).optional().nullable(),

  // Custom metadata
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

// Pagination schema
const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
}).optional();

export const vendorRouter = router({
  // List all vendors for the user with pagination
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};

      const vendors = await vendorRepository.findMany(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug({ userId: ctx.user.id, count: vendors.length }, "Listed vendors");
      return vendors;
    }),

  // Get a single vendor by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendor = await vendorRepository.findById(input.id, ctx.user.id);
      assertFound(vendor, "vendor", input.id);
      return vendor;
    }),

  // Search vendors by name or email (for autocomplete)
  search: protectedProcedure
    .input(z.object({ query: z.string().max(200) }))
    .query(async ({ ctx, input }) => {
      const results = await vendorRepository.search(ctx.user.id, input.query);
      return results;
    }),

  // Create a new vendor
  create: protectedProcedure
    .input(createVendorSchema)
    .mutation(async ({ ctx, input }) => {
      const vendor = await vendorRepository.create({
        userId: ctx.user.id,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        website: input.website || null,
        bankName: input.bankName || null,
        bankAccountNumber: input.bankAccountNumber || null,
        bankRoutingNumber: input.bankRoutingNumber || null,
        bankSwiftCode: input.bankSwiftCode || null,
        taxId: input.taxId || null,
        vatNumber: input.vatNumber || null,
        registrationNumber: input.registrationNumber || null,
        paymentTermsDays: input.paymentTermsDays || null,
        preferredPaymentMethod: input.preferredPaymentMethod || null,
        creditLimit: input.creditLimit || null,
        metadata: input.metadata,
      });

      logger.info({ userId: ctx.user.id, vendorId: vendor?.id }, "Vendor created");
      return vendor;
    }),

  // Update an existing vendor
  update: protectedProcedure
    .input(updateVendorSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await vendorRepository.update(input.id, ctx.user.id, {
        name: input.name,
        email: input.email !== undefined ? (input.email || null) : undefined,
        phone: input.phone !== undefined ? (input.phone || null) : undefined,
        address: input.address !== undefined ? (input.address || null) : undefined,
        website: input.website !== undefined ? (input.website || null) : undefined,
        bankName: input.bankName !== undefined ? (input.bankName || null) : undefined,
        bankAccountNumber: input.bankAccountNumber !== undefined ? (input.bankAccountNumber || null) : undefined,
        bankRoutingNumber: input.bankRoutingNumber !== undefined ? (input.bankRoutingNumber || null) : undefined,
        bankSwiftCode: input.bankSwiftCode !== undefined ? (input.bankSwiftCode || null) : undefined,
        taxId: input.taxId !== undefined ? (input.taxId || null) : undefined,
        vatNumber: input.vatNumber !== undefined ? (input.vatNumber || null) : undefined,
        registrationNumber: input.registrationNumber !== undefined ? (input.registrationNumber || null) : undefined,
        paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : undefined,
        preferredPaymentMethod: input.preferredPaymentMethod !== undefined ? (input.preferredPaymentMethod || null) : undefined,
        creditLimit: input.creditLimit !== undefined ? input.creditLimit : undefined,
        metadata: input.metadata,
      });

      assertFound(updated, "vendor", input.id);
      logger.info({ userId: ctx.user.id, vendorId: input.id }, "Vendor updated");
      return updated;
    }),

  // Delete a vendor
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await vendorRepository.delete(input.id, ctx.user.id);
      assertFound(deleted, "vendor", input.id);
      logger.info({ userId: ctx.user.id, vendorId: input.id }, "Vendor deleted");
      return { success: true };
    }),
});
