/**
 * Data Flow Explorer - Constants
 * Educational content, color mappings, and schema definitions
 */

import type {
  ActionEducation,
  EntityDefinition,
  FlowCategory,
  TimeRange,
} from "./data-flow-types";

// Re-export types for convenience
export type { EntityDefinition };

// ============================================
// TIME RANGES
// ============================================

export const TIME_RANGES: TimeRange[] = [
  { label: "5 min", value: "5m", minutes: 5 },
  { label: "15 min", value: "15m", minutes: 15 },
  { label: "1 hour", value: "1h", minutes: 60 },
  { label: "6 hours", value: "6h", minutes: 360 },
  { label: "24 hours", value: "24h", minutes: 1440 },
];

// ============================================
// SOURCE COLORS & LABELS
// ============================================

export const SOURCE_CONFIG = {
  agent: {
    label: "AI Co-Worker",
    color: "hsl(var(--chart-1))", // Purple
    hexColor: "#a855f7",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    textColor: "text-violet-700 dark:text-violet-300",
    icon: "SparklesIcon",
  },
  user: {
    label: "User Action",
    color: "hsl(var(--chart-2))", // Blue
    hexColor: "#3b82f6",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-700 dark:text-blue-300",
    icon: "UserIcon",
  },
  admin: {
    label: "Admin",
    color: "hsl(var(--chart-3))", // Red/Orange
    hexColor: "#ef4444",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-700 dark:text-orange-300",
    icon: "ShieldIcon",
  },
} as const;

// ============================================
// CATEGORY COLORS
// ============================================

export const CATEGORY_CONFIG: Record<
  FlowCategory,
  { label: string; color: string; hexColor: string; bgColor: string }
