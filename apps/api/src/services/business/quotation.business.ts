/**
 * Quotation Business Service
 *
 * Centralized business logic for quotation operations.
 * Both REST routes and tRPC services should use this layer.
 *
 * Responsibilities:
 * - Core CRUD operations via repository
 * - Webhook dispatching (non-blocking)
 * - Status management
 * - Convert to invoice
 * - Structured logging
 */

import { quotationRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("quotation-business");

// ============================================
// Types
// ============================================

export interface QuotationItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface MetadataItem {
  label: string;
  value: string;
}

export interface BillingDetail {
  label: string;
  type: "fixed" | "percentage";
  value: number;
  isSstTax?: boolean;
  sstTaxType?: "sales_tax" | "service_tax";
  sstRateCode?: string;
}

export interface CreateQuotationInput {
  customerId?: string;
  validUntil?: string;
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
  quotationDetails: {
    theme?: {
      baseColor: string;
      mode: "dark" | "light";
      template?: "default" | "cynco" | "classic" | "zen" | "executive";
    };
    currency: string;
    prefix: string;
    serialNumber: string;
    date: Date;
    validUntil?: Date | null;
    paymentTerms?: string;
    billingDetails?: BillingDetail[];
  };
  items: QuotationItem[];
  metadata?: {
    notes?: string;
    terms?: string;
    paymentInformation?: MetadataItem[];
  };
}

export interface QuotationBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate quotation total from items and billing details
 */
function calculateQuotationTotal(
  items: QuotationItem[],
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

export const quotationBusiness = {
  /**
   * List quotations with pagination
   */
  async list(
    ctx: QuotationBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const quotations = await quotationRepository.findMany(ctx.userId, {
      limit,
      offset,
    });

    logger.debug(
      { userId: ctx.userId, count: quotations.length },
      "Listed quotations"
    );

    return quotations;
  },

  /**
   * Get a single quotation by ID
   */
  async getById(ctx: QuotationBusinessContext, id: string) {
    const quotation = await quotationRepository.findById(id, ctx.userId);

    if (!quotation) {
      logger.debug(
        { userId: ctx.userId, quotationId: id },
        "Quotation not found"
      );
      return null;
    }

    return quotation;
  },

  /**
   * Create a new quotation
   *
   * Side effects (non-blocking):
   * - Dispatches quotation.created webhook
   */
  async create(ctx: QuotationBusinessContext, input: CreateQuotationInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const result = await quotationRepository.create({
      userId: ctx.userId,
      customerId: input.customerId,
      validUntil: input.validUntil,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      quotationDetails: input.quotationDetails,
      items: input.items,
      metadata: input.metadata,
    });

    logger.info(
      { userId: ctx.userId, quotationId: result.quotationId },
      "Quotation created"
    );

    // Calculate total for webhook
    const total = calculateQuotationTotal(
      input.items,
      input.quotationDetails.billingDetails
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.quotationCreated(ctx.userId, {
      id: result.quotationId,
      quotationNumber: `${input.quotationDetails.prefix}${input.quotationDetails.serialNumber}`,
      status: "draft",
      total,
      currency: input.quotationDetails.currency,
      customerId: input.customerId,
      customerName: input.clientDetails.name,
      validUntil: input.quotationDetails.validUntil,
    });

    return result;
  },

  /**
   * Update an existing quotation
   *
   * Side effects (non-blocking):
   * - Dispatches quotation.updated webhook
   */
  async update(
    ctx: QuotationBusinessContext,
    id: string,
    input: CreateQuotationInput
  ) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const result = await quotationRepository.update(id, ctx.userId, {
      userId: ctx.userId,
      customerId: input.customerId,
      validUntil: input.validUntil,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      quotationDetails: input.quotationDetails,
      items: input.items,
      metadata: input.metadata,
    });

    if (!result) {
      logger.debug(
        { userId: ctx.userId, quotationId: id },
        "Quotation not found"
      );
      return null;
    }

    logger.info({ userId: ctx.userId, quotationId: id }, "Quotation updated");

    // Calculate total for webhook
    const total = calculateQuotationTotal(
      input.items,
      input.quotationDetails.billingDetails
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.quotationUpdated(ctx.userId, {
      id,
      quotationNumber: `${input.quotationDetails.prefix}${input.quotationDetails.serialNumber}`,
      status: "draft", // Status doesn't change on update
      total,
      currency: input.quotationDetails.currency,
      customerId: input.customerId,
      customerName: input.clientDetails.name,
      validUntil: input.quotationDetails.validUntil,
    });

    return result;
  },

  /**
   * Update quotation status
   *
   * Side effects (non-blocking):
   * - Dispatches quotation.updated, quotation.accepted, or quotation.rejected webhook
   */
  async updateStatus(
    ctx: QuotationBusinessContext,
    id: string,
    status: QuotationStatus
  ) {
    const result = await quotationRepository.updateStatus(
      id,
      ctx.userId,
      status
    );

    if (!result) {
      return null;
    }

    if ("error" in result) {
      throw new Error(result.error);
    }

    logger.info(
      { userId: ctx.userId, quotationId: id, status },
      "Quotation status updated"
    );

    // Get quotation for webhook data
    const quotation = await quotationRepository.findById(id, ctx.userId);

    if (quotation) {
      const quotationFields = quotation.quotationFields;
      const details = quotationFields?.quotationDetails;
      const items = quotationFields?.items ?? [];

      const total = calculateQuotationTotal(
        items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unitPrice),
        })),
        details?.billingDetails?.map((b) => ({
          label: b.label,
          type: b.type as "fixed" | "percentage",
          value: parseFloat(b.value),
        }))
      );

      const webhookData = {
        id,
        quotationNumber: details
          ? `${details.prefix}${details.serialNumber}`
          : undefined,
        status,
        total,
        currency: details?.currency,
        customerId: quotation.customerId ?? undefined,
        customerName: quotationFields?.clientDetails?.name,
        validUntil: details?.validUntil,
      };

      // Dispatch appropriate webhook
      if (status === "accepted") {
        webhookDispatcher.quotationAccepted(ctx.userId, webhookData);
      } else if (status === "rejected") {
        webhookDispatcher.quotationRejected(ctx.userId, webhookData);
      } else {
        webhookDispatcher.quotationUpdated(ctx.userId, webhookData);
      }
    }

    return { success: true };
  },

  /**
   * Convert quotation to invoice
   *
   * Side effects (non-blocking):
   * - Dispatches quotation.converted webhook
   */
  async convertToInvoice(ctx: QuotationBusinessContext, id: string) {
    const result = await quotationRepository.convertToInvoice(id, ctx.userId);

    if ("error" in result) {
      if (result.error === "Quotation not found") {
        return null;
      }
      throw new Error(result.error);
    }

    logger.info(
      {
        userId: ctx.userId,
        quotationId: result.quotationId,
        invoiceId: result.invoiceId,
      },
      "Quotation converted to invoice"
    );

    // Get quotation for webhook data
    const quotation = await quotationRepository.findById(id, ctx.userId);

    if (quotation) {
      const quotationFields = quotation.quotationFields;
      const details = quotationFields?.quotationDetails;
      const items = quotationFields?.items ?? [];

      const total = calculateQuotationTotal(
        items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unitPrice),
        })),
        details?.billingDetails?.map((b) => ({
          label: b.label,
          type: b.type as "fixed" | "percentage",
          value: parseFloat(b.value),
        }))
      );

      // Dispatch converted webhook (non-blocking)
      webhookDispatcher.quotationConverted(ctx.userId, {
        id,
        quotationNumber: details
          ? `${details.prefix}${details.serialNumber}`
          : undefined,
        status: "accepted",
        total,
        currency: details?.currency,
        customerId: quotation.customerId ?? undefined,
        customerName: quotationFields?.clientDetails?.name,
        convertedInvoiceId: result.invoiceId,
      });
    }

    return result;
  },

  /**
   * Delete a quotation
   */
  async delete(ctx: QuotationBusinessContext, id: string) {
    const deleted = await quotationRepository.delete(id, ctx.userId);

    if (!deleted) {
      logger.debug(
        { userId: ctx.userId, quotationId: id },
        "Quotation not found"
      );
      return false;
    }

    logger.info({ userId: ctx.userId, quotationId: id }, "Quotation deleted");

    return true;
  },
};

export type QuotationBusiness = typeof quotationBusiness;
