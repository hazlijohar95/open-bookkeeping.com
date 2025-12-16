/**
 * Credit Note Business Service
 *
 * Centralized business logic for credit note operations.
 * Both REST routes and tRPC services should use this layer.
 *
 * Note: Credit notes currently use the V1 schema with complex transactions.
 * This service provides a unified interface with webhook support.
 * TODO: Migrate to V2 schema (JSONB pattern) in Phase 3.
 */

import {
  db,
  creditNotes,
  creditNoteFields,
  creditNoteCompanyDetails,
  creditNoteCompanyDetailsMetadata,
  creditNoteClientDetails,
  creditNoteClientDetailsMetadata,
  creditNoteDetails,
  creditNoteDetailsBillingDetails,
  creditNoteItems,
  creditNoteMetadata,
} from "@open-bookkeeping/db";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../journalEntry.integration";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("credit-note-business");

// ============================================
// Types
// ============================================

export interface CreditNoteBusinessContext {
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

export interface CreateCreditNoteInput {
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
  creditNoteDetails: {
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

type CreditNoteStatus = "draft" | "issued" | "applied" | "cancelled";

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

export const creditNoteBusiness = {
  /**
   * List credit notes with pagination
   */
  async list(
    ctx: CreditNoteBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const userCreditNotes = await db.query.creditNotes.findMany({
      where: eq(creditNotes.userId, ctx.userId),
      with: {
        invoice: true,
        customer: true,
        vendor: true,
        creditNoteFields: {
          with: {
            companyDetails: true,
            clientDetails: true,
            creditNoteDetails: true,
            items: true,
            metadata: true,
          },
        },
      },
      limit,
      offset,
      orderBy: (creditNotes, { desc }) => [desc(creditNotes.createdAt)],
    });

    logger.debug(
      { userId: ctx.userId, count: userCreditNotes.length },
      "Listed credit notes"
    );

    return userCreditNotes;
  },

  /**
   * Get a single credit note by ID
   */
  async getById(ctx: CreditNoteBusinessContext, id: string) {
    const creditNote = await db.query.creditNotes.findFirst({
      where: and(eq(creditNotes.id, id), eq(creditNotes.userId, ctx.userId)),
      with: {
        invoice: true,
        customer: true,
        vendor: true,
        creditNoteFields: {
          with: {
            companyDetails: {
              with: { metadata: true },
            },
            clientDetails: {
              with: { metadata: true },
            },
            creditNoteDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: true,
          },
        },
      },
    });

    if (!creditNote) {
      logger.debug(
        { userId: ctx.userId, creditNoteId: id },
        "Credit note not found"
      );
      return null;
    }

    return creditNote;
  },

  /**
   * Create a new credit note
   *
   * Side effects (non-blocking):
   * - Dispatches credit-note.created webhook
   */
  async create(ctx: CreditNoteBusinessContext, input: CreateCreditNoteInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const result = await db.transaction(async (tx) => {
      // Create credit note
      const [creditNote] = await tx
        .insert(creditNotes)
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

      // Create credit note fields
      const [field] = await tx
        .insert(creditNoteFields)
        .values({ creditNoteId: creditNote!.id })
        .returning();

      // Create company details
      const [companyDetail] = await tx
        .insert(creditNoteCompanyDetails)
        .values({
          creditNoteFieldId: field!.id,
          name: input.companyDetails.name,
          address: input.companyDetails.address,
          logo: input.companyDetails.logo,
          signature: input.companyDetails.signature,
        })
        .returning();

      // Create company metadata
      if (input.companyDetails.metadata?.length) {
        await tx.insert(creditNoteCompanyDetailsMetadata).values(
          input.companyDetails.metadata.map((m) => ({
            creditNoteCompanyDetailsId: companyDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      // Create client details
      const [clientDetail] = await tx
        .insert(creditNoteClientDetails)
        .values({
          creditNoteFieldId: field!.id,
          name: input.clientDetails.name,
          address: input.clientDetails.address,
        })
        .returning();

      // Create client metadata
      if (input.clientDetails.metadata?.length) {
        await tx.insert(creditNoteClientDetailsMetadata).values(
          input.clientDetails.metadata.map((m) => ({
            creditNoteClientDetailsId: clientDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      // Create credit note details
      const [detail] = await tx
        .insert(creditNoteDetails)
        .values({
          creditNoteFieldId: field!.id,
          theme: input.creditNoteDetails.theme,
          currency: input.creditNoteDetails.currency,
          prefix: input.creditNoteDetails.prefix,
          serialNumber: input.creditNoteDetails.serialNumber,
          date: input.creditNoteDetails.date,
          originalInvoiceNumber: input.creditNoteDetails.originalInvoiceNumber,
        })
        .returning();

      // Create billing details
      if (input.creditNoteDetails.billingDetails?.length) {
        await tx.insert(creditNoteDetailsBillingDetails).values(
          input.creditNoteDetails.billingDetails.map((b) => ({
            creditNoteDetailsId: detail!.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
          }))
        );
      }

      // Create items
      if (input.items.length) {
        await tx.insert(creditNoteItems).values(
          input.items.map((item) => ({
            creditNoteFieldId: field!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
          }))
        );
      }

      // Create metadata
      if (input.metadata) {
        await tx.insert(creditNoteMetadata).values({
          creditNoteFieldId: field!.id,
          notes: input.metadata.notes,
          terms: input.metadata.terms,
        });
      }

      return { creditNoteId: creditNote!.id };
    });

    logger.info(
      { userId: ctx.userId, creditNoteId: result.creditNoteId },
      "Credit note created"
    );

    // Calculate total for webhook
    const total = calculateTotal(
      input.items,
      input.creditNoteDetails.billingDetails
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.creditNoteCreated(ctx.userId, {
      id: result.creditNoteId,
      serialNumber: `${input.creditNoteDetails.prefix}${input.creditNoteDetails.serialNumber}`,
      total,
      currency: input.creditNoteDetails.currency,
      customerId: input.customerId,
      customerName: input.clientDetails.name,
      reason: input.reason,
      originalInvoiceId: input.invoiceId,
    });

    return result;
  },

  /**
   * Update credit note status
   *
   * Side effects (non-blocking):
   * - Creates journal entry when status becomes "issued"
   * - Dispatches credit-note.applied webhook when status becomes "applied"
   */
  async updateStatus(
    ctx: CreditNoteBusinessContext,
    id: string,
    status: CreditNoteStatus
  ) {
    const creditNote = await db.query.creditNotes.findFirst({
      where: and(eq(creditNotes.id, id), eq(creditNotes.userId, ctx.userId)),
    });

    if (!creditNote) {
      return null;
    }

    await db
      .update(creditNotes)
      .set({
        status,
        issuedAt: status === "issued" ? new Date() : creditNote.issuedAt,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id));

    logger.info(
      { userId: ctx.userId, creditNoteId: id, status },
      "Credit note status updated"
    );

    // Create journal entry when credit note is issued (non-blocking)
    if (status === "issued") {
      this._createJournalEntryAsync(ctx.userId, id);
    }

    // Dispatch webhook when credit note is applied
    if (status === "applied") {
      const fullCreditNote = await this.getById(ctx, id);
      if (fullCreditNote) {
        const details = fullCreditNote.creditNoteFields?.creditNoteDetails;
        const items = fullCreditNote.creditNoteFields?.items ?? [];

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

        webhookDispatcher.creditNoteApplied(ctx.userId, {
          id,
          serialNumber: details
            ? `${details.prefix}${details.serialNumber}`
            : undefined,
          total,
          currency: details?.currency,
          customerId: fullCreditNote.customerId ?? undefined,
          originalInvoiceId: fullCreditNote.invoiceId ?? undefined,
        });
      }
    }

    return { success: true };
  },

  /**
   * Delete a credit note (only drafts)
   */
  async delete(ctx: CreditNoteBusinessContext, id: string) {
    const creditNote = await db.query.creditNotes.findFirst({
      where: and(eq(creditNotes.id, id), eq(creditNotes.userId, ctx.userId)),
    });

    if (!creditNote) {
      return null;
    }

    if (creditNote.status !== "draft") {
      throw new Error("Only draft credit notes can be deleted");
    }

    await db.delete(creditNotes).where(eq(creditNotes.id, id));

    logger.info(
      { userId: ctx.userId, creditNoteId: id },
      "Credit note deleted"
    );

    return { success: true };
  },

  /**
   * Create journal entry for credit note (internal helper)
   */
  async _createJournalEntryAsync(userId: string, creditNoteId: string) {
    const fullCreditNote = await db.query.creditNotes.findFirst({
      where: eq(creditNotes.id, creditNoteId),
      with: {
        creditNoteFields: {
          with: {
            clientDetails: true,
            creditNoteDetails: {
              with: { billingDetails: true },
            },
            items: true,
          },
        },
      },
    });

    if (!fullCreditNote?.creditNoteFields) {
      return;
    }

    const fields = fullCreditNote.creditNoteFields;
    const details = fields.creditNoteDetails;
    const items = fields.items ?? [];
    const billingDetails = details?.billingDetails ?? [];

    journalEntryIntegration
      .createCreditNoteJournalEntry(userId, {
        id: fullCreditNote.id,
        serialNumber: `${details?.prefix ?? "CN-"}${details?.serialNumber ?? ""}`,
        date: details?.date || new Date(),
        reason: fullCreditNote.reason ?? "adjustment",
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
            b.label.toLowerCase().includes("sales tax") ||
            b.label.toLowerCase().includes("service tax"),
        })),
        clientDetails: {
          name: fields.clientDetails?.name ?? "Customer",
        },
        originalInvoiceNumber: details?.originalInvoiceNumber ?? undefined,
      })
      .then((result) => {
        if (result.success) {
          logger.info(
            { creditNoteId, entryId: result.entryId },
            "Credit note journal entry created"
          );
        } else {
          logger.warn(
            { creditNoteId, error: result.error },
            "Failed to create credit note journal entry"
          );
        }
      })
      .catch((err) => {
        logger.error(
          { err, creditNoteId },
          "Error creating credit note journal entry"
        );
      });
  },
};

export type CreditNoteBusiness = typeof creditNoteBusiness;
