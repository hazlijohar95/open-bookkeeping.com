/**
 * Invoice Schema Migration Script
 *
 * Migrates data from the old 11-table invoice schema to the new 4-table schema.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx packages/db/src/migrations/migrate-invoices-v2.ts
 *
 * Options:
 *   --dry-run     Preview migration without making changes
 *   --batch-size  Number of invoices to process per batch (default: 100)
 *   --validate    Validate migration after completion
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import * as schema from "../schema";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const batchSize = parseInt(args.find(a => a.startsWith("--batch-size="))?.split("=")[1] ?? "100");
const shouldValidate = args.includes("--validate");

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now(),
};

interface MigrationError {
  invoiceId: string;
  error: string;
}

const errors: MigrationError[] = [];

/**
 * Calculate totals from line items and billing details
 */
function calculateTotals(
  items: Array<{ quantity: number; unitPrice: string }>,
  billingDetails: Array<{ type: string; value: string; label: string }>
): {
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
} {
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.unitPrice).times(item.quantity));
  }, new Decimal(0));

  let taxTotal = new Decimal(0);
  let discountTotal = new Decimal(0);

  // Calculate tax and discount from billing details
  for (const detail of billingDetails) {
    const value = new Decimal(detail.value);
    const label = detail.label.toLowerCase();

    if (label.includes("tax") || label.includes("sst") || label.includes("gst")) {
      if (detail.type === "percentage") {
        taxTotal = taxTotal.plus(subtotal.times(value).div(100));
      } else {
        taxTotal = taxTotal.plus(value);
      }
    } else if (label.includes("discount") || label.includes("rebate")) {
      if (detail.type === "percentage") {
        discountTotal = discountTotal.plus(subtotal.times(value).div(100));
      } else {
        discountTotal = discountTotal.plus(value);
      }
    }
  }

  const total = subtotal.minus(discountTotal).plus(taxTotal);

  return {
    subtotal: subtotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    total: total.toFixed(2),
  };
}

/**
 * Migrate a single invoice
 */
async function migrateInvoice(invoice: NonNullable<Awaited<ReturnType<typeof fetchInvoice>>>) {
  const fields = invoice.invoiceFields;

  if (!fields) {
    console.log(`  Skipping invoice ${invoice.id}: No invoice fields`);
    stats.skipped++;
    return;
  }

  try {
    // Build company details
    const companyDetails: schema.CompanyDetailsV2 = {
      name: fields.companyDetails?.name ?? "Unknown",
      address: fields.companyDetails?.address ?? "",
      logo: fields.companyDetails?.logo,
      signature: fields.companyDetails?.signature,
      metadata: fields.companyDetails?.metadata?.map(m => ({
        label: m.label,
        value: m.value,
      })),
    };

    // Build client details
    const clientDetails: schema.ClientDetailsV2 = {
      name: fields.clientDetails?.name ?? "Unknown",
      address: fields.clientDetails?.address ?? "",
      metadata: fields.clientDetails?.metadata?.map(m => ({
        label: m.label,
        value: m.value,
      })),
    };

    // Build billing details
    const billingDetails: schema.BillingDetailV2[] = (fields.invoiceDetails?.billingDetails ?? []).map(b => ({
      label: b.label,
      type: b.type as "fixed" | "percentage",
      value: b.value,
      isSstTax: b.isSstTax ?? undefined,
      sstTaxType: b.sstTaxType ?? undefined,
      sstRateCode: b.sstRateCode ?? undefined,
    }));

    // Build metadata
    const metadata: schema.InvoiceMetadataV2 = {
      notes: fields.metadata?.notes ?? undefined,
      terms: fields.metadata?.terms ?? undefined,
      paymentInformation: fields.metadata?.paymentInformation?.map(p => ({
        label: p.label,
        value: p.value,
      })),
    };

    // Calculate totals
    const items = fields.items ?? [];
    const totals = calculateTotals(items, billingDetails);

    // Prepare the new invoice record
    const newInvoice = {
      id: invoice.id, // Keep same ID for reference
      userId: invoice.userId,
      customerId: invoice.customerId,
      vendorId: invoice.vendorId,
      type: invoice.type,
      status: invoice.status,
      einvoiceStatus: invoice.einvoiceStatus,
      prefix: fields.invoiceDetails?.prefix ?? "INV",
      serialNumber: fields.invoiceDetails?.serialNumber ?? "0",
      currency: fields.invoiceDetails?.currency ?? "MYR",
      invoiceDate: fields.invoiceDetails?.date || new Date(),
      dueDate: fields.invoiceDetails?.dueDate,
      paymentTerms: fields.invoiceDetails?.paymentTerms,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      amountPaid: invoice.status === "success" ? totals.total : "0",
      amountDue: invoice.status === "success" ? "0" : totals.total,
      theme: fields.invoiceDetails?.theme,
      companyDetails,
      clientDetails,
      billingDetails,
      metadata,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      paidAt: invoice.paidAt,
      deletedAt: invoice.deletedAt,
    };

    // Prepare line items
    const newItems = items.map((item, index) => ({
      invoiceId: invoice.id,
      name: item.name,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: item.unitPrice,
      amount: new Decimal(item.unitPrice).times(item.quantity).toFixed(2),
      sortOrder: String(index),
    }));

    if (isDryRun) {
      console.log(`  [DRY RUN] Would migrate invoice ${invoice.id}`);
      console.log(`    - ${items.length} line items`);
      console.log(`    - Total: ${totals.total}`);
    } else {
      // Insert into new tables
      await db.transaction(async (tx) => {
        // Check if already migrated
        const existing = await tx.query.invoicesV2.findFirst({
          where: eq(schema.invoicesV2.id, invoice.id),
        });

        if (existing) {
          console.log(`  Skipping invoice ${invoice.id}: Already migrated`);
          stats.skipped++;
          return;
        }

        // Insert invoice
        await tx.insert(schema.invoicesV2).values(newInvoice);

        // Insert line items
        if (newItems.length > 0) {
          await tx.insert(schema.invoiceItemsV2).values(newItems);
        }

        // Create activity record for migration
        await tx.insert(schema.invoiceActivitiesV2).values({
          invoiceId: invoice.id,
          action: "migrated",
          description: "Migrated from legacy schema",
          performedAt: new Date(),
        });
      });

      console.log(`  Migrated invoice ${invoice.id} (${items.length} items, total: ${totals.total})`);
    }

    stats.migrated++;
  } catch (error) {
    console.error(`  Error migrating invoice ${invoice.id}:`, error);
    errors.push({
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : String(error),
    });
    stats.errors++;
  }
}

