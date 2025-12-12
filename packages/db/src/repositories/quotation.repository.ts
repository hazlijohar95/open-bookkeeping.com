import { eq, and, desc, isNull, count, sql } from "drizzle-orm";
import { db } from "../index";
import {
  quotations,
  quotationFields,
  quotationCompanyDetails,
  quotationCompanyDetailsMetadata,
  quotationClientDetails,
  quotationClientDetailsMetadata,
  quotationDetails,
  quotationDetailsBillingDetails,
  quotationItems,
  quotationMetadata,
  quotationMetadataPaymentInformation,
  invoices,
  invoiceFields,
  invoiceCompanyDetails,
  invoiceCompanyDetailsMetadata,
  invoiceClientDetails,
  invoiceClientDetailsMetadata,
  invoiceDetails,
  invoiceDetailsBillingDetails,
  invoiceItems,
  invoiceMetadata,
  invoiceMetadataPaymentInformation,
} from "../schema";

export interface MetadataItem {
  label: string;
  value: string;
}

export interface BillingDetail {
  label: string;
  type: "fixed" | "percentage";
  value: number;
}

export interface QuotationItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateQuotationInput {
  userId: string;
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

export interface QuotationQueryOptions {
  limit?: number;
  offset?: number;
}

export interface QuotationListItem {
  id: string;
  status: string;
  createdAt: Date;
  acceptedAt: Date | null;
  customerId: string | null;
  serialNumber: string | null;
  prefix: string | null;
  clientName: string | null;
  amount: number;
  currency: string | null;
  validUntil: Date | null;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export const quotationRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.quotations.findFirst({
      where: and(
        eq(quotations.id, id),
        eq(quotations.userId, userId),
        isNull(quotations.deletedAt)
      ),
      with: {
        quotationFields: {
          with: {
            companyDetails: {
              with: { metadata: true },
            },
            clientDetails: {
              with: { metadata: true },
            },
            quotationDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: {
              with: { paymentInformation: true },
            },
          },
        },
        convertedInvoice: true,
      },
    });
  },

  findMany: async (userId: string, options?: QuotationQueryOptions) => {
    const { limit = 50, offset = 0 } = options ?? {};

    const userQuotations = await db.query.quotations.findMany({
      where: and(
        eq(quotations.userId, userId),
        isNull(quotations.deletedAt)
      ),
      with: {
        quotationFields: {
          with: {
            companyDetails: true,
            clientDetails: true,
            quotationDetails: true,
            items: true,
            metadata: true,
          },
        },
        convertedInvoice: true,
      },
      limit,
      offset,
      orderBy: [desc(quotations.createdAt)],
    });

    return userQuotations.map((quotation) => ({
      ...quotation,
      quotationFields: quotation.quotationFields
        ? {
            companyDetails: quotation.quotationFields.companyDetails,
            clientDetails: quotation.quotationFields.clientDetails,
            quotationDetails: quotation.quotationFields.quotationDetails,
            items: quotation.quotationFields.items,
            metadata: quotation.quotationFields.metadata,
          }
        : null,
    }));
  },

