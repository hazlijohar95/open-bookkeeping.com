import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================
// ENUMS
// ============================================

// Company type (Malaysian business structures)
export const companyTypeEnum = pgEnum("company_type", [
  "sole_proprietorship", // Sole proprietor (Enterprise)
  "partnership", // Partnership
  "llp", // Limited Liability Partnership (PLT)
  "sdn_bhd", // Sendirian Berhad (Private Limited)
  "bhd", // Berhad (Public Limited)
  "npo", // Non-Profit Organization / Society
  "cooperative", // Koperasi / Cooperative
  "government", // Government agency
  "branch", // Foreign company branch in Malaysia
  "representative", // Representative office
  "other",
]);

// Business size based on SME Corp Malaysia definitions
export const businessSizeEnum = pgEnum("business_size_enum", [
  "micro", // <5 employees OR <RM300K revenue
  "small", // 5-30 employees OR RM300K-3M revenue
  "medium", // 31-75 employees OR RM3M-20M revenue
  "large", // >75 employees OR >RM20M revenue
]);

// SST registration status
export const sstStatusEnum = pgEnum("sst_status_enum", [
  "not_registered", // Below threshold, not registered
  "registered", // Mandatory registration (above threshold)
  "voluntary", // Voluntary registration (below threshold)
  "exempt", // Exempt from SST
  "deregistered", // Previously registered, now deregistered
]);

// Accounting method
export const accountingMethodEnum = pgEnum("accounting_method_enum", [
  "cash", // Cash basis - record when paid/received
  "accrual", // Accrual basis - record when earned/incurred
]);

// Migration source systems
export const migrationSourceEnum = pgEnum("migration_source_enum", [
  "none", // Fresh start, no migration
  "quickbooks", // QuickBooks Desktop or Online
  "xero", // Xero
  "sage", // Sage 50 or Sage Business Cloud
  "myob", // MYOB
  "wave", // Wave Accounting
  "zoho_books", // Zoho Books
  "freshbooks", // FreshBooks
  "sql_accounting", // SQL Accounting (Malaysia)
  "autocount", // AutoCount (Malaysia)
  "ubs", // UBS Accounting (Malaysia)
  "million", // Million Accounting (Malaysia)
  "spreadsheet", // Excel/Google Sheets
  "manual", // Manual paper-based system
  "other", // Other software
]);

// Chart of Accounts template preference
export const coaTemplateEnum = pgEnum("coa_template_enum", [
  "malaysian_sme", // Standard Malaysian SME chart
  "malaysian_services", // Services company template
  "malaysian_trading", // Trading/retail template
  "malaysian_manufacturing", // Manufacturing template
  "malaysian_fnb", // Food & Beverage template
  "custom", // User will create custom
  "import", // Import from previous system
]);

// ============================================
// TYPES
// ============================================

// Bank account structure for JSONB storage
export interface BankAccountInfo {
  id: string;
  bankName: string;
  bankCode?: string; // Swift code for local banks
  accountNumber: string;
  accountName: string;
  accountType: "current" | "savings" | "fixed_deposit";
  currency: string;
  swiftCode?: string;
  isDefault: boolean;
  linkedGLAccountId?: string;
}

