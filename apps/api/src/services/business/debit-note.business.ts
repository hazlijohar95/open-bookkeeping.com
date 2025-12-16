/**
 * Debit Note Business Service
 *
 * Centralized business logic for debit note operations.
 * Both REST routes and tRPC services should use this layer.
 *
 * Note: Debit notes currently use the V1 schema with complex transactions.
 * This service provides a unified interface with webhook support.
 * TODO: Migrate to V2 schema (JSONB pattern) in Phase 3.
 */

import {
  db,
  debitNotes,
  debitNoteFields,
  debitNoteCompanyDetails,
  debitNoteCompanyDetailsMetadata,
  debitNoteClientDetails,
  debitNoteClientDetailsMetadata,
  debitNoteDetails,
  debitNoteDetailsBillingDetails,
  debitNoteItems,
  debitNoteMetadata,
} from "@open-bookkeeping/db";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../journalEntry.integration";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("debit-note-business");

// ============================================
// Types
// ============================================

export interface DebitNoteBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

export interface MetadataItem {
  label: string;
  value: string;
}

export interface BillingDetail {
  label: string;
  type: "fixed" | "percentage";
  value: string | number;
}

export interface DocumentItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateDebitNoteInput {
  invoiceId?: string;
  customerId?: string;
  vendorId?: string;
  reason: "return" | "discount" | "pricing_error" | "damaged_goods" | "other";
  reasonDescription?: string;
  companyDetails: {
    name: string;
    address: string;
    logo?: string | null;
    signature?: string | null;
    metadata?: MetadataItem[];
  };
  clientDetails: {
    name: string;
    address: string;
    metadata?: MetadataItem[];
  };
  debitNoteDetails: {
    theme?: {
      baseColor: string;
      mode: "dark" | "light";
      template?: "default" | "cynco" | "classic" | "zen" | "executive";
    };
    currency: string;
    prefix: string;
    serialNumber: string;
    date: Date;
    originalInvoiceNumber?: string;
    billingDetails?: BillingDetail[];
  };
  items: DocumentItem[];
  metadata?: {
    notes?: string;
    terms?: string;
  };
}

type DebitNoteStatus = "draft" | "issued" | "applied" | "cancelled";

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate total from items and billing details
 */
function calculateTotal(
  items: DocumentItem[],
  billingDetails?: BillingDetail[]
): number {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  if (!billingDetails?.length) {
    return subtotal;
  }

  let total = subtotal;
  for (const detail of billingDetails) {
    const value =
      typeof detail.value === "string"
        ? parseFloat(detail.value)
        : detail.value;

    if (detail.type === "percentage") {
      total += subtotal * (value / 100);
    } else {
      total += value;
    }
  }

  return total;
}

// ============================================
// Business Service
// ============================================

