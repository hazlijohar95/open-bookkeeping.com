import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { billBusiness } from "../../services/business";
import {
  documentStatusSchema,
  paginationBaseSchema,
} from "../../schemas/common";

// Bill item schema (bills use strings for quantity/price due to form handling)
const billItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Quantity must be a positive number",
    }),
  unitPrice: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: "Unit price must be a non-negative number",
    }),
});

// Create bill schema
const createBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1, "Bill number is required").max(100),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).default("MYR"),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  status: documentStatusSchema.default("pending"),
  notes: z.string().max(2000).optional(),
  attachmentUrl: z.string().url().max(500).optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
  // Tax support
  taxRate: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      {
        message: "Tax rate must be a non-negative number",
      }
    )
    .optional()
    .nullable(),
});

// Update bill schema
const updateBillSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  currency: z.string().length(3).optional(),
  billDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  status: documentStatusSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
  items: z.array(billItemSchema).optional(),
});

// Pagination and filter schema for bills
const listBillsSchema = paginationBaseSchema
  .extend({
    vendorId: z.string().uuid().optional(),
    status: documentStatusSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .optional();

export const billRouter = router({
  // List all bills for the user with pagination and filters
  list: protectedProcedure
    .input(listBillsSchema)
    .query(async ({ ctx, input }) => {
      const {
        limit = 50,
        offset = 0,
        vendorId,
        status,
        startDate,
        endDate,
      } = input ?? {};

      return billBusiness.list(
        { userId: ctx.user.id },
        { limit, offset, vendorId, status, startDate, endDate }
      );
    }),

  // Get a single bill by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await billBusiness.getById(
        { userId: ctx.user.id },
        input.id
      );

      if (!bill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      return bill;
    }),

  // Get bills by vendor
  getByVendor: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return billBusiness.getByVendor({ userId: ctx.user.id }, input.vendorId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get unpaid bills (for AP aging)
  getUnpaid: protectedProcedure
    .input(
      z
        .object({
          vendorId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return billBusiness.getUnpaid({ userId: ctx.user.id }, input?.vendorId);
    }),

  // Create a new bill
  create: protectedProcedure
    .input(createBillSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await billBusiness.create(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          {
            vendorId: input.vendorId ?? null,
            billNumber: input.billNumber,
            description: input.description ?? null,
            currency: input.currency,
            billDate: input.billDate,
            dueDate: input.dueDate ?? null,
            status: input.status,
            notes: input.notes ?? null,
            attachmentUrl: input.attachmentUrl ?? null,
            items: input.items,
            taxRate: input.taxRate ?? null,
          }
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "You have disabled data saving"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // Update an existing bill
  update: protectedProcedure
    .input(updateBillSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await billBusiness.update(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          input.id,
          {
            vendorId: input.vendorId,
            billNumber: input.billNumber,
            description: input.description,
            currency: input.currency,
            billDate: input.billDate,
            dueDate: input.dueDate,
            status: input.status,
            notes: input.notes,
            attachmentUrl: input.attachmentUrl,
            items: input.items,
          }
        );

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bill not found",
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (
          error instanceof Error &&
          error.message === "You have disabled data saving"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // Update bill status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: documentStatusSchema,
        paidAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await billBusiness.updateStatus(
        { userId: ctx.user.id },
        input.id,
        input.status,
        input.paidAt
      );

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      return updated;
    }),

  // Delete a bill
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await billBusiness.delete(
        { userId: ctx.user.id },
        input.id
      );

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        });
      }

      return { success: true };
    }),

  // Get AP aging report
  getAgingReport: protectedProcedure
    .input(
      z
        .object({
          vendorId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return billBusiness.getAgingReport(
        { userId: ctx.user.id },
        input?.vendorId
      );
    }),
});
