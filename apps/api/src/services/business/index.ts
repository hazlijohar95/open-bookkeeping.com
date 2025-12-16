/**
 * Business Services
 *
 * Centralized business logic layer for all domain operations.
 * Both REST routes and tRPC services should use these services.
 *
 * Each business service:
 * - Handles core CRUD operations via repositories
 * - Dispatches webhooks (non-blocking)
 * - Creates journal entries when applicable (non-blocking)
 * - Updates aggregations (non-blocking with retry)
 * - Provides structured logging
 * - Enforces business rules
 */

// Invoice (uses V2 schema)
export {
  invoiceBusiness,
  type InvoiceBusiness,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type InvoiceBusinessContext,
} from "./invoice.business";

// Bill (Accounts Payable)
export {
  billBusiness,
  type BillBusiness,
  type CreateBillInput,
  type UpdateBillInput,
  type BillItem,
  type BillBusinessContext,
} from "./bill.business";

// Quotation (uses V1 schema - TODO: migrate to V2)
export {
  quotationBusiness,
  type QuotationBusiness,
  type CreateQuotationInput,
  type QuotationItem,
  type QuotationBusinessContext,
} from "./quotation.business";

// Customer
export {
  customerBusiness,
  type CustomerBusiness,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerBusinessContext,
} from "./customer.business";

// Vendor
export {
  vendorBusiness,
  type VendorBusiness,
  type CreateVendorInput,
  type UpdateVendorInput,
  type VendorBusinessContext,
} from "./vendor.business";

// Credit Note (uses V1 schema - TODO: migrate to V2)
export {
  creditNoteBusiness,
  type CreditNoteBusiness,
  type CreateCreditNoteInput,
  type CreditNoteBusinessContext,
} from "./credit-note.business";

// Debit Note (uses V1 schema - TODO: migrate to V2)
export {
  debitNoteBusiness,
  type DebitNoteBusiness,
  type CreateDebitNoteInput,
  type DebitNoteBusinessContext,
} from "./debit-note.business";
