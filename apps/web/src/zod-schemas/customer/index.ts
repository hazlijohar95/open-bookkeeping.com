import { z } from "zod";

// Metadata item schema
export const customerMetadataSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

// Create customer schema
export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  metadata: z.array(customerMetadataSchema).optional(),
});

// Update customer schema
export const updateCustomerSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  metadata: z.array(customerMetadataSchema).optional(),
});

// Infer types
export type CreateCustomerSchema = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerSchema = z.infer<typeof updateCustomerSchema>;
export type CustomerMetadataSchema = z.infer<typeof customerMetadataSchema>;
