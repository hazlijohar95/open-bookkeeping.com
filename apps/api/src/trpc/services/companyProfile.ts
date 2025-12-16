import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  companyProfileRepository,
  type UpdateCompanyProfileInput,
} from "@open-bookkeeping/db";
import {
  MALAYSIAN_STATE_CODES,
  COMMON_MSIC_CODES,
} from "@open-bookkeeping/db/src/schema/companyProfiles";

// ============================================
// ZOD SCHEMAS
// ============================================

const bankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  bankCode: z.string().optional(),
  accountNumber: z.string(),
  accountName: z.string(),
  accountType: z.enum(["current", "savings", "fixed_deposit"]),
  currency: z.string(),
  swiftCode: z.string().optional(),
  isDefault: z.boolean(),
  linkedGLAccountId: z.string().optional(),
});

const contactPersonSchema = z.object({
  name: z.string(),
  designation: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  isPrimary: z.boolean(),
});

const companyTypeEnum = z.enum([
  "sole_proprietorship",
  "partnership",
  "llp",
  "sdn_bhd",
  "bhd",
  "npo",
  "cooperative",
  "government",
  "branch",
  "representative",
  "other",
]);

const businessSizeEnum = z.enum(["micro", "small", "medium", "large"]);

const sstStatusEnum = z.enum([
  "not_registered",
  "registered",
  "voluntary",
  "exempt",
  "deregistered",
]);

const accountingMethodEnum = z.enum(["cash", "accrual"]);

const migrationSourceEnum = z.enum([
  "none",
  "quickbooks",
  "xero",
  "sage",
  "myob",
  "wave",
  "zoho_books",
  "freshbooks",
  "sql_accounting",
  "autocount",
  "ubs",
  "million",
  "spreadsheet",
  "manual",
  "other",
]);

const coaTemplateEnum = z.enum([
  "malaysian_sme",
  "malaysian_services",
  "malaysian_trading",
  "malaysian_manufacturing",
  "malaysian_fnb",
  "custom",
  "import",
]);

