import { eq, and, desc } from "drizzle-orm";
import { db } from "../index";
import {
  einvoiceSettings,
  einvoiceSubmissions,
  invoices,
} from "../schema";
import type {
  EInvoiceSubmissionStatus,
  EInvoiceDocumentType,
  IdentificationScheme,
} from "../schema/einvoice";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface CreateEInvoiceSettingsInput {
  userId: string;
  enabled?: boolean;
  autoSubmit?: boolean;
  tin?: string;
  brn?: string;
  identificationScheme?: IdentificationScheme;
  msicCode?: string;
  msicDescription?: string;
  sstRegistration?: string | null;
  tourismTaxRegistration?: string | null;
}

export interface UpdateEInvoiceSettingsInput {
  enabled?: boolean;
  autoSubmit?: boolean;
  tin?: string;
  brn?: string;
  identificationScheme?: IdentificationScheme;
  msicCode?: string;
  msicDescription?: string;
  sstRegistration?: string | null;
  tourismTaxRegistration?: string | null;
}

export interface CreateEInvoiceSubmissionInput {
  invoiceId: string;
  documentType: EInvoiceDocumentType;
  rawRequest?: unknown;
}

export interface UpdateEInvoiceSubmissionInput {
  submissionUid?: string;
  documentUuid?: string;
  longId?: string;
  status?: EInvoiceSubmissionStatus;
  submittedAt?: Date;
  validatedAt?: Date;
  cancelledAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}

// ============================================
// REPOSITORY
// ============================================

export const einvoiceRepository = {
  // ============================================
  // SETTINGS
  // ============================================

  getSettings: async (userId: string) => {
    return db.query.einvoiceSettings.findFirst({
      where: eq(einvoiceSettings.userId, userId),
    });
  },

  createSettings: async (input: CreateEInvoiceSettingsInput) => {
    const [settings] = await db
      .insert(einvoiceSettings)
      .values({
        userId: input.userId,
        enabled: input.enabled ?? false,
        autoSubmit: input.autoSubmit ?? false,
        tin: input.tin,
        brn: input.brn,
        identificationScheme: input.identificationScheme,
        msicCode: input.msicCode,
        msicDescription: input.msicDescription,
        sstRegistration: input.sstRegistration,
        tourismTaxRegistration: input.tourismTaxRegistration,
      })
      .returning();

    return settings;
  },

  updateSettings: async (userId: string, input: UpdateEInvoiceSettingsInput) => {
    const [settings] = await db
      .update(einvoiceSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(einvoiceSettings.userId, userId))
      .returning();

    return settings;
  },

  upsertSettings: async (userId: string, input: UpdateEInvoiceSettingsInput) => {
    // Use transaction to prevent race conditions
    return db.transaction(async (tx) => {
      const existing = await tx.query.einvoiceSettings.findFirst({
        where: eq(einvoiceSettings.userId, userId),
      });

      if (existing) {
        const [settings] = await tx
          .update(einvoiceSettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(einvoiceSettings.userId, userId))
          .returning();
        return settings;
      }

      const [settings] = await tx
        .insert(einvoiceSettings)
        .values({
          userId,
          enabled: input.enabled ?? false,
          autoSubmit: input.autoSubmit ?? false,
          tin: input.tin,
          brn: input.brn,
          identificationScheme: input.identificationScheme,
          msicCode: input.msicCode,
          msicDescription: input.msicDescription,
          sstRegistration: input.sstRegistration,
          tourismTaxRegistration: input.tourismTaxRegistration,
        })
        .returning();
      return settings;
    });
  },

  // ============================================
  // SUBMISSIONS
  // ============================================

  createSubmission: async (input: CreateEInvoiceSubmissionInput) => {
    const [submission] = await db
      .insert(einvoiceSubmissions)
      .values({
        invoiceId: input.invoiceId,
        documentType: input.documentType,
        status: "pending",
        rawRequest: input.rawRequest,
      })
      .returning();

    return submission;
  },

  updateSubmission: async (id: string, input: UpdateEInvoiceSubmissionInput) => {
    const [submission] = await db
      .update(einvoiceSubmissions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(einvoiceSubmissions.id, id))
      .returning();

    return submission;
  },

  getSubmissionById: async (id: string) => {
    return db.query.einvoiceSubmissions.findFirst({
      where: eq(einvoiceSubmissions.id, id),
    });
  },

  getSubmissionByDocumentUuid: async (documentUuid: string) => {
    return db.query.einvoiceSubmissions.findFirst({
      where: eq(einvoiceSubmissions.documentUuid, documentUuid),
    });
  },

  getSubmissionsByInvoiceId: async (invoiceId: string) => {
    return db.query.einvoiceSubmissions.findMany({
      where: eq(einvoiceSubmissions.invoiceId, invoiceId),
      orderBy: [desc(einvoiceSubmissions.createdAt)],
    });
  },

  getLatestSubmissionForInvoice: async (invoiceId: string) => {
    return db.query.einvoiceSubmissions.findFirst({
      where: eq(einvoiceSubmissions.invoiceId, invoiceId),
      orderBy: [desc(einvoiceSubmissions.createdAt)],
    });
  },

  // ============================================
  // INVOICE E-INVOICE STATUS
  // ============================================

  updateInvoiceEInvoiceStatus: async (
    invoiceId: string,
    userId: string,
    status: string | null
  ) => {
    const [updated] = await db
      .update(invoices)
      .set({
        einvoiceStatus: status,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .returning();

    return updated;
  },

  /**
   * Update submission and invoice status atomically in a transaction
   * This ensures consistency when recording submission results
   */
  updateSubmissionAndInvoiceStatus: async (
    submissionId: string,
    invoiceId: string,
    userId: string,
    submissionInput: UpdateEInvoiceSubmissionInput,
    invoiceStatus: string | null
  ) => {
    return db.transaction(async (tx) => {
      // Update submission
      const [submission] = await tx
        .update(einvoiceSubmissions)
        .set({
          ...submissionInput,
          updatedAt: new Date(),
        })
        .where(eq(einvoiceSubmissions.id, submissionId))
        .returning();

      // Update invoice e-invoice status
      const [invoice] = await tx
        .update(invoices)
        .set({
          einvoiceStatus: invoiceStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .returning();

      return { submission, invoice };
    });
  },

  // ============================================
  // BULK OPERATIONS
  // ============================================

  getPendingSubmissions: async () => {
    return db.query.einvoiceSubmissions.findMany({
      where: eq(einvoiceSubmissions.status, "pending"),
      orderBy: [desc(einvoiceSubmissions.createdAt)],
    });
  },

  getSubmittedSubmissions: async () => {
    return db.query.einvoiceSubmissions.findMany({
      where: eq(einvoiceSubmissions.status, "submitted"),
      orderBy: [desc(einvoiceSubmissions.createdAt)],
    });
  },
};

export type EInvoiceRepository = typeof einvoiceRepository;
