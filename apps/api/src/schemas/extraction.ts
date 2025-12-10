import { z } from "zod";

/**
 * Schema for extracting invoice data from documents using AI
 */
export const extractedInvoiceSchema = z.object({
  vendorName: z.string().describe("Name of the vendor/seller/company issuing the invoice"),
  vendorAddress: z.string().optional().describe("Full address of the vendor"),
  invoiceNumber: z.string().describe("Invoice number or reference"),
  invoiceDate: z.string().describe("Date the invoice was issued (YYYY-MM-DD format)"),
  dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD format)"),
  currency: z.string().default("USD").describe("Currency code (e.g., USD, MYR, EUR)"),
  items: z.array(z.object({
    description: z.string().describe("Description of the item or service"),
    quantity: z.number().describe("Quantity of items"),
    unitPrice: z.number().describe("Price per unit"),
    amount: z.number().describe("Total amount for this line item"),
  })).describe("Line items on the invoice"),
  subtotal: z.number().describe("Subtotal before tax"),
  taxAmount: z.number().optional().describe("Tax amount if applicable"),
  totalAmount: z.number().describe("Total amount due"),
});

/**
 * Schema for extracting receipt data from documents using AI
 */
export const extractedReceiptSchema = z.object({
  merchantName: z.string().describe("Name of the merchant/store"),
  merchantAddress: z.string().optional().describe("Address of the merchant"),
  date: z.string().describe("Date of the transaction (YYYY-MM-DD format)"),
  items: z.array(z.object({
    description: z.string().describe("Item name or description"),
    quantity: z.number().default(1).describe("Quantity purchased"),
    price: z.number().describe("Price of the item"),
  })).describe("Items purchased"),
  subtotal: z.number().optional().describe("Subtotal before tax"),
  tax: z.number().optional().describe("Tax amount"),
  total: z.number().describe("Total amount paid"),
  paymentMethod: z.string().optional().describe("Payment method used (cash, card, etc.)"),
});

/**
 * Schema for extracting bank statement data from documents using AI
 */
export const extractedBankStatementSchema = z.object({
  bankName: z.string().describe("Name of the bank"),
  accountNumber: z.string().describe("Account number (may be partially masked)"),
  accountHolder: z.string().optional().describe("Name of the account holder"),
  statementPeriod: z.object({
    from: z.string().describe("Statement start date (YYYY-MM-DD format)"),
    to: z.string().describe("Statement end date (YYYY-MM-DD format)"),
  }).describe("Period covered by the statement"),
  openingBalance: z.number().describe("Balance at the start of the period"),
  closingBalance: z.number().describe("Balance at the end of the period"),
  transactions: z.array(z.object({
    date: z.string().describe("Transaction date (YYYY-MM-DD format)"),
    description: z.string().describe("Transaction description"),
    amount: z.number().describe("Transaction amount (positive for credits, negative for debits)"),
    type: z.enum(["credit", "debit"]).describe("Whether money was added or removed"),
    balance: z.number().optional().describe("Running balance after this transaction"),
  })).describe("List of transactions in the statement"),
  currency: z.string().default("USD").describe("Currency code"),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;
export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;
export type ExtractedBankStatement = z.infer<typeof extractedBankStatementSchema>;