// Full update schema
const updateProfileSchema = z.object({
  // Legal Identity
  legalName: z.string().max(255).optional(),
  tradeName: z.string().max(255).optional(),
  companyType: companyTypeEnum.optional(),
  registrationNumber: z.string().max(50).optional(),
  oldRegistrationNumber: z.string().max(50).optional(),
  dateOfIncorporation: z.coerce.date().optional(),

  // Address
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  addressLine3: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  postcode: z.string().max(10).optional(),
  state: z.string().max(100).optional(),
  stateCode: z.string().max(2).optional(),
  country: z.string().max(2).optional(),

  // Contact
  primaryPhone: z.string().max(20).optional(),
  secondaryPhone: z.string().max(20).optional(),
  primaryEmail: z.string().email().max(255).optional(),
  website: z.string().url().max(255).optional().or(z.literal("")),
  contactPersons: z.array(contactPersonSchema).optional(),

  // Business Classification
  msicCode: z.string().max(5).optional(),
  msicDescription: z.string().max(255).optional(),
  industryType: z.string().max(100).optional(),
  businessSize: businessSizeEnum.optional(),
  natureOfBusiness: z.string().max(1000).optional(),
  mainProducts: z.string().max(1000).optional(),
  annualRevenueRange: z.string().max(50).optional(),

  // Accounting Settings
  accountingMethod: accountingMethodEnum.optional(),
  fiscalYearStartMonth: z.number().min(1).max(12).optional(),
  fiscalYearStartDay: z.number().min(1).max(31).optional(),
  defaultCurrency: z.string().max(3).optional(),
  multiCurrencyEnabled: z.boolean().optional(),
  chartOfAccountsTemplate: coaTemplateEnum.optional(),

  // Tax Identification
  tinNumber: z.string().max(20).optional(),
  sstStatus: sstStatusEnum.optional(),
  sstRegistrationNumber: z.string().max(50).optional(),
  sstRegistrationDate: z.coerce.date().optional(),
  sstDeregistrationDate: z.coerce.date().optional(),
  tourismTaxNumber: z.string().max(50).optional(),

  // E-Invoice
  einvoiceEnabled: z.boolean().optional(),
  einvoiceEffectiveDate: z.coerce.date().optional(),
  einvoiceTin: z.string().max(20).optional(),
  einvoiceBrn: z.string().max(30).optional(),

  // Employer Registrations
  epfEmployerNumber: z.string().max(20).optional(),
  socsoEmployerNumber: z.string().max(20).optional(),
  eisEmployerNumber: z.string().max(20).optional(),
  hrdfLevyNumber: z.string().max(20).optional(),
  pcbFileNumber: z.string().max(20).optional(),

  // Banking
  bankAccounts: z.array(bankAccountSchema).optional(),

  // Branding
  logoUrl: z.string().url().optional().or(z.literal("")),
  logoBase64: z.string().optional(),
  signatureUrl: z.string().url().optional().or(z.literal("")),
  signatureBase64: z.string().optional(),
  brandPrimaryColor: z.string().max(7).optional(),
  brandSecondaryColor: z.string().max(7).optional(),

  // Document Defaults
  invoicePrefix: z.string().max(10).optional(),
  quotationPrefix: z.string().max(10).optional(),
  creditNotePrefix: z.string().max(10).optional(),
  debitNotePrefix: z.string().max(10).optional(),
  billPrefix: z.string().max(10).optional(),
  defaultPaymentTerms: z.string().max(100).optional(),
  defaultPaymentTermsDays: z.number().min(0).max(365).optional(),
  invoiceNotes: z.string().max(2000).optional(),
  invoiceTerms: z.string().max(2000).optional(),
  quotationNotes: z.string().max(2000).optional(),
  quotationTerms: z.string().max(2000).optional(),
  quotationValidityDays: z.number().min(1).max(365).optional(),

  // Migration
  migrationSource: migrationSourceEnum.optional(),
  migrationSourceOther: z.string().max(100).optional(),
  migrationDate: z.coerce.date().optional(),
  openingBalanceDate: z.coerce.date().optional(),
  migrationNotes: z.string().max(2000).optional(),
  previousFiscalYearEnd: z.coerce.date().optional(),
  hasPendingMigration: z.boolean().optional(),

  // Onboarding
  onboardingCompleted: z.boolean().optional(),
  onboardingSkipped: z.boolean().optional(),
});

// Section-specific schemas for partial updates
const legalIdentitySchema = updateProfileSchema.pick({
  legalName: true,
  tradeName: true,
  companyType: true,
  registrationNumber: true,
  oldRegistrationNumber: true,
  dateOfIncorporation: true,
});

const addressSchema = updateProfileSchema.pick({
  addressLine1: true,
  addressLine2: true,
  addressLine3: true,
  city: true,
  postcode: true,
  state: true,
  stateCode: true,
  country: true,
});

const contactSchema = updateProfileSchema.pick({
  primaryPhone: true,
  secondaryPhone: true,
  primaryEmail: true,
  website: true,
  contactPersons: true,
});

const businessClassificationSchema = updateProfileSchema.pick({
  msicCode: true,
  msicDescription: true,
  industryType: true,
  businessSize: true,
  natureOfBusiness: true,
  mainProducts: true,
  annualRevenueRange: true,
});

const accountingSettingsSchema = updateProfileSchema.pick({
  accountingMethod: true,
  fiscalYearStartMonth: true,
  fiscalYearStartDay: true,
  defaultCurrency: true,
  multiCurrencyEnabled: true,
  chartOfAccountsTemplate: true,
});

const taxComplianceSchema = updateProfileSchema.pick({
  tinNumber: true,
  sstStatus: true,
  sstRegistrationNumber: true,
  sstRegistrationDate: true,
  sstDeregistrationDate: true,
  tourismTaxNumber: true,
  einvoiceEnabled: true,
  einvoiceEffectiveDate: true,
  einvoiceTin: true,
  einvoiceBrn: true,
});

const employerRegistrationsSchema = updateProfileSchema.pick({
  epfEmployerNumber: true,
  socsoEmployerNumber: true,
  eisEmployerNumber: true,
  hrdfLevyNumber: true,
  pcbFileNumber: true,
});

