import { z } from "zod";

// Metadata item schema (reused across company and client details)
export const metadataItemSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

// Billing detail schema
export const billingDetailSchema = z.object({
  label: z.string().min(1, "Label is required"),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().min(0, "Value must be positive"),
});

// Invoice item schema
export const invoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional().default(""),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
});

// Theme schema
export const themeSchema = z.object({
  baseColor: z.string().default("#2563EB"),
  mode: z.enum(["dark", "light"]).default("light"),
  template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional().default("default"),
});

// Company details schema
export const companyDetailsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Company address is required"),
  logo: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  logoBase64: z.string().optional(),
  signatureBase64: z.string().optional(),
  metadata: z.array(metadataItemSchema).optional().default([]),
});

// Client details schema
export const clientDetailsSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  address: z.string().min(1, "Client address is required"),
  metadata: z.array(metadataItemSchema).optional().default([]),
});

// Invoice details schema
export const invoiceDetailsSchema = z.object({
  theme: themeSchema.optional().default({
    baseColor: "#2563EB",
    mode: "light",
    template: "default",
  }),
  currency: z.string().default("USD"),
  prefix: z.string().default("INV-"),
  serialNumber: z.string().default("0001"),
  date: z.date().default(() => new Date()),
  dueDate: z.date().nullable().optional(),
  paymentTerms: z.string().optional().default(""),
  billingDetails: z.array(billingDetailSchema).optional().default([]),
});

// Invoice metadata schema
export const invoiceMetadataSchema = z.object({
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  paymentInformation: z.array(metadataItemSchema).optional().default([]),
});

// Complete invoice schema
export const createInvoiceSchema = z.object({
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  invoiceDetails: invoiceDetailsSchema,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  metadata: invoiceMetadataSchema.optional().default({
    notes: "",
    terms: "",
    paymentInformation: [],
  }),
});

// Default values for a new invoice
export const defaultInvoiceValues: z.infer<typeof createInvoiceSchema> = {
  companyDetails: {
    name: "Your Company Name",
    address: "123 Main St, City, Country",
    logo: null,
    signature: null,
    metadata: [],
  },
  clientDetails: {
    name: "Client Name",
    address: "456 Client St, City, Country",
    metadata: [],
  },
  invoiceDetails: {
    theme: {
      baseColor: "#2563EB",
      mode: "light",
      template: "default",
    },
    currency: "USD",
    prefix: "INV-",
    serialNumber: "0001",
    date: new Date(),
    dueDate: null,
    paymentTerms: "Net 30",
    billingDetails: [],
  },
  items: [
    {
      name: "Service/Product",
      description: "Description of the service or product",
      quantity: 1,
      unitPrice: 100,
    },
  ],
  metadata: {
    notes: "",
    terms: "",
    paymentInformation: [],
  },
};

// Pagination schema (reusable across all list endpoints)
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
}).optional();

// Document item schema (for credit notes, debit notes - same as invoice items)
export const documentItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
});

// Document metadata schema (for credit notes, debit notes)
export const documentMetadataSchema = z.object({
  notes: z.string().optional(),
  terms: z.string().optional(),
});

// Note reason schema (shared between credit notes and debit notes)
export const noteReasonSchema = z.enum([
  "return",
  "discount",
  "pricing_error",
  "damaged_goods",
  "other",
]);

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type MetadataItem = z.infer<typeof metadataItemSchema>;
export type BillingDetail = z.infer<typeof billingDetailSchema>;
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;
export type DocumentItem = z.infer<typeof documentItemSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type NoteReason = z.infer<typeof noteReasonSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
