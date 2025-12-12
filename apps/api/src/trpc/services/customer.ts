import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { customerRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { metadataItemSchema } from "../../schemas/common";

const logger = createLogger("customer-service");

// Zod schemas for customer operations

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

// Pagination schema
const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
}).optional();

export const customerRouter = router({
  // List all customers for the user with pagination
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      const customers = await customerRepository.findMany(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug({ userId: ctx.user.id, count: customers.length }, "Listed customers");
      return customers;
    }),

  // Get a single customer by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await customerRepository.findById(input.id, ctx.user.id);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      return customer;
    }),

  // Search customers by name or email (for autocomplete)
  search: protectedProcedure
    .input(z.object({ query: z.string().max(200) }))
    .query(async ({ ctx, input }) => {
      const results = await customerRepository.search(ctx.user.id, input.query);
      return results;
    }),

  // Create a new customer
  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const customer = await customerRepository.create({
        userId: ctx.user.id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        metadata: input.metadata,
      });

      logger.info({ userId: ctx.user.id, customerId: customer?.id }, "Customer created");
      return customer;
    }),

  // Update an existing customer
  update: protectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await customerRepository.update(input.id, ctx.user.id, {
        name: input.name,
        email: input.email !== undefined ? (input.email ?? null) : undefined,
        phone: input.phone !== undefined ? (input.phone ?? null) : undefined,
        address: input.address !== undefined ? (input.address ?? null) : undefined,
        metadata: input.metadata,
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      logger.info({ userId: ctx.user.id, customerId: input.id }, "Customer updated");
      return updated;
    }),

  // Delete a customer
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await customerRepository.delete(input.id, ctx.user.id);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      logger.info({ userId: ctx.user.id, customerId: input.id }, "Customer deleted");
      return { success: true };
    }),
});