  /**
   * Lightweight list query - only loads fields needed for list/table views.
   * Much faster than findMany for large quotation counts.
   */
  findManyLight: async (userId: string, options?: QuotationQueryOptions): Promise<QuotationListItem[]> => {
    const { limit = 50, offset = 0 } = options ?? {};

    const userQuotations = await db.query.quotations.findMany({
      where: and(
        eq(quotations.userId, userId),
        isNull(quotations.deletedAt)
      ),
      with: {
        quotationFields: {
          with: {
            clientDetails: {
              columns: { name: true },
            },
            quotationDetails: {
              columns: { serialNumber: true, prefix: true, currency: true, validUntil: true },
            },
            items: {
              columns: { quantity: true, unitPrice: true },
            },
          },
        },
      },
      columns: {
        id: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        customerId: true,
      },
      limit,
      offset,
      orderBy: [desc(quotations.createdAt)],
    });

    return userQuotations.map((quotation) => {
      // Calculate amount from items
      const amount = quotation.quotationFields?.items?.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
        0
      ) ?? 0;

      return {
        id: quotation.id,
        status: quotation.status,
        createdAt: quotation.createdAt,
        acceptedAt: quotation.acceptedAt,
        customerId: quotation.customerId,
        serialNumber: quotation.quotationFields?.quotationDetails?.serialNumber ?? null,
        prefix: quotation.quotationFields?.quotationDetails?.prefix ?? null,
        clientName: quotation.quotationFields?.clientDetails?.name ?? null,
        amount,
        currency: quotation.quotationFields?.quotationDetails?.currency ?? null,
        validUntil: quotation.quotationFields?.quotationDetails?.validUntil ?? null,
      };
    });
  },

  create: async (input: CreateQuotationInput) => {
    return db.transaction(async (tx) => {
      const [quotation] = await tx
        .insert(quotations)
        .values({
          userId: input.userId,
          customerId: input.customerId,
          type: "server",
          status: "draft",
          validUntil: input.validUntil,
        })
        .returning();

      const [field] = await tx
        .insert(quotationFields)
        .values({ quotationId: quotation!.id })
        .returning();

      const [companyDetail] = await tx
        .insert(quotationCompanyDetails)
        .values({
          quotationFieldId: field!.id,
          name: input.companyDetails.name,
          address: input.companyDetails.address,
          logo: input.companyDetails.logo,
          signature: input.companyDetails.signature,
        })
        .returning();

      if (input.companyDetails.metadata?.length) {
        await tx.insert(quotationCompanyDetailsMetadata).values(
          input.companyDetails.metadata.map((m) => ({
            quotationCompanyDetailsId: companyDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [clientDetail] = await tx
        .insert(quotationClientDetails)
        .values({
          quotationFieldId: field!.id,
          name: input.clientDetails.name,
          address: input.clientDetails.address,
        })
        .returning();

      if (input.clientDetails.metadata?.length) {
        await tx.insert(quotationClientDetailsMetadata).values(
          input.clientDetails.metadata.map((m) => ({
            quotationClientDetailsId: clientDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [detail] = await tx
        .insert(quotationDetails)
        .values({
          quotationFieldId: field!.id,
          theme: input.quotationDetails.theme,
          currency: input.quotationDetails.currency,
          prefix: input.quotationDetails.prefix,
          serialNumber: input.quotationDetails.serialNumber,
          date: input.quotationDetails.date,
          validUntil: input.quotationDetails.validUntil,
          paymentTerms: input.quotationDetails.paymentTerms,
        })
        .returning();

      if (input.quotationDetails.billingDetails?.length) {
        await tx.insert(quotationDetailsBillingDetails).values(
          input.quotationDetails.billingDetails.map((b) => ({
            quotationDetailsId: detail!.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
          }))
        );
      }

      if (input.items.length) {
        await tx.insert(quotationItems).values(
          input.items.map((item) => ({
            quotationFieldId: field!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
          }))
        );
      }

      if (input.metadata) {
        const [meta] = await tx
          .insert(quotationMetadata)
          .values({
            quotationFieldId: field!.id,
            notes: input.metadata.notes,
            terms: input.metadata.terms,
          })
          .returning();

        if (input.metadata.paymentInformation?.length) {
          await tx.insert(quotationMetadataPaymentInformation).values(
            input.metadata.paymentInformation.map((p) => ({
              quotationMetadataId: meta!.id,
              label: p.label,
              value: p.value,
            }))
          );
        }
      }

      return { quotationId: quotation!.id };
    });
  },

  update: async (id: string, userId: string, input: CreateQuotationInput) => {
    const existing = await db.query.quotations.findFirst({
      where: and(eq(quotations.id, id), eq(quotations.userId, userId)),
      with: { quotationFields: true },
    });

    if (!existing) {
      return null;
    }

    return db.transaction(async (tx) => {
      if (existing.quotationFields) {
        await tx
          .delete(quotationFields)
          .where(eq(quotationFields.id, existing.quotationFields.id));
      }

      await tx
        .update(quotations)
        .set({
          validUntil: input.validUntil,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, id));

      const [field] = await tx
        .insert(quotationFields)
        .values({ quotationId: id })
        .returning();

      const [companyDetail] = await tx
        .insert(quotationCompanyDetails)
        .values({
          quotationFieldId: field!.id,
          name: input.companyDetails.name,
          address: input.companyDetails.address,
          logo: input.companyDetails.logo,
          signature: input.companyDetails.signature,
        })
        .returning();

      if (input.companyDetails.metadata?.length) {
        await tx.insert(quotationCompanyDetailsMetadata).values(
          input.companyDetails.metadata.map((m) => ({
            quotationCompanyDetailsId: companyDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [clientDetail] = await tx
        .insert(quotationClientDetails)
        .values({
          quotationFieldId: field!.id,
          name: input.clientDetails.name,
          address: input.clientDetails.address,
        })
        .returning();

      if (input.clientDetails.metadata?.length) {
        await tx.insert(quotationClientDetailsMetadata).values(
          input.clientDetails.metadata.map((m) => ({
            quotationClientDetailsId: clientDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [detail] = await tx
        .insert(quotationDetails)
        .values({
          quotationFieldId: field!.id,
          theme: input.quotationDetails.theme,
          currency: input.quotationDetails.currency,
          prefix: input.quotationDetails.prefix,
          serialNumber: input.quotationDetails.serialNumber,
          date: input.quotationDetails.date,
          validUntil: input.quotationDetails.validUntil,
          paymentTerms: input.quotationDetails.paymentTerms,
        })
        .returning();

      if (input.quotationDetails.billingDetails?.length) {
        await tx.insert(quotationDetailsBillingDetails).values(
          input.quotationDetails.billingDetails.map((b) => ({
            quotationDetailsId: detail!.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
          }))
        );
      }

      if (input.items.length) {
        await tx.insert(quotationItems).values(
          input.items.map((item) => ({
            quotationFieldId: field!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
          }))
        );
      }

      if (input.metadata) {
        const [meta] = await tx
          .insert(quotationMetadata)
          .values({
            quotationFieldId: field!.id,
            notes: input.metadata.notes,
            terms: input.metadata.terms,
          })
          .returning();

        if (input.metadata.paymentInformation?.length) {
          await tx.insert(quotationMetadataPaymentInformation).values(
            input.metadata.paymentInformation.map((p) => ({
              quotationMetadataId: meta!.id,
              label: p.label,
              value: p.value,
            }))
          );
        }
      }

      return { quotationId: id };
    });
  },

  updateStatus: async (id: string, userId: string, status: QuotationStatus) => {
    const quotation = await db.query.quotations.findFirst({
      where: and(eq(quotations.id, id), eq(quotations.userId, userId)),
    });

    if (!quotation) {
      return null;
    }

    if (quotation.status === "converted") {
      return { error: "Cannot update status of a converted quotation" };
    }

    const [updated] = await db
      .update(quotations)
      .set({
        status,
        acceptedAt: status === "accepted" ? new Date() : quotation.acceptedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(quotations.id, id), eq(quotations.userId, userId)))
      .returning();

    return updated;
  },

  convertToInvoice: async (id: string, userId: string) => {
    const quotation = await db.query.quotations.findFirst({
      where: and(eq(quotations.id, id), eq(quotations.userId, userId)),
      with: {
        quotationFields: {
          with: {
            companyDetails: {
              with: { metadata: true },
            },
            clientDetails: {
              with: { metadata: true },
            },
            quotationDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: {
              with: { paymentInformation: true },
            },
          },
        },
      },
    });

    if (!quotation) {
      return { error: "Quotation not found" };
    }

    if (quotation.status === "converted") {
      return { error: "Quotation has already been converted to an invoice" };
    }

    if (!quotation.quotationFields) {
      return { error: "Quotation data is incomplete" };
    }

    const qf = quotation.quotationFields;

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          userId,
          type: "server",
          status: "pending",
        })
        .returning();

      const [invoiceField] = await tx
        .insert(invoiceFields)
        .values({ invoiceId: invoice!.id })
        .returning();

      if (qf.companyDetails) {
        const [companyDetail] = await tx
          .insert(invoiceCompanyDetails)
          .values({
            invoiceFieldId: invoiceField!.id,
            name: qf.companyDetails.name,
            address: qf.companyDetails.address,
            logo: qf.companyDetails.logo,
            signature: qf.companyDetails.signature,
          })
          .returning();

        if (qf.companyDetails.metadata?.length) {
          await tx.insert(invoiceCompanyDetailsMetadata).values(
            qf.companyDetails.metadata.map((m) => ({
              invoiceCompanyDetailsId: companyDetail!.id,
              label: m.label,
              value: m.value,
            }))
          );
        }
      }

      if (qf.clientDetails) {
        const [clientDetail] = await tx
          .insert(invoiceClientDetails)
          .values({
            invoiceFieldId: invoiceField!.id,
            name: qf.clientDetails.name,
            address: qf.clientDetails.address,
          })
          .returning();

        if (qf.clientDetails.metadata?.length) {
          await tx.insert(invoiceClientDetailsMetadata).values(
            qf.clientDetails.metadata.map((m) => ({
              invoiceClientDetailsId: clientDetail!.id,
              label: m.label,
              value: m.value,
            }))
          );
        }
      }

      if (qf.quotationDetails) {
        const [detail] = await tx
          .insert(invoiceDetails)
          .values({
            invoiceFieldId: invoiceField!.id,
            theme: qf.quotationDetails.theme,
            currency: qf.quotationDetails.currency,
            prefix: "INV",
            serialNumber: `${Date.now()}`,
            date: new Date(),
            dueDate: qf.quotationDetails.validUntil,
            paymentTerms: qf.quotationDetails.paymentTerms,
          })
          .returning();

        if (qf.quotationDetails.billingDetails?.length) {
          await tx.insert(invoiceDetailsBillingDetails).values(
            qf.quotationDetails.billingDetails.map((b) => ({
              invoiceDetailsId: detail!.id,
              label: b.label,
              type: b.type,
              value: b.value,
            }))
          );
        }
      }

      if (qf.items?.length) {
        await tx.insert(invoiceItems).values(
          qf.items.map((item) => ({
            invoiceFieldId: invoiceField!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        );
      }

      if (qf.metadata) {
        const [meta] = await tx
          .insert(invoiceMetadata)
          .values({
            invoiceFieldId: invoiceField!.id,
            notes: qf.metadata.notes,
            terms: qf.metadata.terms,
          })
          .returning();

        if (qf.metadata.paymentInformation?.length) {
          await tx.insert(invoiceMetadataPaymentInformation).values(
            qf.metadata.paymentInformation.map((p) => ({
              invoiceMetadataId: meta!.id,
              label: p.label,
              value: p.value,
            }))
          );
        }
      }

      await tx
        .update(quotations)
        .set({
          status: "converted",
          convertedInvoiceId: invoice!.id,
          updatedAt: new Date(),
        })
        .where(and(eq(quotations.id, id), eq(quotations.userId, userId)));

      return { invoiceId: invoice!.id, quotationId: id };
    });
  },

  delete: async (id: string, userId: string) => {
    const quotation = await db.query.quotations.findFirst({
      where: and(
        eq(quotations.id, id),
        eq(quotations.userId, userId),
        isNull(quotations.deletedAt)
      ),
    });

    if (!quotation) {
      return false;
    }

    // Soft delete - set deletedAt timestamp
    await db
      .update(quotations)
      .set({ deletedAt: new Date() })
      .where(and(eq(quotations.id, id), eq(quotations.userId, userId)));

    return true;
  },

  exists: async (id: string, userId: string) => {
    const quotation = await db.query.quotations.findFirst({
      where: and(
        eq(quotations.id, id),
        eq(quotations.userId, userId),
        isNull(quotations.deletedAt)
      ),
      columns: { id: true },
    });
    return !!quotation;
  },

  /**
   * Get quotation statistics using DB aggregation (efficient single query)
   * Returns total count, converted count, and conversion rate
   */
  getStats: async (userId: string): Promise<{
    total: number;
    converted: number;
    conversionRate: number;
  }> => {
    const result = await db
      .select({
        total: count(),
        converted: count(
          sql`CASE WHEN ${quotations.status} = 'converted' THEN 1 END`
        ),
      })
      .from(quotations)
      .where(
        and(eq(quotations.userId, userId), isNull(quotations.deletedAt))
      );

    const stats = result[0] ?? { total: 0, converted: 0 };
    const total = Number(stats.total);
    const converted = Number(stats.converted);
    const conversionRate =
      total > 0 ? Math.round((converted / total) * 100) : 0;

    return { total, converted, conversionRate };
  },
};

export type QuotationRepository = typeof quotationRepository;