> = {
  sources: {
    label: "Sources",
    color: "hsl(var(--chart-1))",
    hexColor: "#94a3b8",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  sales: {
    label: "Sales",
    color: "hsl(142 76% 36%)", // Emerald
    hexColor: "#10b981",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  purchases: {
    label: "Purchases",
    color: "hsl(217 91% 60%)", // Blue
    hexColor: "#3b82f6",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  accounting: {
    label: "Accounting",
    color: "hsl(262 83% 58%)", // Violet
    hexColor: "#8b5cf6",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
  contacts: {
    label: "Contacts",
    color: "hsl(38 92% 50%)", // Amber
    hexColor: "#f59e0b",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  destinations: {
    label: "Destinations",
    color: "hsl(var(--chart-5))",
    hexColor: "#6b7280",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
};

// ============================================
// ACTION EDUCATION
// ============================================

export const ACTION_EDUCATION: Record<string, ActionEducation> = {
  // Invoice Actions
  create_invoice: {
    name: "Create Invoice",
    description: "Creates a new sales invoice for a customer",
    dataImpact: [
      "New row in invoices table",
      "Line items stored in invoice_items",
      "Customer reference linked",
      "When posted: Journal entry created",
    ],
    financialEffect: "Increases Accounts Receivable (Asset) and Revenue",
    relatedTables: ["invoices", "invoice_items", "customers", "journal_entries"],
    accountingEntry: {
      debits: ["Accounts Receivable (1200)"],
      credits: ["Sales Revenue (4000)", "SST Payable (2100) if applicable"],
    },
  },
  update_invoice: {
    name: "Update Invoice",
    description: "Modifies an existing invoice",
    dataImpact: [
      "Invoice record updated",
      "Line items may be modified",
      "History tracked in audit log",
    ],
    financialEffect: "May affect AR balance and revenue recognition",
    relatedTables: ["invoices", "invoice_items"],
  },
  send_invoice: {
    name: "Send Invoice",
    description: "Sends invoice to customer via email",
    dataImpact: [
      "Status changed to 'sent'",
      "Sent timestamp recorded",
      "Email delivery logged",
    ],
    relatedTables: ["invoices"],
  },
  mark_invoice_paid: {
    name: "Mark Invoice Paid",
    description: "Records payment receipt for an invoice",
    dataImpact: [
      "Status changed to 'paid'",
      "Payment record created",
      "Journal entry for payment",
    ],
    financialEffect: "Decreases AR, Increases Cash/Bank",
    relatedTables: ["invoices", "payments", "journal_entries"],
    accountingEntry: {
      debits: ["Cash/Bank (1000)"],
      credits: ["Accounts Receivable (1200)"],
    },
  },
  void_invoice: {
    name: "Void Invoice",
    description: "Cancels an invoice, reversing its financial effect",
    dataImpact: [
      "Status changed to 'void'",
      "Reversing journal entry created",
      "Cannot be undone",
    ],
    financialEffect: "Reverses AR and Revenue entries",
    relatedTables: ["invoices", "journal_entries"],
  },

  // Bill Actions
  create_bill: {
    name: "Create Bill",
    description: "Records a purchase bill from a vendor",
    dataImpact: [
      "New row in bills table",
      "Line items stored",
      "Vendor reference linked",
    ],
    financialEffect: "Increases Accounts Payable (Liability) and Expense",
    relatedTables: ["bills", "bill_items", "vendors", "journal_entries"],
    accountingEntry: {
      debits: ["Expense Account (varies)", "SST Input (if applicable)"],
      credits: ["Accounts Payable (2000)"],
    },
  },
  update_bill: {
    name: "Update Bill",
    description: "Modifies an existing bill",
    dataImpact: ["Bill record updated", "Line items may change"],
    relatedTables: ["bills", "bill_items"],
  },
  mark_bill_paid: {
    name: "Mark Bill Paid",
    description: "Records payment made to a vendor",
    dataImpact: [
      "Status changed to 'paid'",
      "Payment record created",
      "Journal entry for payment",
    ],
    financialEffect: "Decreases AP and Cash/Bank",
    relatedTables: ["bills", "payments", "journal_entries"],
    accountingEntry: {
      debits: ["Accounts Payable (2000)"],
      credits: ["Cash/Bank (1000)"],
    },
  },

  // Journal Entry Actions
  create_journal_entry: {
    name: "Create Journal Entry",
    description: "Creates a manual journal entry",
    dataImpact: [
      "Header row in journal_entries",
      "Debit/credit lines in journal_entry_lines",
      "Must balance (debits = credits)",
    ],
    financialEffect: "Depends on accounts used",
    relatedTables: ["journal_entries", "journal_entry_lines", "accounts"],
  },
  post_journal_entry: {
    name: "Post Journal Entry",
    description: "Finalizes entry and updates the general ledger",
    dataImpact: [
      "Status changed to 'posted'",
      "Ledger transactions created",
      "Account balances updated",
      "Cannot be edited after posting",
    ],
    financialEffect: "Updates all affected account balances",
    relatedTables: ["journal_entries", "ledger_transactions", "account_balances"],
  },
  reverse_journal_entry: {
    name: "Reverse Journal Entry",
    description: "Creates a reversing entry to undo a posted entry",
    dataImpact: [
      "New journal entry with opposite debits/credits",
      "Original entry marked as reversed",
      "Links to original for audit trail",
    ],
    financialEffect: "Reverses all account balance changes",
    relatedTables: ["journal_entries", "ledger_transactions"],
  },

  // Quotation Actions
  create_quotation: {
    name: "Create Quotation",
    description: "Creates a price quotation for a potential customer",
    dataImpact: ["New row in quotations", "Line items stored"],
    financialEffect: "No financial effect until converted to invoice",
    relatedTables: ["quotations", "quotation_items", "customers"],
  },
  convert_quotation: {
    name: "Convert Quotation",
    description: "Converts an accepted quotation to an invoice",
    dataImpact: [
      "Quotation marked as converted",
      "New invoice created from quotation data",
      "Link maintained between quotation and invoice",
    ],
    financialEffect: "Creates AR and Revenue (via invoice)",
    relatedTables: ["quotations", "invoices"],
  },

  // Contact Actions
  create_customer: {
    name: "Create Customer",
    description: "Adds a new customer to the directory",
    dataImpact: ["New row in customers table", "Available for invoicing"],
    relatedTables: ["customers"],
  },
  create_vendor: {
    name: "Create Vendor",
    description: "Adds a new vendor/supplier to the directory",
    dataImpact: ["New row in vendors table", "Available for bill entry"],
    relatedTables: ["vendors"],
  },

  // Read Actions
  read_data: {
    name: "Read Data",
    description: "Retrieves data from the system",
    dataImpact: ["No data modification", "Access logged for security"],
    relatedTables: [],
  },
  analyze_data: {
    name: "Analyze Data",
    description: "AI performs analysis on financial data",
    dataImpact: ["No data modification", "Insights generated"],
    relatedTables: [],
  },
};

// ============================================
// ENTITY DEFINITIONS
// ============================================

export const ENTITY_DEFINITIONS: EntityDefinition[] = [
  // Sales Entities
  {
    id: "invoices",
    displayName: "Invoices",
    tableName: "invoices_v2",
    category: "sales",
    description: "Sales invoices sent to customers",
    relations: [
      { target: "customers", type: "belongs_to", label: "Customer" },
      { target: "invoice_items", type: "has_many", label: "Line Items" },
      { target: "payments", type: "has_many", label: "Payments" },
      { target: "journal_entries", type: "creates", label: "Auto-posts" },
    ],
    education: {
      whatItDoes: "Tracks money owed to you by customers (Accounts Receivable)",
      dataFlow: "Invoice Created → Posted → Journal Entry → Ledger → Reports",
      relatedReports: ["Profit & Loss", "Aging Report", "AR Summary"],
      examples: ["INV-001 for RM 5,000 to ABC Corp"],
    },
  },
  {
    id: "quotations",
    displayName: "Quotations",
    tableName: "quotations_v2",
    category: "sales",
    description: "Price quotations for potential sales",
    relations: [
      { target: "customers", type: "belongs_to", label: "Customer" },
      { target: "quotation_items", type: "has_many", label: "Line Items" },
      { target: "invoices", type: "creates", label: "Converts to" },
    ],
    education: {
      whatItDoes: "Provides price estimates to customers before sale",
      dataFlow: "Quotation → Accepted → Converted to Invoice",
      relatedReports: ["Quotation Conversion Rate"],
    },
  },
  {
    id: "credit_notes",
    displayName: "Credit Notes",
    tableName: "credit_notes",
    category: "sales",
    description: "Credits issued to customers (returns, discounts)",
    relations: [
      { target: "invoices", type: "references", label: "Original Invoice" },
      { target: "customers", type: "belongs_to", label: "Customer" },
    ],
    education: {
      whatItDoes: "Reduces amount owed by customer",
      dataFlow: "Credit Note → Journal Entry (reverse of invoice)",
      relatedReports: ["AR Aging", "Credit Note Report"],
    },
  },

  // Purchase Entities
  {
    id: "bills",
    displayName: "Bills",
    tableName: "bills",
    category: "purchases",
    description: "Purchase bills from vendors",
    relations: [
      { target: "vendors", type: "belongs_to", label: "Vendor" },
      { target: "bill_items", type: "has_many", label: "Line Items" },
      { target: "payments", type: "has_many", label: "Payments" },
      { target: "journal_entries", type: "creates", label: "Auto-posts" },
    ],
    education: {
      whatItDoes: "Tracks money you owe to vendors (Accounts Payable)",
      dataFlow: "Bill Created → Posted → Journal Entry → Ledger → Reports",
      relatedReports: ["Profit & Loss", "AP Aging", "Expense Report"],
    },
  },

  // Accounting Entities
  {
    id: "accounts",
    displayName: "Chart of Accounts",
    tableName: "accounts",
    category: "accounting",
    description: "Categories for organizing financial transactions",
    relations: [
      { target: "journal_entry_lines", type: "has_many", label: "Transactions" },
      { target: "account_balances", type: "has_many", label: "Balances" },
    ],
    education: {
      whatItDoes: "Provides the structure for all financial tracking",
      dataFlow: "Account → Journal Lines → Balances → Reports",
      relatedReports: ["Trial Balance", "Balance Sheet", "P&L"],
      examples: ["1000 Cash", "1200 Accounts Receivable", "4000 Sales Revenue"],
    },
  },
  {
    id: "journal_entries",
    displayName: "Journal Entries",
    tableName: "journal_entries",
    category: "accounting",
    description: "Double-entry accounting records",
    relations: [
      { target: "journal_entry_lines", type: "has_many", label: "Lines" },
      { target: "ledger_transactions", type: "creates", label: "Ledger" },
      { target: "invoices", type: "references", label: "Source Document" },
    ],
    education: {
      whatItDoes: "Records financial transactions with debits and credits",
      dataFlow: "Entry Created → Posted → Ledger Transactions → Account Balances",
      relatedReports: ["General Ledger", "Trial Balance"],
      examples: ["JE-001: Debit AR 1000, Credit Revenue 1000"],
    },
  },
  {
    id: "ledger_transactions",
    displayName: "Ledger Transactions",
    tableName: "ledger_transactions",
    category: "accounting",
    description: "Denormalized view of all posted transactions",
    relations: [
      { target: "journal_entries", type: "belongs_to", label: "Source Entry" },
      { target: "accounts", type: "belongs_to", label: "Account" },
    ],
    education: {
      whatItDoes: "Fast access to transaction history by account",
      dataFlow: "Journal Entry Posted → Ledger Transaction Created",
      relatedReports: ["General Ledger", "Account History"],
    },
  },

  // Contact Entities
  {
    id: "customers",
    displayName: "Customers",
    tableName: "customers",
    category: "contacts",
    description: "People or companies you sell to",
    relations: [
      { target: "invoices", type: "has_many", label: "Invoices" },
      { target: "quotations", type: "has_many", label: "Quotations" },
      { target: "payments", type: "has_many", label: "Payments" },
    ],
    education: {
      whatItDoes: "Stores contact and billing information for customers",
      dataFlow: "Customer → Quotations/Invoices → Payments",
      relatedReports: ["Customer Statement", "AR Aging by Customer"],
    },
  },
  {
    id: "vendors",
    displayName: "Vendors",
    tableName: "vendors",
    category: "contacts",
    description: "Suppliers you purchase from",
    relations: [
      { target: "bills", type: "has_many", label: "Bills" },
      { target: "payments", type: "has_many", label: "Payments" },
    ],
    education: {
      whatItDoes: "Stores contact and payment information for vendors",
      dataFlow: "Vendor → Bills → Payments",
      relatedReports: ["Vendor Statement", "AP Aging by Vendor"],
    },
  },
];

// ============================================
// RESOURCE TYPE MAPPING
// ============================================

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  bill: "Bill",
  journal_entry: "Journal Entry",
  customer: "Customer",
  vendor: "Vendor",
  payment: "Payment",
  account: "Account",
  settings: "Settings",
  user: "User",
  organization: "Organization",
};

// ============================================
// FLOW NODE DEFINITIONS (for Sankey)
// ============================================

export const FLOW_NODES = {
  // Sources
  sources: [
    { id: "agent", name: "AI Co-Worker", category: "sources" as FlowCategory },
    { id: "user", name: "User Actions", category: "sources" as FlowCategory },
    { id: "import", name: "Data Import", category: "sources" as FlowCategory },
  ],
  // Resource Types
  resources: [
    { id: "invoices", name: "Invoices", category: "sales" as FlowCategory },
    { id: "quotations", name: "Quotations", category: "sales" as FlowCategory },
    { id: "bills", name: "Bills", category: "purchases" as FlowCategory },
    { id: "journal_entries", name: "Journal Entries", category: "accounting" as FlowCategory },
    { id: "customers", name: "Customers", category: "contacts" as FlowCategory },
    { id: "vendors", name: "Vendors", category: "contacts" as FlowCategory },
  ],
  // Destinations
  destinations: [
    { id: "ledger", name: "General Ledger", category: "destinations" as FlowCategory },
    { id: "reports", name: "Financial Reports", category: "destinations" as FlowCategory },
    { id: "einvoice", name: "E-Invoice (LHDN)", category: "destinations" as FlowCategory },
  ],
};
