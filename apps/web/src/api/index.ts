/**
 * API Hooks Index
 * Central export for all REST API hooks
 *
 * Migration from tRPC:
 * - Old: import { trpc } from "@/trpc/provider"
 *        trpc.customer.list.useQuery()
 *
 * - New: import { useCustomers } from "@/api"
 *        useCustomers()
 */

// Base client
export { api, apiRequest, ApiError, API_BASE_URL } from "@/lib/api-client";
export type { PaginatedResponse, PaginationParams } from "@/lib/api-client";

// Customers
export {
  useCustomers,
  useCustomer,
  useSearchCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  customerKeys,
} from "./customers";
export type { CreateCustomerInput, UpdateCustomerInput } from "./customers";

// Vendors
export {
  useVendors,
  useVendor,
  useSearchVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  vendorKeys,
} from "./vendors";
export type { CreateVendorInput, UpdateVendorInput } from "./vendors";

// Invoices
export {
  useInvoices,
  useInvoicesLight,
  useInvoice,
  useInvoicesByCustomer,
  useUnpaidInvoices,
  useAgingReport,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  invoiceKeys,
} from "./invoices";
export type {
  Invoice,
  InvoiceLightItem,
  InvoiceListParams,
  CreateInvoiceInput,
  UpdateInvoiceStatusInput,
  AgingReport,
} from "./invoices";

// Bills
export {
  useBills,
  useBill,
  useBillsByVendor,
  useUnpaidBills,
  useBillAgingReport,
  useCreateBill,
  useUpdateBill,
  useUpdateBillStatus,
  useDeleteBill,
  billKeys,
} from "./bills";
export type {
  Bill,
  BillItem,
  BillItemInput,
  BillListParams,
  CreateBillInput,
  UpdateBillInput,
  UpdateBillStatusInput,
  BillAgingReport,
} from "./bills";

// Quotations
export {
  useQuotations,
  useQuotation,
  useQuotationsByCustomer,
  useCreateQuotation,
  useUpdateQuotationStatus,
  useConvertToInvoice,
  useDeleteQuotation,
  quotationKeys,
} from "./quotations";
export type {
  Quotation,
  QuotationListParams,
  CreateQuotationInput,
  UpdateQuotationStatusInput,
  ConvertToInvoiceInput,
} from "./quotations";

// Dashboard
export {
  useDashboardStats,
  useInvoiceStatusDistribution,
  useRevenueChart,
  useTopCustomers,
  useRecentInvoices,
  useRebuildAggregations,
  dashboardKeys,
} from "./dashboard";
export type {
  DashboardStats,
  StatusBreakdown,
  RevenueChartData,
  TopCustomer,
  RecentInvoice,
} from "./dashboard";

// Settings
export {
  useSettings,
  useUpdateSettings,
  useUpdateCompanyProfile,
  useUpdateInvoiceDefaults,
  useUpdateNotificationSettings,
  useUpdateAppearanceSettings,
  settingsKeys,
} from "./settings";
export type {
  UserSettings,
  CompanyProfileInput,
  InvoiceDefaultsInput,
  NotificationSettingsInput,
  AppearanceSettingsInput,
} from "./settings";

// E-Invoice
export {
  useEInvoiceSettings,
  useUpdateEInvoiceSettings,
  useValidateEInvoiceSettings,
  useSubmitInvoice,
  useSubmitCreditNote,
  useSubmitDebitNote,
  useBulkSubmit,
  useCancelDocument,
  useSubmissionHistory,
  useValidateInvoice,
  useSubmissionStatus,
  useDocumentDetails,
  einvoiceKeys,
} from "./einvoice";
export type {
  EInvoiceSettings,
  EInvoiceSettingsInput,
  SettingsValidation,
  CustomerEInvoiceDetails,
  SubmitInvoiceInput,
  SubmitCreditNoteInput,
  SubmitDebitNoteInput,
  SubmissionResult,
  BulkSubmitInput,
  BulkSubmitResult,
  EInvoiceSubmission,
  InvoiceValidation,
} from "./einvoice";

// SST
export {
  useSSTRatePresets,
  useBusinessCategories,
  useSSTSummary,
  useSSTTrendChart,
  useSSTTransactions,
  useSST02Return,
  useAvailablePeriods,
  useReturnSubmissions,
  useSaveReturnSubmission,
  useComplianceStatus,
  useUpdateComplianceSettings,
  sstKeys,
} from "./sst";
export type {
  SSTRatePreset,
  BusinessCategory,
  SummaryParams,
  SSTSummary,
  TrendChartData,
  TransactionParams as SSTTransactionParams,
  SSTTransaction,
  TransactionsResponse as SSTTransactionsResponse,
  SST02Return,
  ReturnSubmission,
  SaveReturnInput,
  ComplianceStatus,
  ComplianceSettingsInput,
} from "./sst";

// Vault
export {
  useVaultDocuments,
  useVaultDocument,
  useSearchVaultDocuments,
  useDocumentCounts,
  useUploadDocument,
  useRenameDocument,
  useUpdateDocumentTags,
  useChangeDocumentCategory,
  useDeleteDocument,
  useProcessingAvailable,
  useProcessDocument,
  useProcessingResult,
  useProcessingHistory,
  useCreateBillFromDocument,
  useVendorsForMatching,
  vaultKeys,
} from "./vault";
export type {
  DocumentCategory,
  VaultDocument,
  UploadDocumentInput,
  DocumentCounts,
  ProcessingResult,
  ProcessingJob,
  VendorForMatching,
} from "./vault";

// Storage
export {
  useStorageImages,
  useLogos,
  useSignatures,
  useUploadImage,
  useDeleteImage,
  storageKeys,
} from "./storage";
export type { StorageImage, UploadImageInput, UploadResult } from "./storage";

// Bank Feed
export {
  useBankAccounts,
  useBankAccount,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  useTransactions,
  useTransaction,
  useUnmatchedTransactions,
  useCreateTransaction,
  useImportTransactions,
  useUpdateTransactionMatch,
  useReconcileTransaction,
  useAcceptSuggestion,
  useRejectSuggestion,
  useBankFeedCategories,
  useCreateCategory,
  useMatchingRules,
  useCreateRule,
  useDeleteRule,
  useBankFeedStats,
  useMatchSuggestions,
  useApplyMatch,
  useAutoMatch,
  bankFeedKeys,
} from "./bank-feed";
export type {
  BankAccount,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  TransactionParams as BankTransactionParams,
  BankTransaction,
  CreateTransactionInput,
  ImportTransactionsInput,
  ImportResult,
  UpdateMatchInput,
  BankFeedCategory,
  CreateCategoryInput,
  MatchingRule,
  CreateRuleInput,
  BankFeedStats,
  MatchSuggestion,
  ApplyMatchInput,
  AutoMatchResult,
} from "./bank-feed";

// Chart of Accounts
export {
  useCheckHasAccounts,
  useAccountTree,
  useAccountSummary,
  useSearchAccounts,
  useAccount,
  useAccountBalance,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useInitializeDefaults,
  useTrialBalance,
  useJournalEntries,
  useJournalEntry,
  useCreateJournalEntry,
  usePostJournalEntry,
  useReverseJournalEntry,
  chartOfAccountsKeys,
} from "./chart-of-accounts";
export type {
  Account,
  AccountSummary,
  CreateAccountInput,
  UpdateAccountInput,
  JournalEntryLine,
  CreateJournalEntryInput,
  JournalEntry,
  JournalEntryLineWithAccount,
  JournalEntryFilters,
  AccountBalance,
  TrialBalanceEntry,
  TrialBalanceReport,
} from "./chart-of-accounts";