export const debitNoteBusiness = {
  /**
   * List debit notes with pagination
   */
  async list(
    ctx: DebitNoteBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const userDebitNotes = await db.query.debitNotes.findMany({
      where: eq(debitNotes.userId, ctx.userId),
      with: {
        invoice: true,
        customer: true,
        vendor: true,
        debitNoteFields: {
          with: {
            companyDetails: true,
            clientDetails: true,
            debitNoteDetails: true,
            items: true,
            metadata: true,
          },
        },
      },
      limit,
      offset,
      orderBy: (debitNotes, { desc }) => [desc(debitNotes.createdAt)],
    });

    logger.debug(
      { userId: ctx.userId, count: userDebitNotes.length },
      "Listed debit notes"
    );

    return userDebitNotes;
  },

  /**
   * Get a single debit note by ID
   */
  async getById(ctx: DebitNoteBusinessContext, id: string) {
    const debitNote = await db.query.debitNotes.findFirst({
      where: and(eq(debitNotes.id, id), eq(debitNotes.userId, ctx.userId)),
      with: {
        invoice: true,
        customer: true,
        vendor: true,
        debitNoteFields: {
          with: {
            companyDetails: {
              with: { metadata: true },
            },
            clientDetails: {
              with: { metadata: true },
            },
            debitNoteDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: true,
          },
        },
      },
    });

    if (!debitNote) {
      logger.debug(
        { userId: ctx.userId, debitNoteId: id },
        "Debit note not found"
      );
      return null;
    }

    return debitNote;
  },

  /**
   * Create a new debit note
   *
   * Side effects (non-blocking):
   * - Dispatches debit-note.created webhook
   */
  async create(ctx: DebitNoteBusinessContext, input: CreateDebitNoteInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const result = await db.transaction(async (tx) => {
      // Create debit note
      const [debitNote] = await tx
        .insert(debitNotes)
        .values({
          userId: ctx.userId,
          invoiceId: input.invoiceId,
          customerId: input.customerId,
          vendorId: input.vendorId,
          type: "server",
          status: "draft",
          reason: input.reason,
          reasonDescription: input.reasonDescription,
        })
        .returning();

      // Create debit note fields
      const [field] = await tx
        .insert(debitNoteFields)
        .values({ debitNoteId: debitNote!.id })
        .returning();

      // Create company details
      const [companyDetail] = await tx
        .insert(debitNoteCompanyDetails)
        .values({
          debitNoteFieldId: field!.id,
          name: input.companyDetails.name,
          address: input.companyDetails.address,
          logo: input.companyDetails.logo,
          signature: input.companyDetails.signature,
        })
        .returning();

      // Create company metadata
      if (input.companyDetails.metadata?.length) {
        await tx.insert(debitNoteCompanyDetailsMetadata).values(
          input.companyDetails.metadata.map((m) => ({
            debitNoteCompanyDetailsId: companyDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      // Create client details
      const [clientDetail] = await tx
        .insert(debitNoteClientDetails)
        .values({
          debitNoteFieldId: field!.id,
          name: input.clientDetails.name,
          address: input.clientDetails.address,
        })
        .returning();

      // Create client metadata
      if (input.clientDetails.metadata?.length) {
        await tx.insert(debitNoteClientDetailsMetadata).values(
          input.clientDetails.metadata.map((m) => ({
            debitNoteClientDetailsId: clientDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      // Create debit note details
      const [detail] = await tx
        .insert(debitNoteDetails)
        .values({
          debitNoteFieldId: field!.id,
          theme: input.debitNoteDetails.theme,
          currency: input.debitNoteDetails.currency,
          prefix: input.debitNoteDetails.prefix,
          serialNumber: input.debitNoteDetails.serialNumber,
          date: input.debitNoteDetails.date,
          originalInvoiceNumber: input.debitNoteDetails.originalInvoiceNumber,
        })
        .returning();

      // Create billing details
      if (input.debitNoteDetails.billingDetails?.length) {
        await tx.insert(debitNoteDetailsBillingDetails).values(
          input.debitNoteDetails.billingDetails.map((b) => ({
            debitNoteDetailsId: detail!.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
          }))
        );
      }

      // Create items
      if (input.items.length) {
        await tx.insert(debitNoteItems).values(
          input.items.map((item) => ({
            debitNoteFieldId: field!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
          }))
        );
      }

      // Create metadata
      if (input.metadata) {
        await tx.insert(debitNoteMetadata).values({
          debitNoteFieldId: field!.id,
          notes: input.metadata.notes,
          terms: input.metadata.terms,
        });
      }

      return { debitNoteId: debitNote!.id };
    });

    logger.info(
      { userId: ctx.userId, debitNoteId: result.debitNoteId },
      "Debit note created"
    );

    // Calculate total for webhook
    const total = calculateTotal(
      input.items,
      input.debitNoteDetails.billingDetails
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.debitNoteCreated(ctx.userId, {
      id: result.debitNoteId,
      serialNumber: `${input.debitNoteDetails.prefix}${input.debitNoteDetails.serialNumber}`,
      total,
      currency: input.debitNoteDetails.currency,
      customerId: input.customerId,
      customerName: input.clientDetails.name,
      reason: input.reason,
      originalInvoiceId: input.invoiceId,
    });

    return result;
  },

  /**
   * Update debit note status
   *
   * Side effects (non-blocking):
   * - Creates journal entry when status becomes "issued"
   * - Dispatches debit-note.applied webhook when status becomes "applied"
   */
  async updateStatus(
    ctx: DebitNoteBusinessContext,
    id: string,
    status: DebitNoteStatus
  ) {
    const debitNote = await db.query.debitNotes.findFirst({
      where: and(eq(debitNotes.id, id), eq(debitNotes.userId, ctx.userId)),
    });

    if (!debitNote) {
      return null;
    }

    await db
      .update(debitNotes)
      .set({
        status,
        issuedAt: status === "issued" ? new Date() : debitNote.issuedAt,
        updatedAt: new Date(),
      })
      .where(eq(debitNotes.id, id));

    logger.info(
      { userId: ctx.userId, debitNoteId: id, status },
      "Debit note status updated"
    );

    // Create journal entry when debit note is issued (non-blocking)
    if (status === "issued") {
      this._createJournalEntryAsync(ctx.userId, id);
    }

    // Dispatch webhook when debit note is applied
    if (status === "applied") {
      const fullDebitNote = await this.getById(ctx, id);
      if (fullDebitNote) {
        const details = fullDebitNote.debitNoteFields?.debitNoteDetails;
        const items = fullDebitNote.debitNoteFields?.items ?? [];

        const total = calculateTotal(
          items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: parseFloat(i.unitPrice),
          })),
          details?.billingDetails?.map((b) => ({
            label: b.label,
            type: b.type as "fixed" | "percentage",
            value: b.value,
          }))
        );

        webhookDispatcher.debitNoteApplied(ctx.userId, {
          id,
          serialNumber: details
            ? `${details.prefix}${details.serialNumber}`
            : undefined,
          total,
          currency: details?.currency,
          customerId: fullDebitNote.customerId ?? undefined,
          originalInvoiceId: fullDebitNote.invoiceId ?? undefined,
        });
      }
    }

    return { success: true };
  },

  /**
   * Delete a debit note (only drafts)
   */
  async delete(ctx: DebitNoteBusinessContext, id: string) {
    const debitNote = await db.query.debitNotes.findFirst({
      where: and(eq(debitNotes.id, id), eq(debitNotes.userId, ctx.userId)),
    });

    if (!debitNote) {
      return null;
    }

    if (debitNote.status !== "draft") {
      throw new Error("Only draft debit notes can be deleted");
    }

    await db.delete(debitNotes).where(eq(debitNotes.id, id));

    logger.info({ userId: ctx.userId, debitNoteId: id }, "Debit note deleted");

    return { success: true };
  },

  /**
   * Create journal entry for debit note (internal helper)
   */
  async _createJournalEntryAsync(userId: string, debitNoteId: string) {
    const fullDebitNote = await db.query.debitNotes.findFirst({
      where: eq(debitNotes.id, debitNoteId),
      with: {
        debitNoteFields: {
          with: {
            clientDetails: true,
            debitNoteDetails: {
              with: { billingDetails: true },
            },
            items: true,
          },
        },
      },
    });

    if (!fullDebitNote?.debitNoteFields) {
      return;
    }

    const fields = fullDebitNote.debitNoteFields;
    const details = fields.debitNoteDetails;
    const items = fields.items ?? [];
    const billingDetails = details?.billingDetails ?? [];

    journalEntryIntegration
      .createDebitNoteJournalEntry(userId, {
        id: fullDebitNote.id,
        serialNumber: `${details?.prefix ?? "DN-"}${details?.serialNumber ?? ""}`,
        date: details?.date || new Date(),
        reason: fullDebitNote.reason ?? "adjustment",
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
        })),
        billingDetails: billingDetails.map((b) => ({
          label: b.label,
          type: b.type as "fixed" | "percentage",
          value: parseFloat(b.value),
          isSstTax:
            b.label.toLowerCase().includes("sst") ||
            b.label.toLowerCase().includes("tax"),
        })),
        clientDetails: {
          name: fields.clientDetails?.name ?? "Customer",
        },
        originalInvoiceNumber: details?.originalInvoiceNumber ?? undefined,
      })
      .then((result) => {
        if (result.success) {
          logger.info(
            { debitNoteId, entryId: result.entryId },
            "Debit note journal entry created"
          );
        } else {
          logger.warn(
            { debitNoteId, error: result.error },
            "Failed to create debit note journal entry"
          );
        }
      })
      .catch((err) => {
        logger.error(
          { err, debitNoteId },
          "Error creating debit note journal entry"
        );
      });
  },
};

export type DebitNoteBusiness = typeof debitNoteBusiness;
