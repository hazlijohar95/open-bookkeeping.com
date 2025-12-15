/**
 * Statement of Accounts REST Routes
 * Provides REST API endpoints for customer and vendor statements
 */

import { Hono } from "hono";
import { z } from "zod";
import { db, invoices, customers, vendors, creditNotes, debitNotes } from "@open-bookkeeping/db";
import { eq, and, gte, lte, asc, count } from "drizzle-orm";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// Types for statement entries
type StatementEntry = {
  id: string;
  date: string;
  type: "invoice" | "payment" | "credit_note" | "debit_note";
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

export const statementRoutes = new Hono();

// GET /customers - List customers for statements dropdown
statementRoutes.get("/customers", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);

    const [customerList, totalResult] = await Promise.all([
      db.query.customers.findMany({
        where: eq(customers.userId, user.id),
        orderBy: [asc(customers.name)],
        columns: {
          id: true,
          name: true,
          email: true,
        },
        limit,
        offset,
      }),
      db.select({ count: count() }).from(customers).where(eq(customers.userId, user.id)),
    ]);

    return c.json({
      items: customerList,
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching customers:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch customers");
  }
});

// GET /vendors - List vendors for statements dropdown
statementRoutes.get("/vendors", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);

    const [vendorList, totalResult] = await Promise.all([
      db.query.vendors.findMany({
        where: eq(vendors.userId, user.id),
        orderBy: [asc(vendors.name)],
        columns: {
          id: true,
          name: true,
          email: true,
        },
        limit,
        offset,
      }),
      db.select({ count: count() }).from(vendors).where(eq(vendors.userId, user.id)),
    ]);

    return c.json({
      items: vendorList,
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching vendors:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch vendors");
  }
});

// GET /customers/summary - Get summary for all customers
statementRoutes.get("/customers/summary", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const { limit, offset } = paginationQuerySchema.parse(query);

    // Get paginated customer list and total count
    const [customerList, totalResult] = await Promise.all([
      db.query.customers.findMany({
        where: eq(customers.userId, user.id),
        orderBy: [asc(customers.name)],
        limit,
        offset,
      }),
      db.select({ count: count() }).from(customers).where(eq(customers.userId, user.id)),
    ]);

    const summaries = [];

    for (const customer of customerList) {
      // Get invoices for this customer
      const customerInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.userId, user.id),
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
          eq(creditNotes.userId, user.id),
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
          eq(debitNotes.userId, user.id),
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

    return c.json({
      items: summaries,
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(c, error);
    }
    console.error("Error fetching customer summaries:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch customer summaries");
  }
});

// GET /customer/:id - Get customer statement
statementRoutes.get("/customer/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const customerId = c.req.param("id");
  if (!uuidParamSchema.safeParse(customerId).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid customer ID format");
  }

  try {
    const query = c.req.query();
    const startDateStr = query.startDate;
    const endDateStr = query.endDate;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Verify customer belongs to user
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.userId, user.id)),
    });

    if (!customer) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Customer not found");
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
        eq(invoices.userId, user.id),
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
        eq(creditNotes.userId, user.id),
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
        eq(debitNotes.userId, user.id),
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
    let entryCounter = 0;

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
        id: `entry-${++entryCounter}`,
        date: invoice.createdAt.toISOString(),
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
          id: `entry-${++entryCounter}`,
          date: invoice.paidAt.toISOString(),
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
        id: `entry-${++entryCounter}`,
        date: (creditNote.issuedAt || creditNote.createdAt).toISOString(),
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
        id: `entry-${++entryCounter}`,
        date: (debitNote.issuedAt || debitNote.createdAt).toISOString(),
        type: "debit_note",
        reference,
        description: `Debit Note ${reference}`,
        debit: debitNoteTotal,
        credit: 0,
        balance: 0,
      });
    }

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    return c.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        address: customer.address,
      },
      entries,
      summary: {
        openingBalance: 0,
        totalDebits,
        totalCredits,
        closingBalance,
      },
      currency,
    });
  } catch (error) {
    console.error("Error fetching customer statement:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch customer statement");
  }
});

// GET /vendor/:id - Get vendor statement
statementRoutes.get("/vendor/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const vendorId = c.req.param("id");
  if (!uuidParamSchema.safeParse(vendorId).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid vendor ID format");
  }

  try {
    const query = c.req.query();
    const startDateStr = query.startDate;
    const endDateStr = query.endDate;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Verify vendor belongs to user
    const vendor = await db.query.vendors.findFirst({
      where: and(eq(vendors.id, vendorId), eq(vendors.userId, user.id)),
    });

    if (!vendor) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Vendor not found");
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
        eq(invoices.userId, user.id),
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
        eq(creditNotes.userId, user.id),
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
        eq(debitNotes.userId, user.id),
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
    let entryCounter = 0;

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
        id: `entry-${++entryCounter}`,
        date: invoice.createdAt.toISOString(),
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
          id: `entry-${++entryCounter}`,
          date: invoice.paidAt.toISOString(),
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
        id: `entry-${++entryCounter}`,
        date: (creditNote.issuedAt || creditNote.createdAt).toISOString(),
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
        id: `entry-${++entryCounter}`,
        date: (debitNote.issuedAt || debitNote.createdAt).toISOString(),
        type: "debit_note",
        reference,
        description: `Debit Note ${reference}`,
        debit: 0,
        credit: debitNoteTotal,
        balance: 0,
      });
    }

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    return c.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        address: vendor.address,
      },
      entries,
      summary: {
        openingBalance: 0,
        totalDebits,
        totalCredits,
        closingBalance,
      },
      currency,
    });
  } catch (error) {
    console.error("Error fetching vendor statement:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch vendor statement");
  }
});
