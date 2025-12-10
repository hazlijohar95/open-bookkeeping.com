/**
 * Settings API hooks
 * React Query hooks for user settings management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const settingsKeys = {
  all: ["settings"] as const,
  user: () => [...settingsKeys.all, "user"] as const,
  companyProfile: () => [...settingsKeys.all, "companyProfile"] as const,
  invoiceDefaults: () => [...settingsKeys.all, "invoiceDefaults"] as const,
  notifications: () => [...settingsKeys.all, "notifications"] as const,
  appearance: () => [...settingsKeys.all, "appearance"] as const,
};

// Types
export interface UserSettings {
  id: string;
  userId: string;
  // Company profile
  companyName?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyPostalCode?: string | null;
  companyCountry?: string | null;
  companyTaxId?: string | null;
  companyRegistrationNumber?: string | null;
  companyWebsite?: string | null;
  // Invoice defaults
  defaultCurrency?: string | null;
  defaultPaymentTerms?: string | null;
  defaultTaxRate?: number | null;
  invoicePrefix?: string | null;
  invoiceNextNumber?: number | null;
  quotationPrefix?: string | null;
  quotationNextNumber?: number | null;
  billPrefix?: string | null;
  billNextNumber?: number | null;
  invoiceNotes?: string | null;
  invoiceTerms?: string | null;
  // Notification settings
  emailNotifications?: boolean | null;
  invoiceReminders?: boolean | null;
  paymentReminders?: boolean | null;
  emailOnOverdue?: boolean | null;
  emailOnPayment?: boolean | null;
  emailOnQuotationAccepted?: boolean | null;
  overdueReminderDays?: number | null;
  // Appearance settings
  theme?: string | null;
  language?: string | null;
  dateFormat?: string | null;
  numberFormat?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfileInput {
  companyName?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyPostalCode?: string | null;
  companyCountry?: string | null;
  companyTaxId?: string | null;
  companyRegistrationNumber?: string | null;
  companyWebsite?: string | null;
}

export interface InvoiceDefaultsInput {
  defaultCurrency?: string | null;
  defaultPaymentTerms?: string | null;
  defaultTaxRate?: number | null;
  invoicePrefix?: string | null;
  invoiceNextNumber?: number | null;
  quotationPrefix?: string | null;
  quotationNextNumber?: number | null;
  billPrefix?: string | null;
  billNextNumber?: number | null;
  invoiceNotes?: string | null;
  invoiceTerms?: string | null;
}

export interface NotificationSettingsInput {
  emailNotifications?: boolean | null;
  invoiceReminders?: boolean | null;
  paymentReminders?: boolean | null;
  emailOnOverdue?: boolean;
  emailOnPayment?: boolean;
  emailOnQuotationAccepted?: boolean;
  overdueReminderDays?: number | null;
}

export interface AppearanceSettingsInput {
  theme?: string | null;
  language?: string | null;
  dateFormat?: string | null;
  numberFormat?: string | null;
}

// Cache config for settings queries - settings rarely change
const settingsCacheConfig = {
  staleTime: 15 * 60 * 1000,       // 15 minutes - settings rarely change
  gcTime: 30 * 60 * 1000,          // 30 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.user(),
    queryFn: () => api.get<UserSettings>("/settings"),
    ...settingsCacheConfig,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<UserSettings>) =>
      api.put<UserSettings>("/settings", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompanyProfileInput) =>
      api.patch<UserSettings>("/settings/company-profile", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useUpdateInvoiceDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvoiceDefaultsInput) =>
      api.patch<UserSettings>("/settings/invoice-defaults", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NotificationSettingsInput) =>
      api.patch<UserSettings>("/settings/notifications", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useUpdateAppearanceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AppearanceSettingsInput) =>
      api.patch<UserSettings>("/settings/appearance", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
