/**
 * Company Profile Repository
 *
 * Handles CRUD operations for company profiles including:
 * - Profile creation and updates
 * - Profile completeness calculation
 * - Migration data management
 * - Syncing with legacy user_settings and user_onboarding tables
 */

import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  companyProfiles,
  calculateProfileCompleteness,
  type CompanyProfile,
  type NewCompanyProfile,
  type BankAccountInfo,
  type ContactPerson,
} from "../schema/companyProfiles";
import { userSettings } from "../schema/userSettings";
import { userOnboarding } from "../schema/subscriptions";

export interface UpdateCompanyProfileInput {
  // Legal Identity
  legalName?: string;
  tradeName?: string;
  companyType?:
    | "sole_proprietorship"
    | "partnership"
    | "llp"
    | "sdn_bhd"
    | "bhd"
    | "npo"
    | "cooperative"
    | "government"
    | "branch"
    | "representative"
    | "other";
  registrationNumber?: string;
  oldRegistrationNumber?: string;
  dateOfIncorporation?: Date;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  postcode?: string;
  state?: string;
  stateCode?: string;
  country?: string;

  // Contact
  primaryPhone?: string;
  secondaryPhone?: string;
  primaryEmail?: string;
  website?: string;
  contactPersons?: ContactPerson[];

  // Business Classification
  msicCode?: string;
  msicDescription?: string;
  industryType?: string;
  businessSize?: "micro" | "small" | "medium" | "large";
  natureOfBusiness?: string;
  mainProducts?: string;
  annualRevenueRange?: string;

  // Accounting Settings
  accountingMethod?: "cash" | "accrual";
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  defaultCurrency?: string;
  multiCurrencyEnabled?: boolean;
  chartOfAccountsTemplate?:
    | "malaysian_sme"
    | "malaysian_services"
    | "malaysian_trading"
    | "malaysian_manufacturing"
    | "malaysian_fnb"
    | "custom"
    | "import";

  // Tax Identification
  tinNumber?: string;
  sstStatus?:
    | "not_registered"
    | "registered"
    | "voluntary"
    | "exempt"
    | "deregistered";
  sstRegistrationNumber?: string;
  sstRegistrationDate?: Date;
  sstDeregistrationDate?: Date;
  tourismTaxNumber?: string;

  // E-Invoice
  einvoiceEnabled?: boolean;
  einvoiceEffectiveDate?: Date;
  einvoiceTin?: string;
  einvoiceBrn?: string;

  // Employer Registrations
  epfEmployerNumber?: string;
  socsoEmployerNumber?: string;
  eisEmployerNumber?: string;
  hrdfLevyNumber?: string;
  pcbFileNumber?: string;

  // Banking
  bankAccounts?: BankAccountInfo[];

  // Branding
  logoUrl?: string;
  logoBase64?: string;
  signatureUrl?: string;
  signatureBase64?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;

  // Document Defaults
  invoicePrefix?: string;
  quotationPrefix?: string;
  creditNotePrefix?: string;
  debitNotePrefix?: string;
  billPrefix?: string;
  defaultPaymentTerms?: string;
  defaultPaymentTermsDays?: number;
  invoiceNotes?: string;
  invoiceTerms?: string;
  quotationNotes?: string;
  quotationTerms?: string;
  quotationValidityDays?: number;

  // Migration
  migrationSource?:
    | "none"
    | "quickbooks"
    | "xero"
    | "sage"
    | "myob"
    | "wave"
    | "zoho_books"
    | "freshbooks"
    | "sql_accounting"
    | "autocount"
    | "ubs"
    | "million"
    | "spreadsheet"
    | "manual"
    | "other";
  migrationSourceOther?: string;
  migrationDate?: Date;
  openingBalanceDate?: Date;
  migrationNotes?: string;
  previousFiscalYearEnd?: Date;
  hasPendingMigration?: boolean;

  // Onboarding
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
}

