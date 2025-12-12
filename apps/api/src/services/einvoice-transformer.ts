/**
 * E-Invoice Transformer Service
 * Transforms Open-Invoicing data to MyInvois Gateway format
 */

import Decimal from "decimal.js";
import type { InvoiceWithDetails } from "@open-bookkeeping/db";
import type {
  InvoiceDocument,
  CreditNoteDocument,
  DebitNoteDocument,
  Supplier,
  Customer,
  InvoiceLine,
  TaxTotal,
  LegalMonetaryTotal,
  TaxCategoryCode,
  IdentificationScheme,
  BillingReference,
} from "./myinvois-gateway";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface EInvoiceSettings {
  tin: string;
  brn: string;
  identificationScheme: IdentificationScheme;
  msicCode: string;
  msicDescription: string;
  sstRegistration?: string | null;
  tourismTaxRegistration?: string | null;
}

export interface CompanyDetails {
  name: string;
  address: string;
  logo?: string | null;
  signature?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface ClientDetails {
  name: string;
  address: string;
  metadata?: Array<{ label: string; value: string }>;
}

export interface InvoiceDetail {
  theme?: {
    baseColor: string;
    mode: "dark" | "light";
    template?: string;
  } | null;
  currency: string;
  prefix: string;
  serialNumber: string;
  date: Date;
  dueDate?: Date | null;
  paymentTerms?: string | null;
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: string;
  }>;
}

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: string;
}

export interface InvoiceMetadata {
  notes?: string | null;
  terms?: string | null;
  paymentInformation?: Array<{ label: string; value: string }>;
}

// Re-export the repository type for convenience
export type { InvoiceWithDetails };

// Customer e-invoice details from metadata or separate fields
export interface CustomerEInvoiceDetails {
  tin?: string;
  brn?: string;
  identificationScheme?: IdentificationScheme;
  phone?: string;
  email?: string;
  cityName?: string;
  stateCode?: string;
  countryCode?: string;
  postalCode?: string;
}

// ============================================
// MALAYSIA STATE CODES
// ============================================

