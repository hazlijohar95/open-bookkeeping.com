import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import type {
  InvoiceImageType,
  InvoiceStatusV2Type,
  InvoiceTypeType,
  InvoiceTheme,
  CompanyDetailsV2,
  ClientDetailsV2,
  BillingDetailV2,
  InvoiceMetadataV2,
} from "../common/invoice";

// Re-export types for backwards compatibility
export type { InvoiceTypeType };
export type InvoiceStatusType = InvoiceStatusV2Type;

/**
 * IndexedDB Invoice (V2 structure)
 *
 * This is the local storage format for invoices.
 * Uses the V2 status system (draft, open, paid, void, uncollectible, refunded).
 */
export interface IDBInvoice {
  id: string;
  type: InvoiceTypeType;
  status: InvoiceStatusType;
  prefix: string;
  serialNumber: string;
  currency: string;
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTerms: string | null;
  // Calculated totals
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  // Theme
  theme: InvoiceTheme | null;
  // Details (JSONB in server, objects in IndexedDB)
  companyDetails: CompanyDetailsV2;
  clientDetails: ClientDetailsV2;
  billingDetails: BillingDetailV2[];
  metadata: InvoiceMetadataV2;
  // Line items
  items: IDBInvoiceItem[];
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
}

/**
 * IndexedDB Invoice Item
 */
export interface IDBInvoiceItem {
  id: string;
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  unit: string | null;
  sku: string | null;
  taxRate: string | null;
  discount: string | null;
  sortOrder: number;
}

/**
 * Legacy IndexedDB Invoice format (for migration)
 *
 * @deprecated Use IDBInvoice instead
 */
export interface IDBInvoiceLegacy {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: "pending" | "success" | "error" | "expired" | "refunded";
  paidAt: Date | null;
  invoiceFields: ZodCreateInvoiceSchema;
}

/**
 * Check if an invoice is in the legacy format
 */
export function isLegacyInvoice(
  invoice: IDBInvoice | IDBInvoiceLegacy
): invoice is IDBInvoiceLegacy {
  return "invoiceFields" in invoice;
}

/**
 * Migrate a legacy invoice to the new format
 */
export function migrateLegacyInvoice(legacy: IDBInvoiceLegacy): IDBInvoice {
  const { invoiceFields } = legacy;

  // Map legacy status to V2 status
  const statusMap: Record<string, InvoiceStatusType> = {
    pending: "open",
    success: "paid",
    error: "void",
    expired: "uncollectible",
    refunded: "refunded",
  };

  // Calculate totals from items
  const items = invoiceFields.items.map((item, index) => {
    const quantity = String(item.quantity);
    const unitPrice = String(item.unitPrice);
    const amount = (item.quantity * item.unitPrice).toFixed(2);

    return {
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description || null,
      quantity,
      unitPrice,
      amount,
      unit: null,
      sku: null,
      taxRate: null,
      discount: null,
      sortOrder: index,
    };
  });

  const subtotal = items
    .reduce((sum, item) => sum + parseFloat(item.amount), 0)
    .toFixed(2);

  // Calculate tax/discount from billing details
  let taxTotal = 0;
  let discountTotal = 0;
  const billingDetails: BillingDetailV2[] = (
    invoiceFields.invoiceDetails.billingDetails || []
  ).map((bd) => {
    const value = String(bd.value);
    const numValue = bd.value;

    if (numValue >= 0) {
      if (bd.type === "percentage") {
        taxTotal += (parseFloat(subtotal) * numValue) / 100;
      } else {
        taxTotal += numValue;
      }
    } else {
      if (bd.type === "percentage") {
        discountTotal += (parseFloat(subtotal) * Math.abs(numValue)) / 100;
      } else {
        discountTotal += Math.abs(numValue);
      }
    }

    return {
      label: bd.label,
      type: bd.type,
      value,
      isSstTax: bd.isSstTax,
      sstTaxType: bd.sstTaxType,
      sstRateCode: bd.sstRateCode,
    };
  });

  const total = (parseFloat(subtotal) + taxTotal - discountTotal).toFixed(2);
  const isPaid = legacy.status === "success";

  return {
    id: legacy.id,
    type: legacy.type,
    status: statusMap[legacy.status] || "draft",
    prefix: invoiceFields.invoiceDetails.prefix,
    serialNumber: invoiceFields.invoiceDetails.serialNumber,
    currency: invoiceFields.invoiceDetails.currency || "MYR",
    invoiceDate: new Date(invoiceFields.invoiceDetails.date),
    dueDate: invoiceFields.invoiceDetails.dueDate
      ? new Date(invoiceFields.invoiceDetails.dueDate)
      : null,
    paymentTerms: invoiceFields.invoiceDetails.paymentTerms || null,
    subtotal,
    taxTotal: taxTotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    total,
    amountPaid: isPaid ? total : "0.00",
    amountDue: isPaid ? "0.00" : total,
    theme: invoiceFields.invoiceDetails.theme || null,
    companyDetails: {
      name: invoiceFields.companyDetails.name,
      address: invoiceFields.companyDetails.address,
      logo: invoiceFields.companyDetails.logo,
      signature: invoiceFields.companyDetails.signature,
      metadata: invoiceFields.companyDetails.metadata,
    },
    clientDetails: {
      name: invoiceFields.clientDetails.name,
      address: invoiceFields.clientDetails.address,
      metadata: invoiceFields.clientDetails.metadata,
    },
    billingDetails,
    metadata: {
      notes: invoiceFields.metadata?.notes,
      terms: invoiceFields.metadata?.terms,
      paymentInformation: invoiceFields.metadata?.paymentInformation,
    },
    items,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    paidAt: legacy.paidAt,
  };
}

export interface IDBImage {
  id: string;
  type: InvoiceImageType;
  createdAt: Date;
  base64: string;
}