// Contact person structure
export interface ContactPerson {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

// ============================================
// COMPANY PROFILES TABLE
// ============================================

/**
 * Comprehensive company profile for users.
 * Consolidates all business context needed for:
 * - AI agent context
 * - Invoice/document generation
 * - Tax compliance (SST, e-Invoice)
 * - Payroll statutory requirements
 * - Migration from other systems
 */
export const companyProfiles = pgTable("company_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),

  // ==========================================
  // LEGAL IDENTITY
  // ==========================================
  legalName: varchar("legal_name", { length: 255 }), // Official registered name
  tradeName: varchar("trade_name", { length: 255 }), // Trading/DBA name
  companyType: companyTypeEnum("company_type"),
  registrationNumber: varchar("registration_number", { length: 50 }), // SSM/ROC/ROB number
  oldRegistrationNumber: varchar("old_registration_number", { length: 50 }), // Old format (pre-2019)
  dateOfIncorporation: date("date_of_incorporation"),

  // ==========================================
  // STRUCTURED ADDRESS (for e-Invoice compliance)
  // ==========================================
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  addressLine3: varchar("address_line_3", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postcode: varchar("postcode", { length: 10 }),
  state: varchar("state", { length: 100 }),
  stateCode: varchar("state_code", { length: 2 }), // MY state codes: 01-16
  country: varchar("country", { length: 2 }).default("MY"),

  // ==========================================
  // CONTACT INFORMATION
  // ==========================================
  primaryPhone: varchar("primary_phone", { length: 20 }),
  secondaryPhone: varchar("secondary_phone", { length: 20 }),
  primaryEmail: varchar("primary_email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  contactPersons: jsonb("contact_persons").$type<ContactPerson[]>(),

  // ==========================================
  // BUSINESS CLASSIFICATION
  // ==========================================
  msicCode: varchar("msic_code", { length: 5 }), // Malaysian Standard Industrial Classification
  msicDescription: varchar("msic_description", { length: 255 }),
  industryType: varchar("industry_type", { length: 100 }), // User-friendly industry name
  businessSize: businessSizeEnum("business_size"),
  natureOfBusiness: text("nature_of_business"), // Detailed description of activities
  mainProducts: text("main_products"), // Main products/services offered
  annualRevenueRange: varchar("annual_revenue_range", { length: 50 }), // For SST threshold tracking

  // ==========================================
  // ACCOUNTING SETTINGS
  // ==========================================
  accountingMethod:
    accountingMethodEnum("accounting_method").default("accrual"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").default(1), // 1-12
  fiscalYearStartDay: integer("fiscal_year_start_day").default(1), // 1-31
  defaultCurrency: varchar("default_currency", { length: 3 }).default("MYR"),
  multiCurrencyEnabled: boolean("multi_currency_enabled").default(false),
  chartOfAccountsTemplate: coaTemplateEnum("coa_template"),

  // ==========================================
  // TAX IDENTIFICATION (Malaysian)
  // ==========================================
  tinNumber: varchar("tin_number", { length: 20 }), // LHDN Tax Identification Number
  sstStatus: sstStatusEnum("sst_status").default("not_registered"),
  sstRegistrationNumber: varchar("sst_registration_number", { length: 50 }),
  sstRegistrationDate: date("sst_registration_date"),
  sstDeregistrationDate: date("sst_deregistration_date"),
  tourismTaxNumber: varchar("tourism_tax_number", { length: 50 }), // TTx registration

  // ==========================================
  // E-INVOICE (MyInvois) SETTINGS
  // ==========================================
  einvoiceEnabled: boolean("einvoice_enabled").default(false),
  einvoiceEffectiveDate: date("einvoice_effective_date"),
  einvoiceTin: varchar("einvoice_tin", { length: 20 }), // May differ from company TIN
  einvoiceBrn: varchar("einvoice_brn", { length: 30 }), // Business Registration Number for e-Invoice

  // ==========================================
  // EMPLOYER STATUTORY REGISTRATIONS (Payroll)
  // ==========================================
  epfEmployerNumber: varchar("epf_employer_number", { length: 20 }),
  socsoEmployerNumber: varchar("socso_employer_number", { length: 20 }),
  eisEmployerNumber: varchar("eis_employer_number", { length: 20 }),
  hrdfLevyNumber: varchar("hrdf_levy_number", { length: 20 }),
  pcbFileNumber: varchar("pcb_file_number", { length: 20 }),

  // ==========================================
  // BANKING DETAILS
  // ==========================================
  bankAccounts: jsonb("bank_accounts").$type<BankAccountInfo[]>(),

  // ==========================================
  // BRANDING
  // ==========================================
  logoUrl: text("logo_url"),
  logoBase64: text("logo_base64"), // For offline/local use
  signatureUrl: text("signature_url"),
  signatureBase64: text("signature_base64"),
  brandPrimaryColor: varchar("brand_primary_color", { length: 7 }), // Hex color
  brandSecondaryColor: varchar("brand_secondary_color", { length: 7 }),

  // ==========================================
  // DOCUMENT DEFAULTS
  // ==========================================
  invoicePrefix: varchar("invoice_prefix", { length: 10 }).default("INV-"),
  quotationPrefix: varchar("quotation_prefix", { length: 10 }).default("QT-"),
  creditNotePrefix: varchar("credit_note_prefix", { length: 10 }).default(
    "CN-"
  ),
  debitNotePrefix: varchar("debit_note_prefix", { length: 10 }).default("DN-"),
  billPrefix: varchar("bill_prefix", { length: 10 }).default("BILL-"),
  defaultPaymentTerms: varchar("default_payment_terms", { length: 100 }),
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(30),
  invoiceNotes: text("invoice_notes"), // Default notes on invoices
  invoiceTerms: text("invoice_terms"), // Default terms & conditions
  quotationNotes: text("quotation_notes"),
  quotationTerms: text("quotation_terms"),
  quotationValidityDays: integer("quotation_validity_days").default(30),

  // ==========================================
  // MIGRATION CONTEXT
  // ==========================================
  migrationSource: migrationSourceEnum("migration_source").default("none"),
  migrationSourceOther: varchar("migration_source_other", { length: 100 }), // If "other"
  migrationDate: date("migration_date"), // Cutover date
  openingBalanceDate: date("opening_balance_date"), // Trial balance as-of date
  migrationNotes: text("migration_notes"), // User notes about migration
  previousFiscalYearEnd: date("previous_fiscal_year_end"), // Last completed FY in old system
  hasPendingMigration: boolean("has_pending_migration").default(false),

  // ==========================================
  // ONBOARDING & PROFILE STATUS
  // ==========================================
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  onboardingSkipped: boolean("onboarding_skipped").default(false),
  onboardingSkippedAt: timestamp("onboarding_skipped_at"),
  profileCompleteness: integer("profile_completeness").default(0), // 0-100%
  lastProfileUpdateAt: timestamp("last_profile_update_at"),

  // ==========================================
  // TIMESTAMPS
  // ==========================================
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// RELATIONS
// ============================================

export const companyProfilesRelations = relations(
  companyProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [companyProfiles.userId],
      references: [users.id],
    }),
  })
);

// ============================================
// TYPES
// ============================================

export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;
export type CompanyType = (typeof companyTypeEnum.enumValues)[number];
export type BusinessSize = (typeof businessSizeEnum.enumValues)[number];
export type SstStatus = (typeof sstStatusEnum.enumValues)[number];
export type AccountingMethod = (typeof accountingMethodEnum.enumValues)[number];
export type MigrationSource = (typeof migrationSourceEnum.enumValues)[number];
export type CoaTemplate = (typeof coaTemplateEnum.enumValues)[number];

// ============================================
// PROFILE COMPLETENESS WEIGHTS
// ============================================

/**
 * Weights for calculating profile completeness percentage.
 * Total = 100%
 */
export const PROFILE_COMPLETENESS_WEIGHTS = {
  // Legal Identity (30%)
  legalName: 10,
  companyType: 5,
  registrationNumber: 10,
  dateOfIncorporation: 5,

  // Address (15%)
  address: 15, // addressLine1, city, postcode, state

  // Contact (10%)
  contact: 10, // primaryPhone OR primaryEmail

  // Business Classification (15%)
  msicCode: 5,
  industryType: 5,
  natureOfBusiness: 5,

  // Tax & Compliance (15%)
  tinNumber: 10,
  sstStatus: 5,

  // Accounting (10%)
  accountingMethod: 5,
  fiscalYear: 5,

  // Branding (5%)
  logo: 5,
} as const;

/**
 * Calculate profile completeness percentage
 */
export function calculateProfileCompleteness(
  profile: Partial<CompanyProfile>
): number {
  let score = 0;
  const weights = PROFILE_COMPLETENESS_WEIGHTS;

  // Legal Identity
  if (profile.legalName) score += weights.legalName;
  if (profile.companyType) score += weights.companyType;
  if (profile.registrationNumber) score += weights.registrationNumber;
  if (profile.dateOfIncorporation) score += weights.dateOfIncorporation;

  // Address (need at least line1, city, postcode, state)
  if (
    profile.addressLine1 &&
    profile.city &&
    profile.postcode &&
    profile.state
  ) {
    score += weights.address;
  }

  // Contact (need phone or email)
  if (profile.primaryPhone || profile.primaryEmail) {
    score += weights.contact;
  }

  // Business Classification
  if (profile.msicCode) score += weights.msicCode;
  if (profile.industryType) score += weights.industryType;
  if (profile.natureOfBusiness) score += weights.natureOfBusiness;

  // Tax & Compliance
  if (profile.tinNumber) score += weights.tinNumber;
  if (profile.sstStatus && profile.sstStatus !== "not_registered") {
    score += weights.sstStatus;
  } else if (profile.sstStatus === "not_registered") {
    // Still give points for explicitly setting status
    score += weights.sstStatus;
  }

  // Accounting
  if (profile.accountingMethod) score += weights.accountingMethod;
  if (profile.fiscalYearStartMonth) score += weights.fiscalYear;

  // Branding
  if (profile.logoUrl || profile.logoBase64) score += weights.logo;

  return Math.min(100, score);
}

// ============================================
// MALAYSIAN STATE CODES (for e-Invoice)
// ============================================

export const MALAYSIAN_STATE_CODES: Record<string, string> = {
  "01": "Johor",
  "02": "Kedah",
  "03": "Kelantan",
  "04": "Melaka",
  "05": "Negeri Sembilan",
  "06": "Pahang",
  "07": "Pulau Pinang",
  "08": "Perak",
  "09": "Perlis",
  "10": "Selangor",
  "11": "Terengganu",
  "12": "Sabah",
  "13": "Sarawak",
  "14": "Wilayah Persekutuan Kuala Lumpur",
  "15": "Wilayah Persekutuan Labuan",
  "16": "Wilayah Persekutuan Putrajaya",
};

// ============================================
// MSIC CODE CATEGORIES (Common ones)
// ============================================

export const COMMON_MSIC_CODES: Record<string, string> = {
  "46100": "Wholesale on a fee or contract basis",
  "46410": "Wholesale of textiles, clothing and footwear",
  "47111": "Retail sale in non-specialized stores",
  "47190": "Other retail sale in non-specialized stores",
  "56101": "Restaurants",
  "56102": "Cafes",
  "62010": "Computer programming activities",
  "62020": "Computer consultancy and computer facilities management",
  "62090": "Other information technology service activities",
  "63110": "Data processing, hosting and related activities",
  "64191": "Banks",
  "66190": "Other financial service activities",
  "68100": "Real estate activities with own or leased property",
  "69100": "Legal activities",
  "69200": "Accounting, bookkeeping and auditing activities",
  "70100": "Activities of head offices",
  "70201": "Management consultancy activities",
  "71100": "Architectural activities",
  "71200": "Technical testing and analysis",
  "73100": "Advertising",
  "74100": "Specialized design activities",
  "74909": "Other professional, scientific and technical activities",
  "82110": "Combined office administrative service activities",
  "82190": "Other business support service activities",
};
