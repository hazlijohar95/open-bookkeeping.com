import { eq, and, isNull, desc, ne } from "drizzle-orm";
import { db } from "../index";
import {
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
  sstTransactions,
} from "../schema";

export interface MetadataItem {
  label: string;
  value: string;
}

export interface BillingDetail {
  label: string;
  type: "fixed" | "percentage";
  value: number;
  // SST fields for Malaysian Sales and Service Tax
  isSstTax?: boolean;
  sstTaxType?: "sales_tax" | "service_tax";
  sstRateCode?: string; // ST_10, ST_5, ST_0, SVT_6, SVT_8
}

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  userId: string;
  customerId?: string;
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
  invoiceDetails: {
    theme?: {
      baseColor: string;
      mode: "dark" | "light";
      template?: "default" | "cynco" | "classic" | "zen" | "executive";
    };
    currency: string;
    prefix: string;
    serialNumber: string;
    date: Date;
    dueDate?: Date | null;
    paymentTerms?: string;
    billingDetails?: BillingDetail[];
  };
  items: InvoiceItem[];
  metadata?: {
    notes?: string;
    terms?: string;
    paymentInformation?: MetadataItem[];
  };
}

export interface InvoiceQueryOptions {
  limit?: number;
  offset?: number;
}

export interface InvoiceListItem {
  id: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  customerId: string | null;
  serialNumber: string | null;
  prefix: string | null;
  clientName: string | null;
  amount: number;
  currency: string | null;
  dueDate: Date | null;
}

export type InvoiceStatus = "pending" | "success" | "error" | "expired" | "refunded";

