import { z } from "zod";

export const billStatusSchema = z.enum(["draft", "pending", "paid", "overdue", "cancelled"]);

export const billItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Quantity must be a positive number",
  }),
  unitPrice: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Unit price must be a non-negative number",
  }),
});

export const createBillSchema = z.object({
  vendorId: z.uuid().optional().nullable(),
  billNumber: z.string().min(1, "Bill number is required").max(100),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).default("MYR"),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  status: billStatusSchema.default("pending"),
  notes: z.string().max(2000).optional(),
  attachmentUrl: z.url().max(500).optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

export type CreateBillSchema = z.infer<typeof createBillSchema>;
export type BillItemSchema = z.infer<typeof billItemSchema>;
