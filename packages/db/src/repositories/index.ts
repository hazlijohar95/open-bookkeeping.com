export { customerRepository, type CustomerRepository } from "./customer.repository";
export { vendorRepository, type VendorRepository } from "./vendor.repository";
export { invoiceRepository, type InvoiceRepository, type InvoiceWithDetails } from "./invoice.repository";
export { quotationRepository, type QuotationRepository } from "./quotation.repository";
export { einvoiceRepository, type EInvoiceRepository } from "./einvoice.repository";
export { billRepository, type BillRepository } from "./bill.repository";
export { bankFeedRepository, type BankFeedRepository } from "./bankFeed.repository";
// Chart of Accounts - split into separate repositories
export {
  chartOfAccountsRepository,
  type ChartOfAccountsRepository,
  // New split repositories (preferred for new code)
  accountRepository,
  type AccountRepository,
  journalEntryRepository,
  type JournalEntryRepository,
  accountingReportRepository,
  type AccountingReportRepository,
} from "./chartOfAccounts.repository";

export type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQueryOptions,
} from "./customer.repository";

export type {
  CreateVendorInput,
  UpdateVendorInput,
  VendorQueryOptions,
} from "./vendor.repository";

export type {
  CreateInvoiceInput,
  InvoiceQueryOptions,
  InvoiceStatus,
  MetadataItem as InvoiceMetadataItem,
  BillingDetail as InvoiceBillingDetail,
  InvoiceItem,
} from "./invoice.repository";

export type {
  CreateQuotationInput,
  QuotationQueryOptions,
  QuotationStatus,
  MetadataItem as QuotationMetadataItem,
  BillingDetail as QuotationBillingDetail,
  QuotationItem,
} from "./quotation.repository";

export type {
  CreateEInvoiceSettingsInput,
  UpdateEInvoiceSettingsInput,
  CreateEInvoiceSubmissionInput,
  UpdateEInvoiceSubmissionInput,
} from "./einvoice.repository";

export type {
  CreateBillInput,
  UpdateBillInput,
  BillQueryOptions,
} from "./bill.repository";

export type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  CreateTransactionInput,
  UpdateTransactionMatchInput,
  TransactionQueryOptions,
} from "./bankFeed.repository";

export type {
  CreateAccountInput,
  UpdateAccountInput,
  AccountQueryOptions,
  CreateJournalEntryInput,
  JournalEntryLineInput,
  JournalEntryQueryOptions,
  AccountTreeNode,
} from "./chartOfAccounts.repository";

export { dashboardRepository, type DashboardRepository } from "./dashboard.repository";
export type {
  DashboardStats,
  InvoiceStatusBreakdown,
  TopCustomer,
} from "./dashboard.repository";

// Ledger System
export { ledgerRepository, type LedgerRepository } from "./ledger.repository";
export type {
  GeneralLedgerEntry,
  GeneralLedgerResult,
  GeneralLedgerOptions,
  TrialBalanceAccount,
  TrialBalanceResult,
  AccountWithBalance,
  ProfitLossResult,
  ProfitLossComparativeResult,
  BalanceSheetResult,
  BalanceSheetComparativeResult,
} from "./ledger.repository";

export { accountingPeriodRepository, type AccountingPeriodRepository } from "./accountingPeriod.repository";
export type {
  AccountingPeriodInfo,
  PeriodCloseResult,
  YearEndCloseResult,
} from "./accountingPeriod.repository";

// API Keys & Webhooks
export { apiKeyRepository, hashApiKey, type ApiKeyRepository } from "./apiKey.repository";
export type {
  CreateApiKeyInput,
  UpdateApiKeyInput,
  ApiKeyQueryOptions,
  UsageQueryOptions,
} from "./apiKey.repository";

export { webhookRepository, type WebhookRepository } from "./webhook.repository";
export type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookQueryOptions,
  DeliveryQueryOptions,
} from "./webhook.repository";

// Fixed Assets
export {
  fixedAssetRepository,
  fixedAssetCategoryRepository,
  type FixedAssetRepository,
  type FixedAssetCategoryRepository,
} from "./fixedAsset.repository";
export type {
  CreateFixedAssetInput,
  UpdateFixedAssetInput,
  FixedAssetQueryOptions,
  CreateFixedAssetCategoryInput,
  UpdateFixedAssetCategoryInput,
  DepreciationCalculation,
  CreateDisposalInput,
} from "./fixedAsset.repository";