/**
 * Fetch a single invoice with all relations
 */
async function fetchInvoice(id: string) {
  return db.query.invoices.findFirst({
    where: eq(schema.invoices.id, id),
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
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("=".repeat(60));
  console.log("Invoice Schema Migration v2");
  console.log("=".repeat(60));
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log("");

  // Count total invoices
  const allInvoices = await db.query.invoices.findMany({
    columns: { id: true },
  });
  stats.total = allInvoices.length;

  console.log(`Found ${stats.total} invoices to migrate`);
  console.log("");

  // Process in batches
  for (let offset = 0; offset < stats.total; offset += batchSize) {
    const batchNum = Math.floor(offset / batchSize) + 1;
    const totalBatches = Math.ceil(stats.total / batchSize);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${offset}-${Math.min(offset + batchSize, stats.total)})`);

    const invoiceIds = allInvoices.slice(offset, offset + batchSize).map(i => i.id);

    for (const id of invoiceIds) {
      const invoice = await fetchInvoice(id);
      if (invoice) {
        await migrateInvoice(invoice);
      }
    }
  }

  // Print summary
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
  console.log("");
  console.log("=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total invoices:    ${stats.total}`);
  console.log(`Migrated:          ${stats.migrated}`);
  console.log(`Skipped:           ${stats.skipped}`);
  console.log(`Errors:            ${stats.errors}`);
  console.log(`Duration:          ${duration}s`);

  if (errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const err of errors) {
      console.log(`  - ${err.invoiceId}: ${err.error}`);
    }
  }

  // Validation
  if (shouldValidate && !isDryRun) {
    console.log("");
    console.log("Validating migration...");

    const v1Count = await db.query.invoices.findMany({ columns: { id: true } });
    const v2Count = await db.query.invoicesV2.findMany({ columns: { id: true } });

    console.log(`  V1 invoices: ${v1Count.length}`);
    console.log(`  V2 invoices: ${v2Count.length}`);

    if (v1Count.length === v2Count.length) {
      console.log("  ✓ Invoice counts match");
    } else {
      console.log("  ✗ Invoice counts DO NOT match");
    }
  }
}

// Run migration
migrate()
  .then(() => {
    console.log("");
    console.log("Migration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
