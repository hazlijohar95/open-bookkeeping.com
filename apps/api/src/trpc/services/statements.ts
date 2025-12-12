import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db, invoices, customers, vendors, creditNotes, debitNotes } from "@open-bookkeeping/db";
import { eq, and, gte, lte, asc, count } from "drizzle-orm";
import { paginationBaseSchema } from "../../schemas/common";

// Types for statement entries
type StatementEntry = {
  date: Date;
  type: "invoice" | "payment" | "quotation" | "credit_note" | "debit_note";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

// Helper to calculate subtotal from items
const calculateItemsSubtotal = (items: Array<{ quantity: number; unitPrice: string }> | undefined) => {
  return items?.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  ) ?? 0;
};

// Helper to calculate total including billing details (taxes, discounts)
const calculateTotal = (
  items: Array<{ quantity: number; unitPrice: string }> | undefined,
  billingDetails: Array<{ type: string; value: string }> | undefined
) => {
  const subtotal = calculateItemsSubtotal(items);

  if (!billingDetails || billingDetails.length === 0) {
    return subtotal;
  }

  // Apply billing details (taxes add, discounts subtract based on type)
  let adjustments = 0;
  for (const detail of billingDetails) {
    const value = Number(detail.value);
    if (detail.type === "percentage") {
      adjustments += (subtotal * value) / 100;
    } else {
      // fixed amount
      adjustments += value;
    }
  }

  return subtotal + adjustments;
};

