import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  payments,
  paymentAllocations,
  invoices,
  bills,
  accounts,
  type PaymentType,
  type PaymentMethod,
  type PaymentStatus,
} from "../schema";
import { journalEntryRepository } from "./journalEntry.repository";
import { ledgerRepository } from "./ledger.repository";

// ============= Types =============

export interface CreatePaymentInput {
  userId: string;
  paymentType: PaymentType;
  customerId?: string;
  vendorId?: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  currency?: string;
  amount: string;
  whtAmount?: string;
  whtRate?: string;
  bankAccountId?: string;
  bankTransactionId?: string;
  description?: string;
  notes?: string;
  allocations: PaymentAllocationInput[];
}

export interface PaymentAllocationInput {
  invoiceId?: string;
  billId?: string;
  creditNoteId?: string;
  debitNoteId?: string;
  allocatedAmount: string;
  whtAllocated?: string;
}

export interface PaymentQueryOptions {
  paymentType?: PaymentType;
  customerId?: string;
  vendorId?: string;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Standard Malaysian Chart of Accounts codes
const ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "1100", // AR - Customer receivables
  ACCOUNTS_PAYABLE: "2100", // AP - Vendor payables
  CASH: "1020", // Cash on hand
  BANK: "1000", // Bank account (default)
  WHT_RECEIVABLE: "1410", // WHT withheld by customers (input tax / refundable)
  WHT_PAYABLE: "2450", // WHT to be remitted to LHDN on non-resident vendor payments
};

// ============= Repository =============