const MALAYSIA_STATE_CODES: Record<string, string> = {
  johor: "01",
  kedah: "02",
  kelantan: "03",
  melaka: "04",
  malacca: "04",
  "negeri sembilan": "05",
  pahang: "06",
  "pulau pinang": "07",
  penang: "07",
  perak: "08",
  perlis: "09",
  selangor: "10",
  terengganu: "11",
  sabah: "12",
  sarawak: "13",
  "kuala lumpur": "14",
  kl: "14",
  labuan: "15",
  putrajaya: "16",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Format time as HH:mm:ssZ
 */
export function formatTime(date: Date): string {
  return date.toISOString().split("T")[1]!.replace(/\.\d{3}/, "");
}

/**
 * Parse address string into components
 * Attempts to extract city, state, postal code from free-form address
 */
export function parseAddress(addressStr: string): {
  addressLines: string[];
  cityName: string;
  countrySubentityCode: string;
  countryCode: string;
  postalZone?: string;
} {
  const lines = addressStr.split("\n").filter((line) => line.trim());

  // Try to find state code from address
  let stateCode = "14"; // Default to Kuala Lumpur
  let postalZone: string | undefined;
  let cityName = "Unknown";

  const lowerAddress = addressStr.toLowerCase();
  for (const [stateName, code] of Object.entries(MALAYSIA_STATE_CODES)) {
    if (lowerAddress.includes(stateName)) {
      stateCode = code;
      break;
    }
  }

  // Try to extract postal code (5 digits for Malaysia)
  const postalMatch = addressStr.match(/\b(\d{5})\b/);
  if (postalMatch) {
    postalZone = postalMatch[1];
  }

  // Try to extract city (look for common city indicators or take second-to-last line)
  const cityPatterns = [
    /(?:city|bandar|kota|pekan)\s+([a-z\s]+)/i,
    /,\s*([a-z\s]+)\s*,/i,
  ];

  for (const pattern of cityPatterns) {
    const match = addressStr.match(pattern);
    if (match && match[1]) {
      cityName = match[1].trim();
      break;
    }
  }

  // If still unknown, use second line or first line
  if (cityName === "Unknown" && lines.length > 1) {
    cityName = lines[1]!.replace(/[,\d]/g, "").trim() || lines[0]!;
  } else if (cityName === "Unknown" && lines.length === 1) {
    cityName = lines[0]!.replace(/[,\d]/g, "").trim();
  }

  return {
    addressLines: lines.length > 0 ? lines : ["NA"],
    cityName: cityName ?? "NA",
    countrySubentityCode: stateCode,
    countryCode: "MYS",
    postalZone,
  };
}

/**
 * Extract customer e-invoice details from metadata
 */
export function extractCustomerEInvoiceDetails(
  metadata?: Array<{ label: string; value: string }>
): CustomerEInvoiceDetails {
  const details: CustomerEInvoiceDetails = {};

  if (!metadata) return details;

  for (const item of metadata) {
    const label = item.label.toLowerCase();
    const value = item.value;

    if (label.includes("tin") || label === "tax id") {
      details.tin = value;
    } else if (label.includes("brn") || label.includes("registration")) {
      details.brn = value;
    } else if (label.includes("phone") || label.includes("tel")) {
      details.phone = value;
    } else if (label.includes("email") || label.includes("e-mail")) {
      details.email = value;
    }
  }

  return details;
}

/**
 * Extract company phone and email from metadata
 */
export function extractCompanyContactInfo(
  metadata?: Array<{ label: string; value: string }>
): { phone?: string; email?: string } {
  const info: { phone?: string; email?: string } = {};

  if (!metadata) return info;

  for (const item of metadata) {
    const label = item.label.toLowerCase();

    if (label.includes("phone") || label.includes("tel")) {
      info.phone = item.value;
    } else if (label.includes("email") || label.includes("e-mail")) {
      info.email = item.value;
    }
  }

  return info;
}

/**
 * Calculate line item totals and subtotals
 */
export function calculateLineItems(
  items: InvoiceItem[],
  _taxCategoryCode: TaxCategoryCode = "06"
): {
  lines: InvoiceLine[];
  subtotal: Decimal;
} {
  let subtotal = new Decimal(0);
  const lines: InvoiceLine[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const lineSubtotal = new Decimal(item.unitPrice).times(item.quantity);
    subtotal = subtotal.plus(lineSubtotal);

    lines.push({
      id: String(i + 1),
      quantity: item.quantity,
      unitPrice: new Decimal(item.unitPrice).toNumber(),
      subtotal: lineSubtotal.toNumber(),
      itemDescription: item.description
        ? `${item.name} - ${item.description}`
        : item.name,
      itemCommodityClassification: {
        code: "022", // Default commodity classification
      },
    });
  }

  return { lines, subtotal };
}

/**
 * Calculate billing adjustments (tax, discount, etc.)
 */
export function calculateBillingAdjustments(
  subtotal: Decimal,
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: string;
  }>
): {
  taxAmount: Decimal;
  discountAmount: Decimal;
  taxSubtotals: Array<{
    taxableAmount: number;
    taxAmount: number;
    taxCategoryCode: TaxCategoryCode;
    percent?: number;
  }>;
} {
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);
  const taxSubtotals: Array<{
    taxableAmount: number;
    taxAmount: number;
    taxCategoryCode: TaxCategoryCode;
    percent?: number;
  }> = [];

  if (billingDetails) {
    for (const detail of billingDetails) {
      const label = detail.label.toLowerCase();
      const value = new Decimal(detail.value);

      if (
        label.includes("tax") ||
        label.includes("sst") ||
        label.includes("gst")
      ) {
        let amount: Decimal;
        let percent: number | undefined;

        if (detail.type === "percentage") {
          percent = value.toNumber();
          amount = subtotal.times(value).div(100);
        } else {
          amount = value;
        }
        taxAmount = taxAmount.plus(amount);

        taxSubtotals.push({
          taxableAmount: subtotal.toNumber(),
          taxAmount: amount.toNumber(),
          taxCategoryCode: "01", // Sales Tax
          percent,
        });
      } else if (
        label.includes("discount") ||
        label.includes("rebate")
      ) {
        if (detail.type === "percentage") {
          discountAmount = discountAmount.plus(subtotal.times(value).div(100));
        } else {
          discountAmount = discountAmount.plus(value);
        }
      }
    }
  }

  // If no tax specified, add zero tax entry
  if (taxSubtotals.length === 0) {
    taxSubtotals.push({
      taxableAmount: subtotal.toNumber(),
      taxAmount: 0,
      taxCategoryCode: "06", // Not Applicable
    });
  }

  return { taxAmount, discountAmount, taxSubtotals };
}

