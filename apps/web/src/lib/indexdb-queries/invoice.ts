import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { IDB_SCHEMA_INVOICES } from "@/constants/indexed-db";
import type { IDBInvoice, IDBInvoiceItem } from "@/types/indexdb/invoice";
import type { BillingDetailV2 } from "@/types/common/invoice";
import { ERROR_MESSAGES } from "@/constants/issues";
import { initIndexedDB } from "@/global/indexdb";
import { v4 as uuidv4 } from "uuid";

/**
 * Convert form schema to V2 IDBInvoice structure
 */
function formToV2Invoice(
  invoice: ZodCreateInvoiceSchema,
  id: string,
  existingInvoice?: IDBInvoice
): IDBInvoice {
  // Calculate totals from items
  const items: IDBInvoiceItem[] = invoice.items.map((item, index) => {
    const quantity = String(item.quantity);
    const unitPrice = String(item.unitPrice);
    const amount = (item.quantity * item.unitPrice).toFixed(2);

    return {
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description || null,
      quantity,
      unitPrice,
      amount,
      unit: null,
      sku: null,
      taxRate: null,
      discount: null,
      sortOrder: index,
    };
  });

  const subtotal = items
    .reduce((sum, item) => sum + parseFloat(item.amount), 0)
    .toFixed(2);

  // Calculate tax/discount from billing details
  let taxTotal = 0;
  let discountTotal = 0;
  const billingDetails: BillingDetailV2[] = (
    invoice.invoiceDetails.billingDetails || []
  ).map((bd) => {
    const numValue = bd.value;

    if (numValue >= 0) {
      if (bd.type === "percentage") {
        taxTotal += (parseFloat(subtotal) * numValue) / 100;
      } else {
        taxTotal += numValue;
      }
    } else {
      if (bd.type === "percentage") {
        discountTotal += (parseFloat(subtotal) * Math.abs(numValue)) / 100;
      } else {
        discountTotal += Math.abs(numValue);
      }
    }

    return {
      label: bd.label,
      type: bd.type,
      value: String(bd.value),
      isSstTax: bd.isSstTax,
      sstTaxType: bd.sstTaxType,
      sstRateCode: bd.sstRateCode,
    };
  });

  const total = (parseFloat(subtotal) + taxTotal - discountTotal).toFixed(2);
  const existingStatus = existingInvoice?.status ?? "draft";
  const isPaid = existingStatus === "paid";

  return {
    id,
    type: "local",
    status: existingStatus,
    prefix: invoice.invoiceDetails.prefix,
    serialNumber: invoice.invoiceDetails.serialNumber,
    currency: invoice.invoiceDetails.currency || "MYR",
    invoiceDate: new Date(invoice.invoiceDetails.date),
    dueDate: invoice.invoiceDetails.dueDate
      ? new Date(invoice.invoiceDetails.dueDate)
      : null,
    paymentTerms: invoice.invoiceDetails.paymentTerms || null,
    subtotal,
    taxTotal: taxTotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    total,
    amountPaid: isPaid ? total : "0.00",
    amountDue: isPaid ? "0.00" : total,
    theme: invoice.invoiceDetails.theme || null,
    companyDetails: {
      name: invoice.companyDetails.name,
      address: invoice.companyDetails.address,
      logo: invoice.companyDetails.logo,
      signature: invoice.companyDetails.signature,
      metadata: invoice.companyDetails.metadata,
    },
    clientDetails: {
      name: invoice.clientDetails.name,
      address: invoice.clientDetails.address,
      metadata: invoice.clientDetails.metadata,
    },
    billingDetails,
    metadata: {
      notes: invoice.metadata?.notes,
      terms: invoice.metadata?.terms,
      paymentInformation: invoice.metadata?.paymentInformation,
    },
    items,
    createdAt: existingInvoice?.createdAt ?? new Date(),
    updatedAt: new Date(),
    paidAt: existingInvoice?.paidAt ?? null,
  };
}

/**
 * Force insert an invoice into the database (V2 format)
 * @param invoice - The invoice form data to insert
 * @returns {Promise<string>} - The new invoice ID
 * @description This function will override the existing invoice if it already exists because it contains db.put() method. using db.add() to add new record
 */
export const forceInsertInvoice = async (
  invoice: ZodCreateInvoiceSchema
): Promise<string> => {
  const db = await initIndexedDB();

  const id = uuidv4();
  const v2Invoice = formToV2Invoice(invoice, id);

  await db.put(IDB_SCHEMA_INVOICES, v2Invoice);

  return id;
};

/**
 * Get all invoices from the database
 * @returns {Promise<IDBInvoice[]>}
 */
export const getAllInvoices = async (): Promise<IDBInvoice[]> => {
  const db = await initIndexedDB();
  return await db.getAll(IDB_SCHEMA_INVOICES);
};

/**
 * Get an invoice from the database by id
 * @param id - The id of the invoice
 * @returns {Promise<IDBInvoice>}
 */
export const getInvoiceById = async (
  id: string
): Promise<IDBInvoice | undefined> => {
  const db = await initIndexedDB();
  return await db.get(IDB_SCHEMA_INVOICES, id);
};

/**
 * Update an invoice in the database (V2 format)
 * @param id - The id of the invoice
 * @param invoice - The invoice form data to update
 * @returns {Promise<void>}
 */
export const updateInvoice = async (
  id: string,
  invoice: ZodCreateInvoiceSchema
): Promise<void> => {
  const db = await initIndexedDB();

  const oldInvoice = await db.get(IDB_SCHEMA_INVOICES, id);

  if (!oldInvoice) {
    throw new Error(ERROR_MESSAGES.INVOICE_NOT_FOUND);
  }

  // Convert form data to V2 format, preserving existing invoice data
  const v2Invoice = formToV2Invoice(invoice, id, oldInvoice);

  await db.put(IDB_SCHEMA_INVOICES, v2Invoice);
};

/**
 * Update the status of a local invoice
 * @param id - The id of the invoice
 * @param status - The new status (V2 format)
 * @returns {Promise<void>}
 */
export const updateInvoiceStatus = async (
  id: string,
  status: IDBInvoice["status"]
): Promise<void> => {
  const db = await initIndexedDB();

  const invoice = await db.get(IDB_SCHEMA_INVOICES, id);

  if (!invoice) {
    throw new Error(ERROR_MESSAGES.INVOICE_NOT_FOUND);
  }

  // Update amountPaid/amountDue when marking as paid
  const isPaid = status === "paid";
  const total = invoice.total;

  await db.put(IDB_SCHEMA_INVOICES, {
    ...invoice,
    status,
    updatedAt: new Date(),
    amountPaid: isPaid ? total : invoice.amountPaid,
    amountDue: isPaid ? "0.00" : invoice.amountDue,
    paidAt: isPaid ? new Date() : invoice.paidAt,
  });
};

/**
 * Delete an invoice from the database
 * @param id - The id of the invoice
 * @returns {Promise<boolean>} - Returns true if deleted, false if not found
 */
export const deleteInvoice = async (id: string): Promise<boolean> => {
  const db = await initIndexedDB();

  const invoice = await db.get(IDB_SCHEMA_INVOICES, id);

  if (!invoice) {
    return false;
  }

  await db.delete(IDB_SCHEMA_INVOICES, id);
  return true;
};