export const paymentRepository = {
  /**
   * Generate unique payment number
   */
  generatePaymentNumber: async (
    userId: string,
    type: PaymentType
  ): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = type === "invoice_payment" ? `RCP-${year}-` : `PMT-${year}-`;

    const lastPayment = await db.query.payments.findFirst({
      where: and(
        eq(payments.userId, userId),
        eq(payments.paymentType, type),
        sql`${payments.paymentNumber} LIKE ${prefix + "%"}`
      ),
      orderBy: [desc(payments.paymentNumber)],
    });

    let nextNumber = 1;
    if (lastPayment) {
      const match = lastPayment.paymentNumber.match(
        /(?:RCP|PMT)-\d{4}-(\d+)/
      );
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, "0")}`;
  },

  /**
   * Get account ID by code for the user
   */
  getAccountByCode: async (
    userId: string,
    code: string
  ): Promise<string | null> => {
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.code, code),
        sql`${accounts.deletedAt} IS NULL`
      ),
    });
    return account?.id ?? null;
  },

  /**
   * Create a new payment with allocations and auto-generate journal entry
   */
  create: async (input: CreatePaymentInput) => {
    const amount = new Decimal(input.amount);
    const whtAmount = new Decimal(input.whtAmount ?? "0");

    // Validate total allocations match payment amount
    let totalAllocated = new Decimal(0);
    for (const alloc of input.allocations) {
      totalAllocated = totalAllocated.plus(alloc.allocatedAmount);
    }

    if (!totalAllocated.equals(amount)) {
      throw new Error(
        `Allocated amount (${totalAllocated.toFixed(
          2
        )}) must equal payment amount (${amount.toFixed(2)})`
      );
    }

    // Validate customer/vendor based on payment type
    if (input.paymentType === "invoice_payment" && !input.customerId) {
      throw new Error("Customer is required for invoice payments");
    }
    if (input.paymentType === "bill_payment" && !input.vendorId) {
      throw new Error("Vendor is required for bill payments");
    }

    // Generate payment number
    const paymentNumber = await paymentRepository.generatePaymentNumber(
      input.userId,
      input.paymentType
    );

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        userId: input.userId,
        paymentNumber,
        paymentType: input.paymentType,
        customerId: input.customerId ?? null,
        vendorId: input.vendorId ?? null,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        reference: input.reference ?? null,
        currency: input.currency ?? "MYR",
        amount: amount.toFixed(2),
        whtAmount: whtAmount.toFixed(2),
        whtRate: input.whtRate ?? null,
        bankAccountId: input.bankAccountId ?? null,
        bankTransactionId: input.bankTransactionId ?? null,
        status: "pending",
        description: input.description ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    if (!payment) {
      throw new Error("Failed to create payment");
    }

    // Create payment allocations
    for (const alloc of input.allocations) {
      await db.insert(paymentAllocations).values({
        paymentId: payment.id,
        invoiceId: alloc.invoiceId ?? null,
        billId: alloc.billId ?? null,
        creditNoteId: alloc.creditNoteId ?? null,
        debitNoteId: alloc.debitNoteId ?? null,
        allocatedAmount: alloc.allocatedAmount,
        whtAllocated: alloc.whtAllocated ?? "0",
      });
    }

    return payment;
  },

  /**
   * Complete a payment - creates journal entry and updates status
   */
  complete: async (paymentId: string, userId: string) => {
    // Get payment with allocations
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.userId, userId)),
      with: {
        allocations: true,
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "pending") {
      throw new Error(`Payment is already ${payment.status}`);
    }

    const amount = new Decimal(payment.amount);
    const whtAmount = new Decimal(payment.whtAmount ?? "0");
    const netReceipt = amount.minus(whtAmount); // For AR: cash received is less WHT deducted

    // Get account IDs
    const arAccountId = await paymentRepository.getAccountByCode(
      userId,
      ACCOUNT_CODES.ACCOUNTS_RECEIVABLE
    );
    const apAccountId = await paymentRepository.getAccountByCode(
      userId,
      ACCOUNT_CODES.ACCOUNTS_PAYABLE
    );
    const whtReceivableId = await paymentRepository.getAccountByCode(
      userId,
      ACCOUNT_CODES.WHT_RECEIVABLE
    );
    const whtPayableId = await paymentRepository.getAccountByCode(
      userId,
      ACCOUNT_CODES.WHT_PAYABLE
    );

    // Determine bank/cash account
    let cashBankAccountId = payment.bankAccountId;
    if (!cashBankAccountId) {
      // Default to Cash account if no bank specified
      cashBankAccountId = await paymentRepository.getAccountByCode(
        userId,
        payment.paymentMethod === "cash"
          ? ACCOUNT_CODES.CASH
          : ACCOUNT_CODES.BANK
      );
    }

    if (!cashBankAccountId) {
      throw new Error("Bank/Cash account not found");
    }

    // Build journal entry based on payment type
    const journalLines: Array<{
      accountId: string;
      debitAmount?: string;
      creditAmount?: string;
      description?: string;
    }> = [];

    if (payment.paymentType === "invoice_payment") {
      // AR Payment: Customer pays us
      // DR Cash/Bank (net amount received)
      // DR WHT Receivable (if customer deducted WHT)
      // CR Accounts Receivable (full invoice amount)

      if (!arAccountId) {
        throw new Error("Accounts Receivable account not found");
      }

      // Cash/Bank (net amount after WHT)
      if (netReceipt.greaterThan(0)) {
        journalLines.push({
          accountId: cashBankAccountId,
          debitAmount: netReceipt.toFixed(2),
          description: `Payment received - ${payment.paymentNumber}`,
        });
      }

      // WHT Receivable (if applicable)
      if (whtAmount.greaterThan(0) && whtReceivableId) {
        journalLines.push({
          accountId: whtReceivableId,
          debitAmount: whtAmount.toFixed(2),
          description: `WHT deducted by customer - ${payment.paymentNumber}`,
        });
      }

      // Credit AR for full amount
      journalLines.push({
        accountId: arAccountId,
        creditAmount: amount.toFixed(2),
        description: `AR cleared - ${payment.paymentNumber}`,
      });
    } else {
      // AP Payment: We pay vendor
      // DR Accounts Payable (full bill amount)
      // CR Cash/Bank (net amount paid)
      // CR WHT Payable (if we deducted WHT from non-resident)

      if (!apAccountId) {
        throw new Error("Accounts Payable account not found");
      }

      // Debit AP for full amount
      journalLines.push({
        accountId: apAccountId,
        debitAmount: amount.toFixed(2),
        description: `AP cleared - ${payment.paymentNumber}`,
      });

      // Cash/Bank (net amount paid)
      const netPayment = amount.minus(whtAmount);
      if (netPayment.greaterThan(0)) {
        journalLines.push({
          accountId: cashBankAccountId,
          creditAmount: netPayment.toFixed(2),
          description: `Payment made - ${payment.paymentNumber}`,
        });
      }

      // WHT Payable (if we withheld tax from non-resident vendor)
      if (whtAmount.greaterThan(0) && whtPayableId) {
        journalLines.push({
          accountId: whtPayableId,
          creditAmount: whtAmount.toFixed(2),
          description: `WHT withheld - ${payment.paymentNumber}`,
        });
      }
    }

    // Create and post journal entry
    const journalEntry = await journalEntryRepository.create({
      userId,
      entryDate: payment.paymentDate,
      description:
        payment.paymentType === "invoice_payment"
          ? `Payment received - ${payment.paymentNumber}`
          : `Payment made - ${payment.paymentNumber}`,
      reference: payment.reference ?? payment.paymentNumber,
      sourceType: "payment",
      sourceId: payment.id,
      lines: journalLines,
    });

    // Post the journal entry
    await journalEntryRepository.post(journalEntry.id, userId);

    // Update ledger transactions
    await ledgerRepository.updateLedgerTransactions(journalEntry.id, userId);

    // Update payment status and link journal entry
    await db
      .update(payments)
      .set({
        status: "completed",
        journalEntryId: journalEntry.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    // Update invoice/bill payment status
    for (const alloc of payment.allocations) {
      if (alloc.invoiceId) {
        // Check if invoice is fully paid
        await paymentRepository.updateInvoicePaymentStatus(alloc.invoiceId);
      }
      if (alloc.billId) {
        // Check if bill is fully paid
        await paymentRepository.updateBillPaymentStatus(alloc.billId);
      }
    }

    return {
      paymentId: payment.id,
      journalEntryId: journalEntry.id,
    };
  },

  /**
   * Update invoice payment status based on total payments received
   */
  updateInvoicePaymentStatus: async (invoiceId: string) => {
    // Get invoice total (simplified - actual implementation needs to calculate from invoice details)
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
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

    if (!invoice) return;

    // Calculate invoice total from items and billing details
    let invoiceTotal = new Decimal(0);
    if (invoice.invoiceFields?.items) {
      for (const item of invoice.invoiceFields.items) {
        invoiceTotal = invoiceTotal.plus(
          new Decimal(item.unitPrice).times(item.quantity)
        );
      }
    }

    // Apply billing details (tax, discounts)
    if (invoice.invoiceFields?.invoiceDetails?.billingDetails) {
      for (const detail of invoice.invoiceFields.invoiceDetails.billingDetails) {
        if (detail.type === "percentage") {
          invoiceTotal = invoiceTotal.times(
            new Decimal(1).plus(new Decimal(detail.value).dividedBy(100))
          );
        } else {
          invoiceTotal = invoiceTotal.plus(detail.value);
        }
      }
    }

    // Get total payments allocated to this invoice
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.invoiceId, invoiceId),
      with: {
        payment: true,
      },
    });

    let totalPaid = new Decimal(0);
    for (const alloc of allocations) {
      if (alloc.payment.status === "completed") {
        totalPaid = totalPaid.plus(alloc.allocatedAmount);
      }
    }

    // Update invoice status
    if (totalPaid.greaterThanOrEqualTo(invoiceTotal)) {
      await db
        .update(invoices)
        .set({
          status: "success",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));
    }
  },

  /**
   * Update bill payment status based on total payments made
   */
  updateBillPaymentStatus: async (billId: string) => {
    const bill = await db.query.bills.findFirst({
      where: eq(bills.id, billId),
    });

    if (!bill || !bill.total) return;

    const billTotal = new Decimal(bill.total);

    // Get total payments allocated to this bill
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.billId, billId),
      with: {
        payment: true,
      },
    });

    let totalPaid = new Decimal(0);
    for (const alloc of allocations) {
      if (alloc.payment.status === "completed") {
        totalPaid = totalPaid.plus(alloc.allocatedAmount);
      }
    }

    // Update bill status
    if (totalPaid.greaterThanOrEqualTo(billTotal)) {
      await db
        .update(bills)
        .set({
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));
    }
  },

  /**
   * Cancel a payment
   */
  cancel: async (paymentId: string, userId: string) => {
    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.userId, userId)),
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status === "cancelled") {
      throw new Error("Payment is already cancelled");
    }

    // If journal entry exists, reverse it
    if (payment.journalEntryId) {
      const today = new Date().toISOString().split("T")[0]!;
      await journalEntryRepository.reverse(payment.journalEntryId, userId, today);
    }

    // Update payment status
    await db
      .update(payments)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    return { success: true };
  },

  /**
   * Find payment by ID
   */
  findById: async (id: string, userId: string) => {
    return db.query.payments.findFirst({
      where: and(eq(payments.id, id), eq(payments.userId, userId)),
      with: {
        customer: true,
        vendor: true,
        bankAccount: true,
        bankTransaction: true,
        journalEntry: {
          with: {
            lines: {
              with: {
                account: true,
              },
            },
          },
        },
        allocations: {
          with: {
            invoice: true,
            bill: true,
            creditNote: true,
            debitNote: true,
          },
        },
      },
    });
  },

  /**
   * Find all payments for a user
   */
  findAll: async (userId: string, options?: PaymentQueryOptions) => {
    const {
      paymentType,
      customerId,
      vendorId,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = options ?? {};

    const conditions = [
      eq(payments.userId, userId),
      sql`${payments.deletedAt} IS NULL`,
    ];

    if (paymentType) {
      conditions.push(eq(payments.paymentType, paymentType));
    }
    if (customerId) {
      conditions.push(eq(payments.customerId, customerId));
    }
    if (vendorId) {
      conditions.push(eq(payments.vendorId, vendorId));
    }
    if (status) {
      conditions.push(eq(payments.status, status));
    }
    if (startDate) {
      conditions.push(gte(payments.paymentDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(payments.paymentDate, endDate));
    }

    return db.query.payments.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        vendor: true,
        allocations: true,
      },
      orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Get payments for a specific invoice
   */
  findByInvoiceId: async (invoiceId: string, userId: string) => {
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.invoiceId, invoiceId),
      with: {
        payment: {
          with: {
            customer: true,
          },
        },
      },
    });

    return allocations
      .filter((a) => a.payment.userId === userId)
      .map((a) => ({
        ...a.payment,
        allocatedAmount: a.allocatedAmount,
        whtAllocated: a.whtAllocated,
      }));
  },

  /**
   * Get payments for a specific bill
   */
  findByBillId: async (billId: string, userId: string) => {
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.billId, billId),
      with: {
        payment: {
          with: {
            vendor: true,
          },
        },
      },
    });

    return allocations
      .filter((a) => a.payment.userId === userId)
      .map((a) => ({
        ...a.payment,
        allocatedAmount: a.allocatedAmount,
        whtAllocated: a.whtAllocated,
      }));
  },

  /**
   * Get outstanding amount for an invoice
   */
  getInvoiceOutstanding: async (invoiceId: string): Promise<string> => {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
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

    if (!invoice) return "0";

    // Calculate invoice total
    let invoiceTotal = new Decimal(0);
    if (invoice.invoiceFields?.items) {
      for (const item of invoice.invoiceFields.items) {
        invoiceTotal = invoiceTotal.plus(
          new Decimal(item.unitPrice).times(item.quantity)
        );
      }
    }

    // Apply billing details
    if (invoice.invoiceFields?.invoiceDetails?.billingDetails) {
      for (const detail of invoice.invoiceFields.invoiceDetails.billingDetails) {
        if (detail.type === "percentage") {
          invoiceTotal = invoiceTotal.times(
            new Decimal(1).plus(new Decimal(detail.value).dividedBy(100))
          );
        } else {
          invoiceTotal = invoiceTotal.plus(detail.value);
        }
      }
    }

    // Get total payments
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.invoiceId, invoiceId),
      with: {
        payment: true,
      },
    });

    let totalPaid = new Decimal(0);
    for (const alloc of allocations) {
      if (alloc.payment.status === "completed") {
        totalPaid = totalPaid.plus(alloc.allocatedAmount);
      }
    }

    return invoiceTotal.minus(totalPaid).toFixed(2);
  },

  /**
   * Get outstanding amount for a bill
   */
  getBillOutstanding: async (billId: string): Promise<string> => {
    const bill = await db.query.bills.findFirst({
      where: eq(bills.id, billId),
    });

    if (!bill || !bill.total) return "0";

    const billTotal = new Decimal(bill.total);

    // Get total payments
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.billId, billId),
      with: {
        payment: true,
      },
    });

    let totalPaid = new Decimal(0);
    for (const alloc of allocations) {
      if (alloc.payment.status === "completed") {
        totalPaid = totalPaid.plus(alloc.allocatedAmount);
      }
    }

    return billTotal.minus(totalPaid).toFixed(2);
  },
};

export type PaymentRepository = typeof paymentRepository;