const brandingSchema = updateProfileSchema.pick({
  logoUrl: true,
  logoBase64: true,
  signatureUrl: true,
  signatureBase64: true,
  brandPrimaryColor: true,
  brandSecondaryColor: true,
});

const documentDefaultsSchema = updateProfileSchema.pick({
  invoicePrefix: true,
  quotationPrefix: true,
  creditNotePrefix: true,
  debitNotePrefix: true,
  billPrefix: true,
  defaultPaymentTerms: true,
  defaultPaymentTermsDays: true,
  invoiceNotes: true,
  invoiceTerms: true,
  quotationNotes: true,
  quotationTerms: true,
  quotationValidityDays: true,
});

const migrationSchema = updateProfileSchema.pick({
  migrationSource: true,
  migrationSourceOther: true,
  migrationDate: true,
  openingBalanceDate: true,
  migrationNotes: true,
  previousFiscalYearEnd: true,
  hasPendingMigration: true,
});

// ============================================
// ROUTER
// ============================================

export const companyProfileRouter = router({
  /**
   * Get company profile (or create default if not exists)
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await companyProfileRepository.getOrCreate(ctx.user.id);
    return profile;
  }),

  /**
   * Update entire profile
   */
  update: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
      return profile;
    }),

  /**
   * Update legal identity section
   */
  updateLegalIdentity: protectedProcedure
    .input(legalIdentitySchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update address section
   */
  updateAddress: protectedProcedure
    .input(addressSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update contact information
   */
  updateContact: protectedProcedure
    .input(contactSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update business classification
   */
  updateBusinessClassification: protectedProcedure
    .input(businessClassificationSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update accounting settings
   */
  updateAccountingSettings: protectedProcedure
    .input(accountingSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update tax & compliance info
   */
  updateTaxCompliance: protectedProcedure
    .input(taxComplianceSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update employer registrations (payroll)
   */
  updateEmployerRegistrations: protectedProcedure
    .input(employerRegistrationsSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update bank accounts
   */
  updateBankAccounts: protectedProcedure
    .input(z.object({ bankAccounts: z.array(bankAccountSchema) }))
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(ctx.user.id, {
        bankAccounts: input.bankAccounts,
      });
    }),

  /**
   * Update branding
   */
  updateBranding: protectedProcedure
    .input(brandingSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update document defaults
   */
  updateDocumentDefaults: protectedProcedure
    .input(documentDefaultsSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Update migration info
   */
  updateMigration: protectedProcedure
    .input(migrationSchema)
    .mutation(async ({ ctx, input }) => {
      return companyProfileRepository.update(
        ctx.user.id,
        input as UpdateCompanyProfileInput
      );
    }),

  /**
   * Get profile completeness score
   */
  getCompleteness: protectedProcedure.query(async ({ ctx }) => {
    const completeness = await companyProfileRepository.getCompleteness(
      ctx.user.id
    );
    return { completeness };
  }),

  /**
   * Get missing fields for profile completion
   */
  getMissingFields: protectedProcedure.query(async ({ ctx }) => {
    return companyProfileRepository.getMissingFields(ctx.user.id);
  }),

  /**
   * Check e-Invoice readiness
   */
  checkEInvoiceReadiness: protectedProcedure.query(async ({ ctx }) => {
    return companyProfileRepository.isEInvoiceReady(ctx.user.id);
  }),

  /**
   * Check payroll readiness
   */
  checkPayrollReadiness: protectedProcedure.query(async ({ ctx }) => {
    return companyProfileRepository.isPayrollReady(ctx.user.id);
  }),

  /**
   * Mark onboarding as completed
   */
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return companyProfileRepository.completeOnboarding(ctx.user.id);
  }),

  /**
   * Mark onboarding as skipped
   */
  skipOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return companyProfileRepository.skipOnboarding(ctx.user.id);
  }),

  /**
   * Get reference data (state codes, MSIC codes)
   */
  getReferenceData: protectedProcedure.query(async () => {
    return {
      stateCodes: Object.entries(MALAYSIAN_STATE_CODES).map(([code, name]) => ({
        code,
        name,
      })),
      msicCodes: Object.entries(COMMON_MSIC_CODES).map(
        ([code, description]) => ({
          code,
          description,
        })
      ),
      companyTypes: [
        {
          value: "sole_proprietorship",
          label: "Sole Proprietorship (Enterprise)",
        },
        { value: "partnership", label: "Partnership" },
        { value: "llp", label: "Limited Liability Partnership (PLT)" },
        { value: "sdn_bhd", label: "Sendirian Berhad (Private Limited)" },
        { value: "bhd", label: "Berhad (Public Limited)" },
        { value: "npo", label: "Non-Profit Organization / Society" },
        { value: "cooperative", label: "Koperasi / Cooperative" },
        { value: "government", label: "Government Agency" },
        { value: "branch", label: "Foreign Company Branch" },
        { value: "representative", label: "Representative Office" },
        { value: "other", label: "Other" },
      ],
      businessSizes: [
        { value: "micro", label: "Micro (<5 employees OR <RM300K revenue)" },
        {
          value: "small",
          label: "Small (5-30 employees OR RM300K-3M revenue)",
        },
        {
          value: "medium",
          label: "Medium (31-75 employees OR RM3M-20M revenue)",
        },
        { value: "large", label: "Large (>75 employees OR >RM20M revenue)" },
      ],
      sstStatuses: [
        { value: "not_registered", label: "Not Registered" },
        { value: "registered", label: "Registered (Mandatory)" },
        { value: "voluntary", label: "Voluntary Registration" },
        { value: "exempt", label: "Exempt from SST" },
        { value: "deregistered", label: "Deregistered" },
      ],
      migrationSources: [
        { value: "none", label: "Fresh Start (No Migration)" },
        { value: "quickbooks", label: "QuickBooks" },
        { value: "xero", label: "Xero" },
        { value: "sage", label: "Sage" },
        { value: "myob", label: "MYOB" },
        { value: "wave", label: "Wave Accounting" },
        { value: "zoho_books", label: "Zoho Books" },
        { value: "freshbooks", label: "FreshBooks" },
        { value: "sql_accounting", label: "SQL Accounting (Malaysia)" },
        { value: "autocount", label: "AutoCount (Malaysia)" },
        { value: "ubs", label: "UBS Accounting (Malaysia)" },
        { value: "million", label: "Million Accounting (Malaysia)" },
        { value: "spreadsheet", label: "Excel / Google Sheets" },
        { value: "manual", label: "Manual / Paper-based" },
        { value: "other", label: "Other Software" },
      ],
    };
  }),

  /**
   * Get profile summary for AI context
   * Returns a concise view of the profile for the AI agent
   */
  getForAIContext: protectedProcedure.query(async ({ ctx }) => {
    const profile = await companyProfileRepository.findByUserId(ctx.user.id);

    if (!profile) {
      return null;
    }

    // Return a summarized view optimized for AI context
    return {
      // Company identity
      companyName: profile.legalName || profile.tradeName,
      companyType: profile.companyType,
      registrationNumber: profile.registrationNumber,

      // Location
      city: profile.city,
      state: profile.state,
      country: profile.country || "MY",

      // Business context
      industry: profile.industryType,
      businessSize: profile.businessSize,
      natureOfBusiness: profile.natureOfBusiness,
      mainProducts: profile.mainProducts,

      // Accounting context
      accountingMethod: profile.accountingMethod,
      fiscalYearStartMonth: profile.fiscalYearStartMonth,
      defaultCurrency: profile.defaultCurrency,

      // Tax status
      tinNumber: profile.tinNumber ? "Registered" : null,
      sstStatus: profile.sstStatus,
      sstRegistrationNumber: profile.sstRegistrationNumber
        ? "Registered"
        : null,
      einvoiceEnabled: profile.einvoiceEnabled,

      // Payroll readiness
      hasEpf: !!profile.epfEmployerNumber,
      hasSocso: !!profile.socsoEmployerNumber,
      hasEis: !!profile.eisEmployerNumber,

      // Migration context
      migrationSource: profile.migrationSource,
      hasPendingMigration: profile.hasPendingMigration,

      // Profile status
      profileCompleteness: profile.profileCompleteness,
      onboardingCompleted: profile.onboardingCompleted,
    };
  }),
});