export const companyProfileRepository = {
  /**
   * Get company profile by user ID
   */
  findByUserId: async (userId: string): Promise<CompanyProfile | null> => {
    const profile = await db.query.companyProfiles.findFirst({
      where: eq(companyProfiles.userId, userId),
    });
    return profile ?? null;
  },

  /**
   * Get or create company profile for a user
   * Initializes with data from user_settings and user_onboarding if available
   */
  getOrCreate: async (userId: string): Promise<CompanyProfile> => {
    // Check if profile exists
    const existing = await db.query.companyProfiles.findFirst({
      where: eq(companyProfiles.userId, userId),
    });

    if (existing) {
      return existing;
    }

    // Create new profile, optionally syncing from legacy tables
    const legacySettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    const legacyOnboarding = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    // Build initial profile from legacy data
    const initialData: NewCompanyProfile = {
      userId,
      legalName: legacySettings?.companyName ?? legacyOnboarding?.companyName,
      addressLine1: legacySettings?.companyAddress,
      primaryPhone: legacySettings?.companyPhone,
      primaryEmail: legacySettings?.companyEmail,
      website: legacySettings?.companyWebsite,
      logoUrl: legacySettings?.companyLogo,
      tinNumber: legacySettings?.companyTaxId,
      industryType: legacyOnboarding?.industryType,
      businessSize: legacyOnboarding?.businessSize as
        | "micro"
        | "small"
        | "medium"
        | "large"
        | undefined,
      accountingMethod:
        (legacyOnboarding?.accountingMethod as "cash" | "accrual") ?? "accrual",
      fiscalYearStartMonth: legacyOnboarding?.fiscalYearEndMonth
        ? (legacyOnboarding.fiscalYearEndMonth % 12) + 1
        : 1,
      defaultCurrency: legacySettings?.defaultCurrency ?? "MYR",
      sstStatus: legacyOnboarding?.isSstRegistered
        ? "registered"
        : "not_registered",
      sstRegistrationNumber: legacySettings?.sstRegistrationNumber,
      invoicePrefix: legacySettings?.invoicePrefix ?? "INV-",
      quotationPrefix: legacySettings?.quotationPrefix ?? "QT-",
      defaultPaymentTerms: legacySettings?.defaultPaymentTerms,
      invoiceNotes: legacySettings?.invoiceNotes,
      invoiceTerms: legacySettings?.invoiceTerms,
      onboardingCompleted: legacyOnboarding?.isCompleted ?? false,
      onboardingCompletedAt: legacyOnboarding?.completedAt,
      onboardingSkipped: legacyOnboarding?.wasSkipped ?? false,
      onboardingSkippedAt: legacyOnboarding?.skippedAt,
    };

    // Calculate initial completeness
    initialData.profileCompleteness = calculateProfileCompleteness(initialData);

    const [profile] = await db
      .insert(companyProfiles)
      .values(initialData)
      .returning();

    return profile!;
  },

  /**
   * Create a new company profile
   */
  create: async (data: NewCompanyProfile): Promise<CompanyProfile> => {
    // Calculate profile completeness
    data.profileCompleteness = calculateProfileCompleteness(data);

    const [profile] = await db.insert(companyProfiles).values(data).returning();

    return profile!;
  },

  /**
   * Update company profile
   */
  update: async (
    userId: string,
    data: UpdateCompanyProfileInput
  ): Promise<CompanyProfile | null> => {
    // Build update object
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
      lastProfileUpdateAt: new Date(),
    };

    // Handle onboarding completion
    if (data.onboardingCompleted && !updateData.onboardingCompletedAt) {
      updateData.onboardingCompletedAt = new Date();
    }
    if (data.onboardingSkipped && !updateData.onboardingSkippedAt) {
      updateData.onboardingSkippedAt = new Date();
    }

    // Get current profile to calculate completeness
    const current = await db.query.companyProfiles.findFirst({
      where: eq(companyProfiles.userId, userId),
    });

    if (!current) {
      return null;
    }

    // Merge and calculate completeness
    const merged = { ...current, ...updateData };
    updateData.profileCompleteness = calculateProfileCompleteness(
      merged as CompanyProfile
    );

    const [updated] = await db
      .update(companyProfiles)
      .set(updateData)
      .where(eq(companyProfiles.userId, userId))
      .returning();

    // Sync key fields to legacy tables for backward compatibility
    if (updated) {
      await companyProfileRepository.syncToLegacyTables(userId, updated);
    }

    return updated ?? null;
  },

  /**
   * Sync profile data to legacy user_settings table
   * This ensures backward compatibility with existing features
   */
  syncToLegacyTables: async (
    userId: string,
    profile: CompanyProfile
  ): Promise<void> => {
    // Sync to user_settings
    const settingsUpdate: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (profile.legalName) settingsUpdate.companyName = profile.legalName;
    if (profile.addressLine1) {
      settingsUpdate.companyAddress = [
        profile.addressLine1,
        profile.addressLine2,
        profile.addressLine3,
        profile.city,
        profile.postcode,
        profile.state,
      ]
        .filter(Boolean)
        .join(", ");
    }
    if (profile.logoUrl) settingsUpdate.companyLogo = profile.logoUrl;
    if (profile.tinNumber) settingsUpdate.companyTaxId = profile.tinNumber;
    if (profile.primaryPhone)
      settingsUpdate.companyPhone = profile.primaryPhone;
    if (profile.primaryEmail)
      settingsUpdate.companyEmail = profile.primaryEmail;
    if (profile.website) settingsUpdate.companyWebsite = profile.website;
    if (profile.defaultCurrency)
      settingsUpdate.defaultCurrency = profile.defaultCurrency;
    if (profile.invoicePrefix)
      settingsUpdate.invoicePrefix = profile.invoicePrefix;
    if (profile.quotationPrefix)
      settingsUpdate.quotationPrefix = profile.quotationPrefix;
    if (profile.defaultPaymentTerms)
      settingsUpdate.defaultPaymentTerms = profile.defaultPaymentTerms;
    if (profile.invoiceNotes)
      settingsUpdate.invoiceNotes = profile.invoiceNotes;
    if (profile.invoiceTerms)
      settingsUpdate.invoiceTerms = profile.invoiceTerms;
    if (profile.sstRegistrationNumber)
      settingsUpdate.sstRegistrationNumber = profile.sstRegistrationNumber;

    // Check if user_settings exists
    const existingSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    if (existingSettings) {
      await db
        .update(userSettings)
        .set(settingsUpdate)
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        ...settingsUpdate,
      });
    }

    // Sync to user_onboarding
    if (profile.onboardingCompleted || profile.onboardingSkipped) {
      const existingOnboarding = await db.query.userOnboarding.findFirst({
        where: eq(userOnboarding.userId, userId),
      });

      if (existingOnboarding) {
        await db
          .update(userOnboarding)
          .set({
            isCompleted: profile.onboardingCompleted ?? false,
            completedAt: profile.onboardingCompletedAt,
            wasSkipped: profile.onboardingSkipped ?? false,
            skippedAt: profile.onboardingSkippedAt,
            companyName: profile.legalName,
            industryType: profile.industryType,
            businessSize: profile.businessSize,
            accountingMethod: profile.accountingMethod,
            isSstRegistered: profile.sstStatus === "registered",
            updatedAt: new Date(),
          })
          .where(eq(userOnboarding.userId, userId));
      }
    }
  },

  /**
   * Mark onboarding as completed
   */
  completeOnboarding: async (
    userId: string
  ): Promise<CompanyProfile | null> => {
    return companyProfileRepository.update(userId, {
      onboardingCompleted: true,
    });
  },

  /**
   * Mark onboarding as skipped
   */
  skipOnboarding: async (userId: string): Promise<CompanyProfile | null> => {
    return companyProfileRepository.update(userId, {
      onboardingSkipped: true,
    });
  },

  /**
   * Get profile completeness score
   */
  getCompleteness: async (userId: string): Promise<number> => {
    const profile = await companyProfileRepository.findByUserId(userId);
    if (!profile) return 0;
    return profile.profileCompleteness ?? calculateProfileCompleteness(profile);
  },

  /**
   * Get missing required fields for compliance
   */
  getMissingFields: async (
    userId: string
  ): Promise<{
    required: string[];
    recommended: string[];
    compliance: string[];
  }> => {
    const profile = await companyProfileRepository.findByUserId(userId);
    if (!profile) {
      return {
        required: ["All fields - no profile exists"],
        recommended: [],
        compliance: [],
      };
    }

    const missing = {
      required: [] as string[],
      recommended: [] as string[],
      compliance: [] as string[],
    };

    // Required fields
    if (!profile.legalName) missing.required.push("Legal Company Name");
    if (!profile.registrationNumber)
      missing.required.push("SSM Registration Number");
    if (!profile.addressLine1) missing.required.push("Business Address");
    if (!profile.city) missing.required.push("City");
    if (!profile.state) missing.required.push("State");
    if (!profile.postcode) missing.required.push("Postcode");

    // Recommended fields
    if (!profile.primaryPhone) missing.recommended.push("Phone Number");
    if (!profile.primaryEmail) missing.recommended.push("Email Address");
    if (!profile.industryType) missing.recommended.push("Industry Type");
    if (!profile.natureOfBusiness)
      missing.recommended.push("Nature of Business");
    if (!profile.logoUrl && !profile.logoBase64)
      missing.recommended.push("Company Logo");

    // Compliance fields (for e-Invoice, SST, payroll)
    if (!profile.tinNumber)
      missing.compliance.push("TIN Number (for e-Invoice)");
    if (!profile.msicCode) missing.compliance.push("MSIC Code (for e-Invoice)");
    if (profile.sstStatus === "registered" && !profile.sstRegistrationNumber) {
      missing.compliance.push("SST Registration Number");
    }

    return missing;
  },

  /**
   * Check if profile is ready for e-Invoice
   */
  isEInvoiceReady: async (
    userId: string
  ): Promise<{
    ready: boolean;
    missing: string[];
  }> => {
    const profile = await companyProfileRepository.findByUserId(userId);
    const missing: string[] = [];

    if (!profile) {
      return { ready: false, missing: ["Company profile not set up"] };
    }

    // Required for e-Invoice
    if (!profile.legalName) missing.push("Legal Company Name");
    if (!profile.tinNumber && !profile.einvoiceTin) missing.push("TIN Number");
    if (!profile.registrationNumber && !profile.einvoiceBrn)
      missing.push("Business Registration Number");
    if (!profile.msicCode) missing.push("MSIC Code");
    if (!profile.addressLine1) missing.push("Address Line 1");
    if (!profile.city) missing.push("City");
    if (!profile.state || !profile.stateCode) missing.push("State with Code");
    if (!profile.postcode) missing.push("Postcode");
    if (!profile.primaryPhone) missing.push("Phone Number");
    if (!profile.primaryEmail) missing.push("Email Address");

    return {
      ready: missing.length === 0,
      missing,
    };
  },

  /**
   * Check if profile is ready for payroll
   */
  isPayrollReady: async (
    userId: string
  ): Promise<{
    ready: boolean;
    missing: string[];
  }> => {
    const profile = await companyProfileRepository.findByUserId(userId);
    const missing: string[] = [];

    if (!profile) {
      return { ready: false, missing: ["Company profile not set up"] };
    }

    // Required for payroll
    if (!profile.legalName) missing.push("Legal Company Name");
    if (!profile.epfEmployerNumber) missing.push("EPF Employer Number");
    if (!profile.socsoEmployerNumber) missing.push("SOCSO Employer Number");
    if (!profile.eisEmployerNumber) missing.push("EIS Employer Number");

    return {
      ready: missing.length === 0,
      missing,
    };
  },

  /**
   * Delete company profile
   */
  delete: async (userId: string): Promise<boolean> => {
    const result = await db
      .delete(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .returning({ id: companyProfiles.id });

    return result.length > 0;
  },
};

export type CompanyProfileRepository = typeof companyProfileRepository;
