/**
 * E-Invoice API hooks
 * React Query hooks for Malaysian MyInvois integration
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { invoiceKeys } from "./invoices";

// Query keys
export const einvoiceKeys = {
  all: ["einvoice"] as const,
  settings: () => [...einvoiceKeys.all, "settings"] as const,
  settingsValidation: () => [...einvoiceKeys.all, "settingsValidation"] as const,
  history: (invoiceId: string) => [...einvoiceKeys.all, "history", invoiceId] as const,
  validation: (invoiceId: string) => [...einvoiceKeys.all, "validation", invoiceId] as const,
  submissionStatus: (uid: string) => [...einvoiceKeys.all, "submissionStatus", uid] as const,
  document: (uuid: string) => [...einvoiceKeys.all, "document", uuid] as const,
};

// Types
export interface EInvoiceSettings {
  enabled: boolean;
  autoSubmit: boolean;
  tin?: string | null;
  brn?: string | null;
  identificationScheme?: "NRIC" | "BRN" | "PASSPORT" | "ARMY" | null;
  msicCode?: string | null;
  msicDescription?: string | null;
  sstRegistration?: string | null;
  tourismTaxRegistration?: string | null;
}

export interface EInvoiceSettingsInput {
  enabled?: boolean;
  autoSubmit?: boolean;
  tin?: string;
  brn?: string;
  identificationScheme?: "NRIC" | "BRN" | "PASSPORT" | "ARMY";
  msicCode?: string;
  msicDescription?: string;
  sstRegistration?: string | null;
  tourismTaxRegistration?: string | null;
}

export interface SettingsValidation {
  valid: boolean;
  errors: string[];
}

export interface CustomerEInvoiceDetails {
  tin?: string;
  brn?: string;
  identificationScheme?: "NRIC" | "BRN" | "PASSPORT" | "ARMY";
  phone?: string;
  email?: string;
}

export interface SubmitInvoiceInput {
  invoiceId: string;
  customerDetails?: CustomerEInvoiceDetails;
  dryRun?: boolean;
}

export interface SubmitCreditNoteInput {
  invoiceId: string;
  originalInvoiceRef: {
    id: string;
    uuid?: string;
    issueDate?: string;
  };
  customerDetails?: CustomerEInvoiceDetails;
  dryRun?: boolean;
}

export interface SubmitDebitNoteInput extends SubmitCreditNoteInput {}

export interface SubmissionResult {
  success: boolean;
  submissionUid?: string;
  documentUuid?: string;
  dryRun?: boolean;
  message?: string;
}

export interface BulkSubmitInput {
  invoiceIds: string[];
  dryRun?: boolean;
}

export interface BulkSubmitResult {
  results: Array<{
    invoiceId: string;
    success: boolean;
    submissionUid?: string;
    documentUuid?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export type EInvoiceSubmissionStatus = "pending" | "submitted" | "valid" | "invalid" | "cancelled";

export interface EInvoiceSubmission {
  id: string;
  invoiceId: string;
  documentType: string;
  submissionUid?: string;
  documentUuid?: string;
  status: EInvoiceSubmissionStatus;
  submittedAt?: string;
  validatedAt?: string;
  cancelledAt?: string;
  longId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface InvoiceValidation {
  valid: boolean;
  errors: string[];
}

// Hooks
export function useEInvoiceSettings() {
  return useQuery({
    queryKey: einvoiceKeys.settings(),
    queryFn: () => api.get<EInvoiceSettings>("/einvoice/settings"),
  });
}

export function useUpdateEInvoiceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EInvoiceSettingsInput) =>
      api.put<EInvoiceSettings>("/einvoice/settings", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.settings() });
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.settingsValidation() });
    },
  });
}

export function useValidateEInvoiceSettings() {
  return useQuery({
    queryKey: einvoiceKeys.settingsValidation(),
    queryFn: () => api.get<SettingsValidation>("/einvoice/settings/validate"),
  });
}

export function useSubmitInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitInvoiceInput) =>
      api.post<SubmissionResult>("/einvoice/submit", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoiceId) });
    },
  });
}

export function useSubmitCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitCreditNoteInput) =>
      api.post<SubmissionResult>("/einvoice/submit-credit-note", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(variables.invoiceId) });
    },
  });
}

export function useSubmitDebitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitDebitNoteInput) =>
      api.post<SubmissionResult>("/einvoice/submit-debit-note", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(variables.invoiceId) });
    },
  });
}

export function useBulkSubmit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkSubmitInput) =>
      api.post<BulkSubmitResult>("/einvoice/bulk-submit", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useCancelDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { invoiceId: string; reason: string }) =>
      api.post<{ success: boolean }>("/einvoice/cancel", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoiceId) });
    },
  });
}

export function useSubmissionHistory(invoiceId: string) {
  return useQuery({
    queryKey: einvoiceKeys.history(invoiceId),
    queryFn: () => api.get<EInvoiceSubmission[]>(`/einvoice/history/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useValidateInvoice(invoiceId: string) {
  return useQuery({
    queryKey: einvoiceKeys.validation(invoiceId),
    queryFn: () => api.get<InvoiceValidation>(`/einvoice/validate/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useSubmissionStatus(submissionUid: string) {
  return useQuery({
    queryKey: einvoiceKeys.submissionStatus(submissionUid),
    queryFn: () => api.get<EInvoiceSubmission>(`/einvoice/submission-status/${submissionUid}`),
    enabled: !!submissionUid,
  });
}

export function useDocumentDetails(documentUuid: string) {
  return useQuery({
    queryKey: einvoiceKeys.document(documentUuid),
    queryFn: () => api.get<unknown>(`/einvoice/document/${documentUuid}`),
    enabled: !!documentUuid,
  });
}
