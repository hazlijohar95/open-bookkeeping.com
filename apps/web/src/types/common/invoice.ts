import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";

// Invoice type values (local or server storage)
export const invoiceTypeValues = ["local", "server"] as const;
export type InvoiceTypeType = (typeof invoiceTypeValues)[number];

// ============================================
// V2 STATUS SYSTEM
// ============================================

// V2 Invoice status values (stored in DB)
export const invoiceStatusV2Values = [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "refunded",
] as const;
export type InvoiceStatusV2Type = (typeof invoiceStatusV2Values)[number];

// V2 Display status (includes calculated states)
export const invoiceDisplayStatusValues = [
  ...invoiceStatusV2Values,
  "overdue",
  "partial",
] as const;
export type InvoiceDisplayStatusType =
  (typeof invoiceDisplayStatusValues)[number];

// Mimic Drizzle's pgEnum structure for V2 compatibility
export const invoiceStatusV2Enum = {
  enumValues: invoiceStatusV2Values,
} as const;

// ============================================
// LEGACY V1 STATUS (for backwards compatibility)
// ============================================

// Legacy V1 status values (kept for migration/local invoices)
export const invoiceStatusV1Values = [
  "pending",
  "success",
  "error",
  "expired",
  "refunded",
] as const;
export type InvoiceStatusV1Type = (typeof invoiceStatusV1Values)[number];

// Legacy enum for backwards compatibility
export const invoiceStatusEnum = {
  enumValues: invoiceStatusV1Values,
} as const;

// Combined status type (for transition period)
export type InvoiceStatusType = InvoiceStatusV1Type | InvoiceStatusV2Type;

// Alias for backward compatibility
export const invoiceStatusValues = invoiceStatusV1Values;

// ============================================
// V2 INVOICE INTERFACES
// ============================================

/**
 * V2 Invoice - new consolidated structure
 */
export interface InvoiceV2 {
  id: string;
  userId: string;
  customerId: string | null;
  vendorId: string | null;
  type: InvoiceTypeType;
  status: InvoiceStatusV2Type;
  einvoiceStatus: string | null;
  prefix: string;
  serialNumber: string;
  currency: string;
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTerms: string | null;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  theme: InvoiceTheme | null;
  companyDetails: CompanyDetailsV2;
  clientDetails: ClientDetailsV2;
  billingDetails: BillingDetailV2[];
  metadata: InvoiceMetadataV2;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  deletedAt: Date | null;
  // Relations
  items?: InvoiceItemV2[];
  payments?: InvoicePaymentV2[];
  customer?: { id: string; name: string } | null;
}

export interface InvoiceTheme {
  baseColor: string;
  mode: "dark" | "light";
  template?: "default" | "cynco" | "classic" | "zen" | "executive";
}

export interface MetadataField {
  label: string;
  value: string;
}

export interface CompanyDetailsV2 {
  name: string;
  address: string;
  logo?: string | null;
  signature?: string | null;
  metadata?: MetadataField[];
}

export interface ClientDetailsV2 {
  name: string;
  address: string;
  taxId?: string;
  metadata?: MetadataField[];
}

export interface BillingDetailV2 {
  label: string;
  type: "fixed" | "percentage";
  value: string;
  isSstTax?: boolean;
  sstTaxType?: "sales_tax" | "service_tax";
  sstRateCode?: string;
}

export interface InvoiceMetadataV2 {
  notes?: string;
  terms?: string;
  paymentInformation?: MetadataField[];
}

export interface InvoiceItemV2 {
  id: string;
  invoiceId: string;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  unit: string | null;
  sku: string | null;
  taxRate: string | null;
  discount: string | null;
  sortOrder: string;
  createdAt: Date;
}

export interface InvoicePaymentV2 {
  id: string;
  invoiceId: string;
  amount: string;
  currency: string;
  method: string | null;
  reference: string | null;
  paidAt: Date;
  notes: string | null;
  createdAt: Date;
}

/**
 * Lightweight invoice for table views
 */
export interface InvoiceV2ListItem {
  id: string;
  status: InvoiceStatusV2Type;
  prefix: string;
  serialNumber: string;
  currency: string;
  total: string;
  amountDue: string;
  invoiceDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  clientName: string;
  customerId: string | null;
}

// ============================================
// LEGACY V1 INVOICE INTERFACES
// ============================================

/**
 * Legacy V1 Invoice structure (for backwards compatibility)
 */
export interface Invoice {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: InvoiceStatusType;
  paidAt: Date | null;
  invoiceFields: Omit<ZodCreateInvoiceSchema, "metadata"> & {
    metadata: ZodCreateInvoiceSchema["metadata"] | null;
  };
}

// API response type where nested fields can be null
export interface InvoiceApiResponse {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: InvoiceStatusType;
  paidAt: Date | null;
  invoiceFields: {
    companyDetails: ZodCreateInvoiceSchema["companyDetails"] | null;
    clientDetails: ZodCreateInvoiceSchema["clientDetails"] | null;
    invoiceDetails: ZodCreateInvoiceSchema["invoiceDetails"] | null;
    items: ZodCreateInvoiceSchema["items"];
    metadata: ZodCreateInvoiceSchema["metadata"] | null;
  } | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if an invoice response has all required fields (V1)
 */
export function isCompleteInvoice(
  invoice: InvoiceApiResponse
): invoice is Invoice {
  return !!(
    invoice.invoiceFields &&
    invoice.invoiceFields.companyDetails &&
    invoice.invoiceFields.clientDetails &&
    invoice.invoiceFields.invoiceDetails
  );
}

/**
 * Filter and transform API responses to Invoice[] (V1)
 */
export function toInvoices(
  apiInvoices: InvoiceApiResponse[] | undefined
): Invoice[] {
  if (!apiInvoices) return [];
  return apiInvoices.filter(isCompleteInvoice);
}

/**
 * Check if status is a V2 status
 */
export function isV2Status(status: string): status is InvoiceStatusV2Type {
  return invoiceStatusV2Values.includes(status as InvoiceStatusV2Type);
}

/**
 * Check if status is a V1 status
 */
export function isV1Status(status: string): status is InvoiceStatusV1Type {
  return invoiceStatusV1Values.includes(status as InvoiceStatusV1Type);
}

/**
 * Map V1 status to V2 status
 */
export function mapV1ToV2Status(
  v1Status: InvoiceStatusV1Type
): InvoiceStatusV2Type {
  const mapping: Record<InvoiceStatusV1Type, InvoiceStatusV2Type> = {
    pending: "open",
    success: "paid",
    error: "void",
    expired: "uncollectible",
    refunded: "refunded",
  };
  return mapping[v1Status];
}

export type InvoiceImageType = "logo" | "signature";