export const statementsRouter = router({
  // Get customer list for dropdown with optional pagination
  getCustomers: protectedProcedure
    .input(paginationBaseSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { limit = 100, offset = 0 } = input ?? {};

      const [customerList, totalResult] = await Promise.all([
        db.query.customers.findMany({
          where: eq(customers.userId, userId),
          orderBy: [asc(customers.name)],
          columns: {
            id: true,
            name: true,
            email: true,
          },
          limit,
          offset,
        }),
        db.select({ count: count() }).from(customers).where(eq(customers.userId, userId)),
      ]);

      return {
        items: customerList,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  // Get vendor list for dropdown with optional pagination
  getVendors: protectedProcedure
    .input(paginationBaseSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { limit = 100, offset = 0 } = input ?? {};

      const [vendorList, totalResult] = await Promise.all([
        db.query.vendors.findMany({
          where: eq(vendors.userId, userId),
          orderBy: [asc(vendors.name)],
          columns: {
            id: true,
            name: true,
            email: true,
          },
          limit,
          offset,
        }),
        db.select({ count: count() }).from(vendors).where(eq(vendors.userId, userId)),
      ]);

      return {
        items: vendorList,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  // Get customer statement of accounts
  getCustomerStatement: protectedProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { customerId, startDate, endDate } = input;

      // Verify customer belongs to user
      const customer = await db.query.customers.findFirst({
        where: and(eq(customers.id, customerId), eq(customers.userId, userId)),
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      // Build date conditions for invoices
      const invoiceDateConditions = [];
      if (startDate) {
        invoiceDateConditions.push(gte(invoices.createdAt, startDate));
      }
      if (endDate) {
        invoiceDateConditions.push(lte(invoices.createdAt, endDate));
      }

      // Get all invoices for this customer
      const customerInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.userId, userId),
          eq(invoices.customerId, customerId),
          ...invoiceDateConditions
        ),
        with: {
          invoiceFields: {
            with: {
              invoiceDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(invoices.createdAt)],
      });

      // Build date conditions for credit notes
      const creditNoteDateConditions = [];
      if (startDate) {
        creditNoteDateConditions.push(gte(creditNotes.createdAt, startDate));
      }
      if (endDate) {
        creditNoteDateConditions.push(lte(creditNotes.createdAt, endDate));
      }

      // Get all issued credit notes for this customer
      const customerCreditNotes = await db.query.creditNotes.findMany({
        where: and(
          eq(creditNotes.userId, userId),
          eq(creditNotes.customerId, customerId),
          eq(creditNotes.status, "issued"),
          ...creditNoteDateConditions
        ),
        with: {
          creditNoteFields: {
            with: {
              creditNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(creditNotes.createdAt)],
      });

      // Build date conditions for debit notes
      const debitNoteDateConditions = [];
      if (startDate) {
        debitNoteDateConditions.push(gte(debitNotes.createdAt, startDate));
      }
      if (endDate) {
        debitNoteDateConditions.push(lte(debitNotes.createdAt, endDate));
      }

      // Get all issued debit notes for this customer
      const customerDebitNotes = await db.query.debitNotes.findMany({
        where: and(
          eq(debitNotes.userId, userId),
          eq(debitNotes.customerId, customerId),
          eq(debitNotes.status, "issued"),
          ...debitNoteDateConditions
        ),
        with: {
          debitNoteFields: {
            with: {
              debitNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(debitNotes.createdAt)],
      });

      // Build statement entries
      const entries: StatementEntry[] = [];

      // Process invoices
      for (const invoice of customerInvoices) {
        const invoiceTotal = calculateTotal(
          invoice.invoiceFields?.items,
          invoice.invoiceFields?.invoiceDetails?.billingDetails
        );
        const serialNumber =
          invoice.invoiceFields?.invoiceDetails?.serialNumber || invoice.id;

        // Add invoice entry (debit - what customer owes)
        entries.push({
          date: invoice.createdAt,
          type: "invoice",
          reference: serialNumber,
          description: `Invoice ${serialNumber}`,
          debit: invoiceTotal,
          credit: 0,
          balance: 0,
        });

        // If paid, add payment entry (credit)
        if (invoice.status === "success" && invoice.paidAt) {
          entries.push({
            date: invoice.paidAt,
            type: "payment",
            reference: `PMT-${serialNumber}`,
            description: `Payment for Invoice ${serialNumber}`,
            debit: 0,
            credit: invoiceTotal,
            balance: 0,
          });
        }
      }

      // Process credit notes (CREDIT - reduces what customer owes)
      for (const creditNote of customerCreditNotes) {
        const creditNoteTotal = calculateTotal(
          creditNote.creditNoteFields?.items,
          creditNote.creditNoteFields?.creditNoteDetails?.billingDetails
        );
        const serialNumber =
          creditNote.creditNoteFields?.creditNoteDetails?.serialNumber || creditNote.id;
        const prefix = creditNote.creditNoteFields?.creditNoteDetails?.prefix ?? "CN-";
        const reference = `${prefix}${serialNumber}`;

        entries.push({
          date: creditNote.issuedAt || creditNote.createdAt,
          type: "credit_note",
          reference,
          description: `Credit Note ${reference}`,
          debit: 0,
          credit: creditNoteTotal,
          balance: 0,
        });
      }

      // Process debit notes (DEBIT - increases what customer owes)
      for (const debitNote of customerDebitNotes) {
        const debitNoteTotal = calculateTotal(
          debitNote.debitNoteFields?.items,
          debitNote.debitNoteFields?.debitNoteDetails?.billingDetails
        );
        const serialNumber =
          debitNote.debitNoteFields?.debitNoteDetails?.serialNumber || debitNote.id;
        const prefix = debitNote.debitNoteFields?.debitNoteDetails?.prefix ?? "DN-";
        const reference = `${prefix}${serialNumber}`;

        entries.push({
          date: debitNote.issuedAt || debitNote.createdAt,
          type: "debit_note",
          reference,
          description: `Debit Note ${reference}`,
          debit: debitNoteTotal,
          credit: 0,
          balance: 0,
        });
      }

      // Sort entries by date
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate running balance
      let balance = 0;
      for (const entry of entries) {
        balance += entry.debit - entry.credit;
        entry.balance = balance;
      }

      // Calculate summary
      const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = totalDebits - totalCredits;

      // Get currency from first invoice or credit note
      const currency =
        customerInvoices[0]?.invoiceFields?.invoiceDetails?.currency ||
        customerCreditNotes[0]?.creditNoteFields?.creditNoteDetails?.currency ||
        "MYR";

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          address: customer.address,
        },
        period: {
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
        entries,
        summary: {
          openingBalance: 0,
          totalDebits,
          totalCredits,
          closingBalance,
        },
        currency,
        generatedAt: new Date(),
      };
    }),

  // Get vendor statement of accounts
  getVendorStatement: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { vendorId, startDate, endDate } = input;

      // Verify vendor belongs to user
      const vendor = await db.query.vendors.findFirst({
        where: and(eq(vendors.id, vendorId), eq(vendors.userId, userId)),
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Build date conditions for invoices
      const invoiceDateConditions = [];
      if (startDate) {
        invoiceDateConditions.push(gte(invoices.createdAt, startDate));
      }
      if (endDate) {
        invoiceDateConditions.push(lte(invoices.createdAt, endDate));
      }

      // Get all invoices for this vendor
      const vendorInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.userId, userId),
          eq(invoices.vendorId, vendorId),
          ...invoiceDateConditions
        ),
        with: {
          invoiceFields: {
            with: {
              invoiceDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(invoices.createdAt)],
      });

      // Build date conditions for credit notes
      const creditNoteDateConditions = [];
      if (startDate) {
        creditNoteDateConditions.push(gte(creditNotes.createdAt, startDate));
      }
      if (endDate) {
        creditNoteDateConditions.push(lte(creditNotes.createdAt, endDate));
      }

      // Get all issued credit notes from this vendor (DEBIT - reduces what we owe)
      const vendorCreditNotes = await db.query.creditNotes.findMany({
        where: and(
          eq(creditNotes.userId, userId),
          eq(creditNotes.vendorId, vendorId),
          eq(creditNotes.status, "issued"),
          ...creditNoteDateConditions
        ),
        with: {
          creditNoteFields: {
            with: {
              creditNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(creditNotes.createdAt)],
      });

      // Build date conditions for debit notes
      const debitNoteDateConditions = [];
      if (startDate) {
        debitNoteDateConditions.push(gte(debitNotes.createdAt, startDate));
      }
      if (endDate) {
        debitNoteDateConditions.push(lte(debitNotes.createdAt, endDate));
      }

      // Get all issued debit notes from this vendor (CREDIT - increases what we owe)
      const vendorDebitNotes = await db.query.debitNotes.findMany({
        where: and(
          eq(debitNotes.userId, userId),
          eq(debitNotes.vendorId, vendorId),
          eq(debitNotes.status, "issued"),
          ...debitNoteDateConditions
        ),
        with: {
          debitNoteFields: {
            with: {
              debitNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
        orderBy: [asc(debitNotes.createdAt)],
      });

      // Build statement entries (for vendor, credit = what we owe them)
      const entries: StatementEntry[] = [];

      // Process invoices
      for (const invoice of vendorInvoices) {
        const invoiceTotal = calculateTotal(
          invoice.invoiceFields?.items,
          invoice.invoiceFields?.invoiceDetails?.billingDetails
        );
        const serialNumber =
          invoice.invoiceFields?.invoiceDetails?.serialNumber || invoice.id;

        // Add invoice entry (credit - what we owe vendor)
        entries.push({
          date: invoice.createdAt,
          type: "invoice",
          reference: serialNumber,
          description: `Invoice ${serialNumber}`,
          debit: 0,
          credit: invoiceTotal,
          balance: 0,
        });

        // If paid, add payment entry (debit - we paid them)
        if (invoice.status === "success" && invoice.paidAt) {
          entries.push({
            date: invoice.paidAt,
            type: "payment",
            reference: `PMT-${serialNumber}`,
            description: `Payment for Invoice ${serialNumber}`,
            debit: invoiceTotal,
            credit: 0,
            balance: 0,
          });
        }
      }

      // Process credit notes from vendor (DEBIT - reduces what we owe)
      for (const creditNote of vendorCreditNotes) {
        const creditNoteTotal = calculateTotal(
          creditNote.creditNoteFields?.items,
          creditNote.creditNoteFields?.creditNoteDetails?.billingDetails
        );
        const serialNumber =
          creditNote.creditNoteFields?.creditNoteDetails?.serialNumber || creditNote.id;
        const prefix = creditNote.creditNoteFields?.creditNoteDetails?.prefix ?? "CN-";
        const reference = `${prefix}${serialNumber}`;

        entries.push({
          date: creditNote.issuedAt || creditNote.createdAt,
          type: "credit_note",
          reference,
          description: `Credit Note ${reference}`,
          debit: creditNoteTotal,
          credit: 0,
          balance: 0,
        });
      }

      // Process debit notes from vendor (CREDIT - increases what we owe)
      for (const debitNote of vendorDebitNotes) {
        const debitNoteTotal = calculateTotal(
          debitNote.debitNoteFields?.items,
          debitNote.debitNoteFields?.debitNoteDetails?.billingDetails
        );
        const serialNumber =
          debitNote.debitNoteFields?.debitNoteDetails?.serialNumber || debitNote.id;
        const prefix = debitNote.debitNoteFields?.debitNoteDetails?.prefix ?? "DN-";
        const reference = `${prefix}${serialNumber}`;

        entries.push({
          date: debitNote.issuedAt || debitNote.createdAt,
          type: "debit_note",
          reference,
          description: `Debit Note ${reference}`,
          debit: 0,
          credit: debitNoteTotal,
          balance: 0,
        });
      }

      // Sort entries by date
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate running balance (for vendor: credit - debit = what we owe)
      let balance = 0;
      for (const entry of entries) {
        balance += entry.credit - entry.debit;
        entry.balance = balance;
      }

      // Calculate summary
      const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = totalCredits - totalDebits;

      // Get currency from first invoice or credit note
      const currency =
        vendorInvoices[0]?.invoiceFields?.invoiceDetails?.currency ||
        vendorCreditNotes[0]?.creditNoteFields?.creditNoteDetails?.currency ||
        "MYR";

      return {
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          address: vendor.address,
        },
        period: {
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
        entries,
        summary: {
          openingBalance: 0,
          totalDebits,
          totalCredits,
          closingBalance,
        },
        currency,
        generatedAt: new Date(),
      };
    }),

  // Get statement summary for all customers with pagination
  getAllCustomersSummary: protectedProcedure
    .input(paginationBaseSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { limit = 50, offset = 0 } = input ?? {};

      // Get paginated customer list and total count
      const [customerList, totalResult] = await Promise.all([
        db.query.customers.findMany({
          where: eq(customers.userId, userId),
          orderBy: [asc(customers.name)],
          limit,
          offset,
        }),
        db.select({ count: count() }).from(customers).where(eq(customers.userId, userId)),
      ]);

      const summaries = [];

    for (const customer of customerList) {
      // Get invoices for this customer
      const customerInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.userId, userId),
          eq(invoices.customerId, customer.id)
        ),
        with: {
          invoiceFields: {
            with: {
              invoiceDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
      });

      // Get issued credit notes for this customer
      const customerCreditNotes = await db.query.creditNotes.findMany({
        where: and(
          eq(creditNotes.userId, userId),
          eq(creditNotes.customerId, customer.id),
          eq(creditNotes.status, "issued")
        ),
        with: {
          creditNoteFields: {
            with: {
              creditNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
      });

      // Get issued debit notes for this customer
      const customerDebitNotes = await db.query.debitNotes.findMany({
        where: and(
          eq(debitNotes.userId, userId),
          eq(debitNotes.customerId, customer.id),
          eq(debitNotes.status, "issued")
        ),
        with: {
          debitNoteFields: {
            with: {
              debitNoteDetails: {
                with: {
                  billingDetails: true,
                },
              },
              items: true,
            },
          },
        },
      });

      let totalOwed = 0;
      let totalPaid = 0;
      let totalCreditNotes = 0;
      let totalDebitNotes = 0;

      // Sum up invoices
      for (const invoice of customerInvoices) {
        const total = calculateTotal(
          invoice.invoiceFields?.items,
          invoice.invoiceFields?.invoiceDetails?.billingDetails
        );
        totalOwed += total;
        if (invoice.status === "success") {
          totalPaid += total;
        }
      }

      // Sum up credit notes (reduces what customer owes)
      for (const creditNote of customerCreditNotes) {
        totalCreditNotes += calculateTotal(
          creditNote.creditNoteFields?.items,
          creditNote.creditNoteFields?.creditNoteDetails?.billingDetails
        );
      }

      // Sum up debit notes (increases what customer owes)
      for (const debitNote of customerDebitNotes) {
        totalDebitNotes += calculateTotal(
          debitNote.debitNoteFields?.items,
          debitNote.debitNoteFields?.debitNoteDetails?.billingDetails
        );
      }

      // Outstanding = invoices + debit notes - payments - credit notes
      const outstanding = totalOwed + totalDebitNotes - totalPaid - totalCreditNotes;

      summaries.push({
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        totalInvoiced: totalOwed,
        totalPaid,
        totalCreditNotes,
        totalDebitNotes,
        outstanding,
        invoiceCount: customerInvoices.length,
        creditNoteCount: customerCreditNotes.length,
        debitNoteCount: customerDebitNotes.length,
      });
    }

      // Sort by outstanding amount (descending)
      summaries.sort((a, b) => b.outstanding - a.outstanding);

      return {
        items: summaries,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),
});
