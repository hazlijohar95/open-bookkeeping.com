/**
 * Statement of Accounts Routes for Supabase Edge Functions
 * Provides customer and vendor statement generation
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Types
interface StatementEntry {
  id: string;
  date: string;
  type: "invoice" | "payment" | "credit_note" | "debit_note";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

// Schemas
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Helper to calculate subtotal from items
const calculateItemsSubtotal = (items: Array<{ quantity: number; unit_price: string }> | null) => {
  if (!items) return 0;
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
    0
  );
};

// Helper to calculate total including billing details
const calculateTotal = (
  items: Array<{ quantity: number; unit_price: string }> | null,
  billingDetails: Array<{ type: string; value: string }> | null
) => {
  const subtotal = calculateItemsSubtotal(items);

  if (!billingDetails || billingDetails.length === 0) {
    return subtotal;
  }

  let adjustments = 0;
  for (const detail of billingDetails) {
    const value = Number(detail.value);
    if (detail.type === "percentage") {
      adjustments += (subtotal * value) / 100;
    } else {
      adjustments += value;
    }
  }

  return subtotal + adjustments;
};

// List customers for dropdown
app.get("/customers", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: customers, error, count } = await db
    .from("customers")
    .select("id, name, email", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching customers:", error);
    return c.json({ error: "Failed to fetch customers" }, 500);
  }

  return c.json({
    items: customers,
    total: count || 0,
    limit,
    offset,
  });
});

// List vendors for dropdown
app.get("/vendors", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: vendors, error, count } = await db
    .from("vendors")
    .select("id, name, email", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching vendors:", error);
    return c.json({ error: "Failed to fetch vendors" }, 500);
  }

  return c.json({
    items: vendors,
    total: count || 0,
    limit,
    offset,
  });
});

// Get all customers summary
app.get("/customers/summary", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  // Get paginated customer list
  const { data: customerList, error: customersError, count } = await db
    .from("customers")
    .select("id, name, email", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (customersError) {
    console.error("Error fetching customers:", customersError);
    return c.json({ error: "Failed to fetch customers" }, 500);
  }

  const summaries = [];

  for (const customer of customerList || []) {
    // Get invoices for this customer
    const { data: customerInvoices } = await db
      .from("invoices")
      .select(`
        id,
        status,
        invoice_fields(
          invoice_details:invoice_details(
            billing_details:invoice_details_billing_details(type, value)
          ),
          items:invoice_items(quantity, unit_price)
        )
      `)
      .eq("user_id", user.id)
      .eq("customer_id", customer.id)
      .is("deleted_at", null);

    // Get issued credit notes for this customer
    const { data: customerCreditNotes } = await db
      .from("credit_notes")
      .select(`
        id,
        credit_note_fields(
          credit_note_details:credit_note_details(
            billing_details:credit_note_details_billing_details(type, value)
          ),
          items:credit_note_items(quantity, unit_price)
        )
      `)
      .eq("user_id", user.id)
      .eq("customer_id", customer.id)
      .eq("status", "issued")
      .is("deleted_at", null);

    // Get issued debit notes for this customer
    const { data: customerDebitNotes } = await db
      .from("debit_notes")
      .select(`
        id,
        debit_note_fields(
          debit_note_details:debit_note_details(
            billing_details:debit_note_details_billing_details(type, value)
          ),
          items:debit_note_items(quantity, unit_price)
        )
      `)
      .eq("user_id", user.id)
      .eq("customer_id", customer.id)
      .eq("status", "issued")
      .is("deleted_at", null);

    let totalOwed = 0;
    let totalPaid = 0;
    let totalCreditNotes = 0;
    let totalDebitNotes = 0;

    // Sum up invoices
    for (const invoice of customerInvoices || []) {
      const fields = invoice.invoice_fields?.[0];
      const total = calculateTotal(
        fields?.items || null,
        fields?.invoice_details?.[0]?.billing_details || null
      );
      totalOwed += total;
      if (invoice.status === "success") {
        totalPaid += total;
      }
    }

    // Sum up credit notes
    for (const creditNote of customerCreditNotes || []) {
      const fields = creditNote.credit_note_fields?.[0];
      totalCreditNotes += calculateTotal(
        fields?.items || null,
        fields?.credit_note_details?.[0]?.billing_details || null
      );
    }

    // Sum up debit notes
    for (const debitNote of customerDebitNotes || []) {
      const fields = debitNote.debit_note_fields?.[0];
      totalDebitNotes += calculateTotal(
        fields?.items || null,
        fields?.debit_note_details?.[0]?.billing_details || null
      );
    }

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
      invoiceCount: (customerInvoices || []).length,
      creditNoteCount: (customerCreditNotes || []).length,
      debitNoteCount: (customerDebitNotes || []).length,
    });
  }

  // Sort by outstanding amount (descending)
  summaries.sort((a, b) => b.outstanding - a.outstanding);

  return c.json({
    items: summaries,
    total: count || 0,
    limit,
    offset,
  });
});

// Get customer statement
app.get("/customer/:customerId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const customerId = c.req.param("customerId");

  // Validate UUID
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(customerId).success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  // Parse date range
  const query = c.req.query();
  const { startDate, endDate } = dateRangeSchema.parse(query);

  // Verify customer belongs to user
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("id, name, email, address")
    .eq("id", customerId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (customerError || !customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  // Build invoice query
  let invoiceQuery = db
    .from("invoices")
    .select(`
      id,
      status,
      created_at,
      paid_at,
      invoice_fields(
        invoice_details:invoice_details(
          serial_number,
          currency,
          billing_details:invoice_details_billing_details(type, value)
        ),
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    invoiceQuery = invoiceQuery.gte("created_at", startDate);
  }
  if (endDate) {
    invoiceQuery = invoiceQuery.lte("created_at", endDate);
  }

  const { data: customerInvoices, error: invoicesError } = await invoiceQuery;

  if (invoicesError) {
    console.error("Error fetching invoices:", invoicesError);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }

  // Build credit notes query
  let creditNoteQuery = db
    .from("credit_notes")
    .select(`
      id,
      created_at,
      issued_at,
      credit_note_fields(
        credit_note_details:credit_note_details(
          prefix,
          serial_number,
          currency,
          billing_details:credit_note_details_billing_details(type, value)
        ),
        items:credit_note_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("customer_id", customerId)
    .eq("status", "issued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    creditNoteQuery = creditNoteQuery.gte("created_at", startDate);
  }
  if (endDate) {
    creditNoteQuery = creditNoteQuery.lte("created_at", endDate);
  }

  const { data: customerCreditNotes } = await creditNoteQuery;

  // Build debit notes query
  let debitNoteQuery = db
    .from("debit_notes")
    .select(`
      id,
      created_at,
      issued_at,
      debit_note_fields(
        debit_note_details:debit_note_details(
          prefix,
          serial_number,
          currency,
          billing_details:debit_note_details_billing_details(type, value)
        ),
        items:debit_note_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("customer_id", customerId)
    .eq("status", "issued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    debitNoteQuery = debitNoteQuery.gte("created_at", startDate);
  }
  if (endDate) {
    debitNoteQuery = debitNoteQuery.lte("created_at", endDate);
  }

  const { data: customerDebitNotes } = await debitNoteQuery;

  // Build statement entries
  const entries: StatementEntry[] = [];
  let entryIndex = 0;

  // Process invoices
  for (const invoice of customerInvoices || []) {
    const fields = invoice.invoice_fields?.[0];
    const invoiceTotal = calculateTotal(
      fields?.items || null,
      fields?.invoice_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.invoice_details?.[0]?.serial_number || invoice.id;

    // Add invoice entry (debit - what customer owes)
    entries.push({
      id: `inv-${entryIndex++}`,
      date: invoice.created_at,
      type: "invoice",
      reference: serialNumber,
      description: `Invoice ${serialNumber}`,
      debit: invoiceTotal,
      credit: 0,
      balance: 0,
    });

    // If paid, add payment entry (credit)
    if (invoice.status === "success" && invoice.paid_at) {
      entries.push({
        id: `pmt-${entryIndex++}`,
        date: invoice.paid_at,
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
  for (const creditNote of customerCreditNotes || []) {
    const fields = creditNote.credit_note_fields?.[0];
    const creditNoteTotal = calculateTotal(
      fields?.items || null,
      fields?.credit_note_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.credit_note_details?.[0]?.serial_number || creditNote.id;
    const prefix = fields?.credit_note_details?.[0]?.prefix || "CN-";
    const reference = `${prefix}${serialNumber}`;

    entries.push({
      id: `cn-${entryIndex++}`,
      date: creditNote.issued_at || creditNote.created_at,
      type: "credit_note",
      reference,
      description: `Credit Note ${reference}`,
      debit: 0,
      credit: creditNoteTotal,
      balance: 0,
    });
  }

  // Process debit notes (DEBIT - increases what customer owes)
  for (const debitNote of customerDebitNotes || []) {
    const fields = debitNote.debit_note_fields?.[0];
    const debitNoteTotal = calculateTotal(
      fields?.items || null,
      fields?.debit_note_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.debit_note_details?.[0]?.serial_number || debitNote.id;
    const prefix = fields?.debit_note_details?.[0]?.prefix || "DN-";
    const reference = `${prefix}${serialNumber}`;

    entries.push({
      id: `dn-${entryIndex++}`,
      date: debitNote.issued_at || debitNote.created_at,
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
    customerInvoices?.[0]?.invoice_fields?.[0]?.invoice_details?.[0]?.currency ||
    customerCreditNotes?.[0]?.credit_note_fields?.[0]?.credit_note_details?.[0]?.currency ||
    "MYR";

  return c.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      address: customer.address,
    },
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    entries,
    summary: {
      openingBalance: 0,
      totalDebits,
      totalCredits,
      closingBalance,
    },
    currency,
    generatedAt: new Date().toISOString(),
  });
});

// Get vendor statement
app.get("/vendor/:vendorId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const vendorId = c.req.param("vendorId");

  // Validate UUID
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(vendorId).success) {
    return c.json({ error: "Invalid vendor ID format" }, 400);
  }

  // Parse date range
  const query = c.req.query();
  const { startDate, endDate } = dateRangeSchema.parse(query);

  // Verify vendor belongs to user
  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("id, name, email, address")
    .eq("id", vendorId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (vendorError || !vendor) {
    return c.json({ error: "Vendor not found" }, 404);
  }

  // Build invoice query (bills from vendor)
  let invoiceQuery = db
    .from("invoices")
    .select(`
      id,
      status,
      created_at,
      paid_at,
      invoice_fields(
        invoice_details:invoice_details(
          serial_number,
          currency,
          billing_details:invoice_details_billing_details(type, value)
        ),
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    invoiceQuery = invoiceQuery.gte("created_at", startDate);
  }
  if (endDate) {
    invoiceQuery = invoiceQuery.lte("created_at", endDate);
  }

  const { data: vendorInvoices } = await invoiceQuery;

  // Build credit notes query (from vendor)
  let creditNoteQuery = db
    .from("credit_notes")
    .select(`
      id,
      created_at,
      issued_at,
      credit_note_fields(
        credit_note_details:credit_note_details(
          prefix,
          serial_number,
          currency,
          billing_details:credit_note_details_billing_details(type, value)
        ),
        items:credit_note_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .eq("status", "issued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    creditNoteQuery = creditNoteQuery.gte("created_at", startDate);
  }
  if (endDate) {
    creditNoteQuery = creditNoteQuery.lte("created_at", endDate);
  }

  const { data: vendorCreditNotes } = await creditNoteQuery;

  // Build debit notes query (from vendor)
  let debitNoteQuery = db
    .from("debit_notes")
    .select(`
      id,
      created_at,
      issued_at,
      debit_note_fields(
        debit_note_details:debit_note_details(
          prefix,
          serial_number,
          currency,
          billing_details:debit_note_details_billing_details(type, value)
        ),
        items:debit_note_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .eq("status", "issued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (startDate) {
    debitNoteQuery = debitNoteQuery.gte("created_at", startDate);
  }
  if (endDate) {
    debitNoteQuery = debitNoteQuery.lte("created_at", endDate);
  }

  const { data: vendorDebitNotes } = await debitNoteQuery;

  // Build statement entries (for vendor, credit = what we owe them)
  const entries: StatementEntry[] = [];
  let entryIndex = 0;

  // Process invoices (bills from vendor)
  for (const invoice of vendorInvoices || []) {
    const fields = invoice.invoice_fields?.[0];
    const invoiceTotal = calculateTotal(
      fields?.items || null,
      fields?.invoice_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.invoice_details?.[0]?.serial_number || invoice.id;

    // Add invoice entry (credit - what we owe vendor)
    entries.push({
      id: `inv-${entryIndex++}`,
      date: invoice.created_at,
      type: "invoice",
      reference: serialNumber,
      description: `Invoice ${serialNumber}`,
      debit: 0,
      credit: invoiceTotal,
      balance: 0,
    });

    // If paid, add payment entry (debit - we paid them)
    if (invoice.status === "success" && invoice.paid_at) {
      entries.push({
        id: `pmt-${entryIndex++}`,
        date: invoice.paid_at,
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
  for (const creditNote of vendorCreditNotes || []) {
    const fields = creditNote.credit_note_fields?.[0];
    const creditNoteTotal = calculateTotal(
      fields?.items || null,
      fields?.credit_note_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.credit_note_details?.[0]?.serial_number || creditNote.id;
    const prefix = fields?.credit_note_details?.[0]?.prefix || "CN-";
    const reference = `${prefix}${serialNumber}`;

    entries.push({
      id: `cn-${entryIndex++}`,
      date: creditNote.issued_at || creditNote.created_at,
      type: "credit_note",
      reference,
      description: `Credit Note ${reference}`,
      debit: creditNoteTotal,
      credit: 0,
      balance: 0,
    });
  }

  // Process debit notes from vendor (CREDIT - increases what we owe)
  for (const debitNote of vendorDebitNotes || []) {
    const fields = debitNote.debit_note_fields?.[0];
    const debitNoteTotal = calculateTotal(
      fields?.items || null,
      fields?.debit_note_details?.[0]?.billing_details || null
    );
    const serialNumber = fields?.debit_note_details?.[0]?.serial_number || debitNote.id;
    const prefix = fields?.debit_note_details?.[0]?.prefix || "DN-";
    const reference = `${prefix}${serialNumber}`;

    entries.push({
      id: `dn-${entryIndex++}`,
      date: debitNote.issued_at || debitNote.created_at,
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

  // Get currency
  const currency =
    vendorInvoices?.[0]?.invoice_fields?.[0]?.invoice_details?.[0]?.currency ||
    vendorCreditNotes?.[0]?.credit_note_fields?.[0]?.credit_note_details?.[0]?.currency ||
    "MYR";

  return c.json({
    vendor: {
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      address: vendor.address,
    },
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    entries,
    summary: {
      openingBalance: 0,
      totalDebits,
      totalCredits,
      closingBalance,
    },
    currency,
    generatedAt: new Date().toISOString(),
  });
});

export default app;
