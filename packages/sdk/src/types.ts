/**
 * Open Bookkeeping SDK Type Definitions
 */

// ============================================================================
// Common Types
// ============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type DocumentStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "void";
export type InvoiceType = "invoice" | "proforma" | "tax_invoice";

// ============================================================================
// Invoice Types
// ============================================================================

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  accountId?: string;
  productId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: DocumentStatus;
  customerId: string;
  customerName?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  terms?: string;
  lineItems: InvoiceLineItem[];
  myInvoisUuid?: string;
  myInvoisStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  type?: InvoiceType;
  customerId: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  terms?: string;
  lineItems: Omit<InvoiceLineItem, "id" | "amount">[];
}

export interface UpdateInvoiceInput {
  invoiceNumber?: string;
  type?: InvoiceType;
  customerId?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
  terms?: string;
  status?: DocumentStatus;
  lineItems?: Omit<InvoiceLineItem, "id" | "amount">[];
}

export interface InvoiceFilters extends PaginationParams {
  status?: DocumentStatus;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

// ============================================================================
// Customer Types
// ============================================================================

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  isActive?: boolean;
}

export interface CustomerFilters extends PaginationParams {
  search?: string;
  isActive?: boolean;
}

// ============================================================================
// Vendor Types
// ============================================================================

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  paymentTerms?: string;
  bankName?: string;
  bankAccountNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  paymentTerms?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
  isActive?: boolean;
}

export interface VendorFilters extends PaginationParams {
  search?: string;
  isActive?: boolean;
}

// ============================================================================
// Quotation Types
// ============================================================================

export interface Quotation {
  id: string;
  quotationNumber: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  customerId: string;
  customerName?: string;
  issueDate: string;
  expiryDate: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  terms?: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationInput {
  quotationNumber: string;
  customerId: string;
  issueDate: string;
  expiryDate: string;
  currency?: string;
  notes?: string;
  terms?: string;
  lineItems: Omit<InvoiceLineItem, "id" | "amount">[];
}

export interface UpdateQuotationInput extends Partial<CreateQuotationInput> {
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired";
}

export interface QuotationFilters extends PaginationParams {
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

// ============================================================================
// Bill Types
// ============================================================================

export interface Bill {
  id: string;
  billNumber: string;
  vendorBillNumber?: string;
  status: DocumentStatus;
  vendorId: string;
  vendorName?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillInput {
  billNumber: string;
  vendorBillNumber?: string;
  vendorId: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  lineItems: Omit<InvoiceLineItem, "id" | "amount">[];
}

export interface UpdateBillInput extends Partial<CreateBillInput> {
  status?: DocumentStatus;
}

export interface BillFilters extends PaginationParams {
  status?: DocumentStatus;
  vendorId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

// ============================================================================
// Account (Chart of Accounts) Types
// ============================================================================

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype?: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  isSystemAccount: boolean;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  subtype?: string;
  description?: string;
  parentId?: string;
}

export interface UpdateAccountInput extends Partial<CreateAccountInput> {
  isActive?: boolean;
}

export interface AccountFilters extends PaginationParams {
  type?: AccountType;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// Product Types
// ============================================================================

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  category?: string;
  isActive: boolean;
  incomeAccountId?: string;
  expenseAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  sku?: string;
  name: string;
  description?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  category?: string;
  incomeAccountId?: string;
  expenseAccountId?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
}

export interface ProductFilters extends PaginationParams {
  category?: string;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// Company Profile Types
// ============================================================================

export interface CompanyProfile {
  id: string;
  name: string;
  registrationNumber?: string;
  taxId?: string;
  sstNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  defaultCurrency: string;
  fiscalYearStart: number;
  invoicePrefix?: string;
  invoiceNextNumber?: number;
  quotationPrefix?: string;
  quotationNextNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanyProfileInput {
  name?: string;
  registrationNumber?: string;
  taxId?: string;
  sstNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  defaultCurrency?: string;
  fiscalYearStart?: number;
  invoicePrefix?: string;
  invoiceNextNumber?: number;
  quotationPrefix?: string;
  quotationNextNumber?: number;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

export type WebhookEventType =
  | "invoice.created"
  | "invoice.updated"
  | "invoice.deleted"
  | "invoice.sent"
  | "invoice.paid"
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  | "vendor.created"
  | "vendor.updated"
  | "vendor.deleted"
  | "quotation.created"
  | "quotation.updated"
  | "quotation.deleted"
  | "quotation.accepted"
  | "bill.created"
  | "bill.updated"
  | "bill.deleted"
  | "bill.paid";

export interface WebhookPayload<T = Record<string, unknown>> {
  id: string;
  event: WebhookEventType;
  data: T;
  timestamp: string;
  apiVersion: string;
}

// ============================================================================
// SDK Configuration
// ============================================================================

export interface OpenBookkeepingConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  onError?: (error: OpenBookkeepingError) => void;
}

export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

// ============================================================================
// Error Types
// ============================================================================

export class OpenBookkeepingError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpenBookkeepingError";
  }
}

export class AuthenticationError extends OpenBookkeepingError {
  constructor(message: string = "Invalid or expired API key") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends OpenBookkeepingError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends OpenBookkeepingError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends OpenBookkeepingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends OpenBookkeepingError {
  constructor(
    public retryAfter?: number
  ) {
    super("Rate limit exceeded", "RATE_LIMIT_ERROR", 429);
    this.name = "RateLimitError";
  }
}
