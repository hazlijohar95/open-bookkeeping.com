export type VaultCategory =
  | "contracts"
  | "receipts"
  | "images"
  | "invoices"
  | "bills"
  | "statements"
  | "tax_documents"
  | "other";

export type ProcessingStatus =
  | "unprocessed"
  | "queued"
  | "processing"
  | "processed"
  | "failed";

export interface VaultDocumentTag {
  id: string;
  documentId: string;
  tag: string;
}

export interface VaultDocument {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  category: VaultCategory;
  mimeType: string;
  size: number;
  storagePath: string;
  storageBucket: string;
  publicUrl: string | null;
  processingStatus: ProcessingStatus;
  lastProcessedAt: Date | null;
  tags: VaultDocumentTag[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultCounts {
  all: number;
  contracts: number;
  receipts: number;
  images: number;
  invoices: number;
  bills: number;
  statements: number;
  tax_documents: number;
  other: number;
}

/**
 * Document types supported for extraction
 */
export type DocumentType = "bill" | "invoice" | "receipt" | "bank_statement" | "unknown";

/**
 * Extracted invoice/bill data structure
 */
export interface ExtractedInvoiceData {
  documentType?: DocumentType;
  vendor: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
    bankName?: string;
    bankAccountNumber?: string;
  };
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  tax?: number; // Legacy
  total?: number;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  paymentTerms?: string;
  notes?: string;
}

/**
 * Extracted bank statement data structure
 */
export interface ExtractedBankStatementData {
  documentType: "bank_statement";
  bankName: string;
  accountNumber?: string;
  accountHolderName?: string;
  statementPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
  transactions: Array<{
    date: string;
    description: string;
    reference?: string;
    debit?: number;
    credit?: number;
    balance?: number;
  }>;
}

/**
 * Extracted receipt data structure
 */
export interface ExtractedReceiptData {
  documentType: "receipt";
  vendor: {
    name: string;
    address?: string;
  };
  receiptNumber?: string;
  date?: string;
  paymentMethod?: string;
  currency?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
}

/**
 * Union type for all extracted document data
 */
export type ExtractedDocumentData =
  | ExtractedInvoiceData
  | ExtractedBankStatementData
  | ExtractedReceiptData;

/**
 * Suggested vendor updates when extracted data has additional info
 */
export interface SuggestedVendorUpdates {
  address?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface ProcessingResult {
  id: string;
  status: string;
  documentType: DocumentType;
  extractedData: ExtractedDocumentData | null;
  matchedVendor: { id: string; name: string; email?: string } | null;
  suggestedVendorUpdates?: SuggestedVendorUpdates;
  linkedBillId: string | null;
  confidenceScore: string | null;
  processingDurationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}