// ============================================
// MAIN TRANSFORMER FUNCTIONS
// ============================================

/**
 * Transform Open-Invoicing invoice to MyInvois Gateway format
 */
export function transformInvoiceToMyInvois(
  invoice: InvoiceWithDetails,
  settings: EInvoiceSettings,
  customerDetails?: CustomerEInvoiceDetails
): InvoiceDocument {
  const fields = invoice.invoiceFields;

  if (!fields?.companyDetails || !fields?.clientDetails || !fields?.invoiceDetails) {
    throw new Error("Invoice is missing required fields");
  }

  const companyContact = extractCompanyContactInfo(fields.companyDetails.metadata);
  const customerInfo = customerDetails || extractCustomerEInvoiceDetails(fields.clientDetails.metadata);
  const companyAddress = parseAddress(fields.companyDetails.address);
  const clientAddress = parseAddress(fields.clientDetails.address);

  // Build supplier (your company)
  const supplier: Supplier = {
    TIN: settings.tin,
    legalName: fields.companyDetails.name,
    identificationNumber: settings.brn,
    identificationScheme: settings.identificationScheme,
    telephone: companyContact.phone ?? "NA",
    industryClassificationCode: settings.msicCode,
    industryClassificationName: settings.msicDescription,
    address: companyAddress,
    electronicMail: companyContact.email,
    sstRegistrationNumber: settings.sstRegistration ?? undefined,
    tourismTaxRegistrationNumber: settings.tourismTaxRegistration ?? undefined,
  };

  // Build customer
  const customer: Customer = {
    TIN: customerInfo.tin ?? "EI00000000010", // Generic TIN for unknown customers
    legalName: fields.clientDetails.name,
    identificationNumber: customerInfo.brn ?? "NA",
    identificationScheme: customerInfo.identificationScheme ?? "BRN",
    telephone: customerInfo.phone ?? "NA",
    address: clientAddress,
    electronicMail: customerInfo.email,
  };

  // Calculate line items
  const { lines, subtotal } = calculateLineItems(fields.items ?? []);

  // Calculate tax and discount
  const { taxAmount, discountAmount, taxSubtotals } = calculateBillingAdjustments(
    subtotal,
    fields.invoiceDetails.billingDetails
  );

  // Calculate totals
  const taxExclusiveAmount = subtotal.minus(discountAmount);
  const taxInclusiveAmount = taxExclusiveAmount.plus(taxAmount);

  const taxTotal: TaxTotal = {
    totalTaxAmount: taxAmount.toNumber(),
    taxSubtotals,
  };

  const legalMonetaryTotal: LegalMonetaryTotal = {
    lineExtensionAmount: subtotal.toNumber(),
    taxExclusiveAmount: taxExclusiveAmount.toNumber(),
    taxInclusiveAmount: taxInclusiveAmount.toNumber(),
    payableAmount: taxInclusiveAmount.toNumber(),
    allowanceTotalAmount: discountAmount.isPositive()
      ? discountAmount.toNumber()
      : undefined,
  };

  const invoiceDate = new Date(fields.invoiceDetails.date);

  return {
    id: `${fields.invoiceDetails.prefix}${fields.invoiceDetails.serialNumber}`,
    issueDate: formatDate(invoiceDate),
    issueTime: formatTime(invoiceDate),
    documentCurrencyCode: fields.invoiceDetails.currency ?? "MYR",
    supplier,
    customer,
    invoiceLines: lines,
    taxTotal,
    legalMonetaryTotal,
  };
}