export const invoiceRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
      with: {
        invoiceFields: {
          with: {
            companyDetails: {
              with: { metadata: true },
            },
            clientDetails: {
              with: { metadata: true },
            },
            invoiceDetails: {
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
  },

  findMany: async (userId: string, options?: InvoiceQueryOptions) => {
    const { limit = 50, offset = 0 } = options ?? {};

    const userInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
      with: {
        invoiceFields: {
          with: {
            companyDetails: true,
            clientDetails: true,
            invoiceDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: true,
          },
        },
      },
      limit,
      offset,
      orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    });

    return userInvoices.map((invoice) => ({
      ...invoice,
      invoiceFields: invoice.invoiceFields
        ? {
            companyDetails: invoice.invoiceFields.companyDetails,
            clientDetails: invoice.invoiceFields.clientDetails,
            invoiceDetails: invoice.invoiceFields.invoiceDetails,
            items: invoice.invoiceFields.items,
            metadata: invoice.invoiceFields.metadata,
          }
        : null,
    }));
  },

  /**
   * Lightweight list query - only loads fields needed for list/table views.
   * Much faster than findMany for large invoice counts.
   */
  findManyLight: async (userId: string, options?: InvoiceQueryOptions): Promise<InvoiceListItem[]> => {
    const { limit = 50, offset = 0 } = options ?? {};

    const userInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
      with: {
        invoiceFields: {
          with: {
            clientDetails: {
              columns: { name: true },
            },
            invoiceDetails: {
              columns: { serialNumber: true, prefix: true, currency: true, dueDate: true },
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
        paidAt: true,
        customerId: true,
      },
      limit,
      offset,
      orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    });

    return userInvoices.map((invoice) => {
      // Calculate amount from items
      const amount = invoice.invoiceFields?.items?.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
        0
      ) ?? 0;

      return {
        id: invoice.id,
        status: invoice.status,
        createdAt: invoice.createdAt,
        paidAt: invoice.paidAt,
        customerId: invoice.customerId,
        serialNumber: invoice.invoiceFields?.invoiceDetails?.serialNumber ?? null,
        prefix: invoice.invoiceFields?.invoiceDetails?.prefix ?? null,
        clientName: invoice.invoiceFields?.clientDetails?.name ?? null,
        amount,
        currency: invoice.invoiceFields?.invoiceDetails?.currency ?? null,
        dueDate: invoice.invoiceFields?.invoiceDetails?.dueDate ?? null,
      };
    });
  },

  create: async (input: CreateInvoiceInput) => {
    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          userId: input.userId,
          customerId: input.customerId,
          type: "server",
          status: "pending",
        })
        .returning();

      const [field] = await tx
        .insert(invoiceFields)
        .values({ invoiceId: invoice!.id })
        .returning();

      const [companyDetail] = await tx
        .insert(invoiceCompanyDetails)
        .values({
          invoiceFieldId: field!.id,
          name: input.companyDetails.name,
          address: input.companyDetails.address,
          logo: input.companyDetails.logo,
          signature: input.companyDetails.signature,
        })
        .returning();

      if (input.companyDetails.metadata?.length) {
        await tx.insert(invoiceCompanyDetailsMetadata).values(
          input.companyDetails.metadata.map((m) => ({
            invoiceCompanyDetailsId: companyDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [clientDetail] = await tx
        .insert(invoiceClientDetails)
        .values({
          invoiceFieldId: field!.id,
          name: input.clientDetails.name,
          address: input.clientDetails.address,
        })
        .returning();

      if (input.clientDetails.metadata?.length) {
        await tx.insert(invoiceClientDetailsMetadata).values(
          input.clientDetails.metadata.map((m) => ({
            invoiceClientDetailsId: clientDetail!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      const [detail] = await tx
        .insert(invoiceDetails)
        .values({
          invoiceFieldId: field!.id,
          theme: input.invoiceDetails.theme,
          currency: input.invoiceDetails.currency,
          prefix: input.invoiceDetails.prefix,
          serialNumber: input.invoiceDetails.serialNumber,
          date: input.invoiceDetails.date,
          dueDate: input.invoiceDetails.dueDate,
          paymentTerms: input.invoiceDetails.paymentTerms,
        })
        .returning();

      if (input.invoiceDetails.billingDetails?.length) {
        await tx.insert(invoiceDetailsBillingDetails).values(
          input.invoiceDetails.billingDetails.map((b) => ({
            invoiceDetailsId: detail!.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
            isSstTax: b.isSstTax,
            sstTaxType: b.sstTaxType,
            sstRateCode: b.sstRateCode,
          }))
        );

        // Create SST transactions for billing details that are SST taxes
        const sstBillingDetails = input.invoiceDetails.billingDetails.filter(
          (b) => b.isSstTax && b.sstTaxType
        );

        if (sstBillingDetails.length > 0) {
          // Calculate subtotal from items
          const subtotal = input.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          );

          // Format tax period as YYYY-MM
          const invoiceDate = input.invoiceDetails.date;
          const taxPeriod = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, "0")}`;

          // Create SST transaction records
          const sstRecords = sstBillingDetails.map((b) => {
            // Calculate taxable amount based on the tax rate
            // For percentage type, calculate tax amount from subtotal
            const taxRate = b.value; // The value is the percentage rate
            const taxableAmount = subtotal;
            const taxAmount = (subtotal * taxRate) / 100;

            return {
              userId: input.userId,
              documentType: "invoice" as const,
              documentId: invoice!.id,
              documentNumber: `${input.invoiceDetails.prefix}${input.invoiceDetails.serialNumber}`,
              taxType: b.sstTaxType!,
              taxRate: String(taxRate),
              taxableAmount: String(taxableAmount),
              taxAmount: String(taxAmount),
              taxPeriod,
              customerName: input.clientDetails.name,
              documentDate: invoiceDate,
              description: b.label,
            };
          });

          await tx.insert(sstTransactions).values(sstRecords);
        }
      }

      if (input.items.length) {
        await tx.insert(invoiceItems).values(
          input.items.map((item) => ({
            invoiceFieldId: field!.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
          }))
        );
      }

      if (input.metadata) {
        const [meta] = await tx
          .insert(invoiceMetadata)
          .values({
            invoiceFieldId: field!.id,
            notes: input.metadata.notes,
            terms: input.metadata.terms,
          })
          .returning();

        if (input.metadata.paymentInformation?.length) {
          await tx.insert(invoiceMetadataPaymentInformation).values(
            input.metadata.paymentInformation.map((p) => ({
              invoiceMetadataId: meta!.id,
              label: p.label,
              value: p.value,
            }))
          );
        }
      }

      return { invoiceId: invoice!.id };
    });
  },

  updateStatus: async (id: string, userId: string, status: InvoiceStatus) => {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.userId, userId)),
    });

    if (!invoice) {
      return null;
    }

    const [updated] = await db
      .update(invoices)
      .set({
        status,
        paidAt: status === "success" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();

    return updated;
  },

  delete: async (id: string, userId: string) => {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
    });

    if (!invoice) {
      return false;
    }

    // Soft delete - set deletedAt timestamp
    await db
      .update(invoices)
      .set({ deletedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

    return true;
  },

  exists: async (id: string, userId: string) => {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
      columns: { id: true },
    });
    return !!invoice;
  },

  findByCustomer: async (customerId: string, userId: string, options?: InvoiceQueryOptions) => {
    const { limit = 50, offset = 0 } = options ?? {};

    return db.query.invoices.findMany({
      where: and(
        eq(invoices.customerId, customerId),
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt)
      ),
      with: {
        invoiceFields: {
          with: {
            companyDetails: true,
            clientDetails: true,
            invoiceDetails: {
              with: { billingDetails: true },
            },
            items: true,
            metadata: true,
          },
        },
      },
      limit,
      offset,
      orderBy: [desc(invoices.createdAt)],
    });
  },

  getUnpaidByCustomer: async (customerId: string, userId: string) => {
    return db.query.invoices.findMany({
      where: and(
        eq(invoices.customerId, customerId),
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt),
        ne(invoices.status, "success"),
        ne(invoices.status, "refunded")
      ),
      with: {
        invoiceFields: {
          with: {
            invoiceDetails: {
              with: { billingDetails: true },
            },
            items: true,
          },
        },
      },
      orderBy: [desc(invoices.createdAt)],
    });
  },

  getAgingReport: async (userId: string, customerId?: string) => {
    // Build conditions
    const conditions = [
      eq(invoices.userId, userId),
      isNull(invoices.deletedAt),
      ne(invoices.status, "success"),
      ne(invoices.status, "refunded"),
    ];

    if (customerId) {
      conditions.push(eq(invoices.customerId, customerId));
    }

    // Use lightweight query - only load what's needed for aging calculation
    const unpaidInvoices = await db.query.invoices.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        status: true,
        createdAt: true,
      },
      with: {
        invoiceFields: {
          with: {
            invoiceDetails: {
              columns: { dueDate: true },
            },
            items: {
              columns: { quantity: true, unitPrice: true },
            },
          },
        },
      },
    });

    // Helper to calculate invoice total from items
    const calculateInvoiceTotal = (invoice: typeof unpaidInvoices[number]): number => {
      const items = invoice.invoiceFields?.items ?? [];
      return items.reduce((sum, item) => {
        const qty = parseFloat(String(item.quantity ?? 0));
        const price = parseFloat(String(item.unitPrice ?? 0));
        return sum + (qty * price);
      }, 0);
    };

    // Helper to sum amounts for a bucket of invoices
    const sumBucketAmounts = (invoiceList: typeof unpaidInvoices): number => {
      return invoiceList.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
    };

    // Calculate aging buckets
    const now = new Date();
    const buckets = {
      current: [] as typeof unpaidInvoices,
      days1to30: [] as typeof unpaidInvoices,
      days31to60: [] as typeof unpaidInvoices,
      days61to90: [] as typeof unpaidInvoices,
      over90: [] as typeof unpaidInvoices,
    };

    for (const invoice of unpaidInvoices) {
      const dueDate = invoice.invoiceFields?.invoiceDetails?.dueDate;
      if (!dueDate) {
        buckets.current.push(invoice);
        continue;
      }

      const dueDateObj = new Date(dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        buckets.current.push(invoice);
      } else if (daysOverdue <= 30) {
        buckets.days1to30.push(invoice);
      } else if (daysOverdue <= 60) {
        buckets.days31to60.push(invoice);
      } else if (daysOverdue <= 90) {
        buckets.days61to90.push(invoice);
      } else {
        buckets.over90.push(invoice);
      }
    }

    // Calculate both counts and amounts for each bucket
    return {
      buckets,
      totals: {
        // Counts (number of invoices)
        currentCount: buckets.current.length,
        days1to30Count: buckets.days1to30.length,
        days31to60Count: buckets.days31to60.length,
        days61to90Count: buckets.days61to90.length,
        over90Count: buckets.over90.length,
        totalCount: unpaidInvoices.length,
        // Amounts (sum of invoice totals) - the critical financial metric
        current: sumBucketAmounts(buckets.current),
        days1to30: sumBucketAmounts(buckets.days1to30),
        days31to60: sumBucketAmounts(buckets.days31to60),
        days61to90: sumBucketAmounts(buckets.days61to90),
        over90: sumBucketAmounts(buckets.over90),
        total: sumBucketAmounts(unpaidInvoices),
      },
    };
  },
};

export type InvoiceRepository = typeof invoiceRepository;

// Type for the full invoice with all relations (from findById)
export type InvoiceWithDetails = NonNullable<
  Awaited<ReturnType<typeof invoiceRepository.findById>>
>;
