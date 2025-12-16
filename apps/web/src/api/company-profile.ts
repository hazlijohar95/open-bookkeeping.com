/**
 * Company Profile API hooks
 * React Query hooks for comprehensive company profile management
 * Uses tRPC for type-safe communication with backend
 */

import { trpc } from "@/trpc/provider";

// ============================================
// QUERY KEYS
// ============================================

export const companyProfileKeys = {
  all: ["companyProfile"] as const,
  profile: () => [...companyProfileKeys.all, "profile"] as const,
  completeness: () => [...companyProfileKeys.all, "completeness"] as const,
  missingFields: () => [...companyProfileKeys.all, "missingFields"] as const,
  einvoiceReadiness: () =>
    [...companyProfileKeys.all, "einvoiceReadiness"] as const,
  payrollReadiness: () =>
    [...companyProfileKeys.all, "payrollReadiness"] as const,
  referenceData: () => [...companyProfileKeys.all, "referenceData"] as const,
  aiContext: () => [...companyProfileKeys.all, "aiContext"] as const,
};

// ============================================
// TYPES (inferred from tRPC router)
// ============================================

export type CompanyProfile = NonNullable<
  Awaited<ReturnType<typeof trpc.companyProfile.get.useQuery>["data"]>
>;

export type ReferenceData = NonNullable<
  Awaited<
    ReturnType<typeof trpc.companyProfile.getReferenceData.useQuery>["data"]
  >
>;

export type MissingFields = NonNullable<
  Awaited<
    ReturnType<typeof trpc.companyProfile.getMissingFields.useQuery>["data"]
  >
>;

export type EInvoiceReadiness = NonNullable<
  Awaited<
    ReturnType<
      typeof trpc.companyProfile.checkEInvoiceReadiness.useQuery
    >["data"]
  >
>;

export type PayrollReadiness = NonNullable<
  Awaited<
    ReturnType<
      typeof trpc.companyProfile.checkPayrollReadiness.useQuery
    >["data"]
  >
>;

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Get company profile (creates default if not exists)
 */
export function useCompanyProfile() {
  return trpc.companyProfile.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Get profile completeness percentage
 */
export function useProfileCompleteness() {
  return trpc.companyProfile.getCompleteness.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get missing fields for profile completion
 */
export function useMissingFields() {
  return trpc.companyProfile.getMissingFields.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Check e-Invoice readiness
 */
export function useEInvoiceReadiness() {
  return trpc.companyProfile.checkEInvoiceReadiness.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Check payroll readiness
 */
export function usePayrollReadiness() {
  return trpc.companyProfile.checkPayrollReadiness.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get reference data (state codes, MSIC codes, company types, etc.)
 */
export function useReferenceData() {
  return trpc.companyProfile.getReferenceData.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // 1 hour - this rarely changes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Get profile summary for AI context
 */
export function useCompanyProfileForAI() {
  return trpc.companyProfile.getForAIContext.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Update entire profile
 */
export function useUpdateCompanyProfile() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.update.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update legal identity section
 */
export function useUpdateLegalIdentity() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateLegalIdentity.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update address section
 */
export function useUpdateAddress() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateAddress.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update contact information
 */
export function useUpdateContact() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateContact.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update business classification
 */
export function useUpdateBusinessClassification() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateBusinessClassification.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update accounting settings
 */
export function useUpdateAccountingSettings() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateAccountingSettings.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update tax & compliance info
 */
export function useUpdateTaxCompliance() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateTaxCompliance.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update employer registrations (payroll)
 */
export function useUpdateEmployerRegistrations() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateEmployerRegistrations.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update bank accounts
 */
export function useUpdateBankAccounts() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateBankAccounts.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update branding
 */
export function useUpdateBranding() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateBranding.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update document defaults
 */
export function useUpdateDocumentDefaults() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateDocumentDefaults.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Update migration info
 */
export function useUpdateMigration() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.updateMigration.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Mark onboarding as completed
 */
export function useCompleteOnboarding() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.completeOnboarding.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}

/**
 * Mark onboarding as skipped
 */
export function useSkipOnboarding() {
  const utils = trpc.useUtils();

  return trpc.companyProfile.skipOnboarding.useMutation({
    onSuccess: () => {
      void utils.companyProfile.invalidate();
    },
  });
}
