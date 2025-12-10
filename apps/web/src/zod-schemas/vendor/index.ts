import { z } from "zod";

// Metadata item schema
export const vendorMetadataSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

// Create vendor schema
export const createVendorSchema = z.object({
  // Basic Information (name required, rest optional)
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  bankSwiftCode: z.string().optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().optional(),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.coerce.number().int().positive().optional().or(z.literal("")),
  preferredPaymentMethod: z.string().optional(),
  creditLimit: z.string().optional(),

  // Custom metadata
  metadata: z.array(vendorMetadataSchema).optional(),
});

// Update vendor schema
export const updateVendorSchema = z.object({
  id: z.string().uuid(),

  // Basic Information
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  bankSwiftCode: z.string().optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().optional(),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.coerce.number().int().positive().optional().nullable(),
  preferredPaymentMethod: z.string().optional(),
  creditLimit: z.string().optional().nullable(),

  // Custom metadata
  metadata: z.array(vendorMetadataSchema).optional(),
});

// Infer types
export type CreateVendorSchema = z.infer<typeof createVendorSchema>;
export type UpdateVendorSchema = z.infer<typeof updateVendorSchema>;
export type VendorMetadataSchema = z.infer<typeof vendorMetadataSchema>;