/**
 * Transform invoice to credit note format
 * Credit notes require reference to the original invoice
 */
export function transformToCreditNote(
  invoice: InvoiceWithDetails,
  settings: EInvoiceSettings,
  originalInvoice: {
    id: string;
    uuid?: string;
    issueDate?: string;
  },
  customerDetails?: CustomerEInvoiceDetails
): CreditNoteDocument {
  const baseDoc = transformInvoiceToMyInvois(invoice, settings, customerDetails);

  const billingReferences: BillingReference[] = [
    {
      id: originalInvoice.id,
      uuid: originalInvoice.uuid,
      issueDate: originalInvoice.issueDate,
    },
  ];

  return {
    ...baseDoc,
    creditNoteLines: baseDoc.invoiceLines,
    billingReferences,
  } as CreditNoteDocument;
}

/**
 * Transform invoice to debit note format
 * Debit notes require reference to the original invoice
 */
export function transformToDebitNote(
  invoice: InvoiceWithDetails,
  settings: EInvoiceSettings,
  originalInvoice: {
    id: string;
    uuid?: string;
    issueDate?: string;
  },
  customerDetails?: CustomerEInvoiceDetails
): DebitNoteDocument {
  const baseDoc = transformInvoiceToMyInvois(invoice, settings, customerDetails);

  const billingReferences: BillingReference[] = [
    {
      id: originalInvoice.id,
      uuid: originalInvoice.uuid,
      issueDate: originalInvoice.issueDate,
    },
  ];

  return {
    ...baseDoc,
    debitNoteLines: baseDoc.invoiceLines,
    billingReferences,
  } as DebitNoteDocument;
}

/**
 * Validate invoice has required fields for e-invoice submission
 */
export function validateInvoiceForEInvoice(invoice: InvoiceWithDetails): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const fields = invoice.invoiceFields;

  if (!fields) {
    errors.push("Invoice has no fields");
    return { valid: false, errors };
  }

  if (!fields.companyDetails?.name) {
    errors.push("Company name is required");
  }
  if (!fields.companyDetails?.address) {
    errors.push("Company address is required");
  }
  if (!fields.clientDetails?.name) {
    errors.push("Client name is required");
  }
  if (!fields.clientDetails?.address) {
    errors.push("Client address is required");
  }
  if (!fields.invoiceDetails?.date) {
    errors.push("Invoice date is required");
  }
  if (!fields.invoiceDetails?.prefix || !fields.invoiceDetails?.serialNumber) {
    errors.push("Invoice number (prefix and serial) is required");
  }
  if (!fields.items || fields.items.length === 0) {
    errors.push("Invoice must have at least one line item");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate e-invoice settings
 */
export function validateEInvoiceSettings(settings: Partial<EInvoiceSettings>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!settings.tin) {
    errors.push("TIN (Tax Identification Number) is required");
  } else if (!/^[A-Z0-9]{10,14}$/.test(settings.tin)) {
    errors.push("TIN format is invalid");
  }

  if (!settings.brn) {
    errors.push("BRN (Business Registration Number) is required");
  }

  if (!settings.identificationScheme) {
    errors.push("Identification scheme is required");
  }

  if (!settings.msicCode) {
    errors.push("MSIC Code is required");
  } else if (!/^\d{5}$/.test(settings.msicCode)) {
    errors.push("MSIC Code must be 5 digits");
  }

  if (!settings.msicDescription) {
    errors.push("MSIC Description is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
