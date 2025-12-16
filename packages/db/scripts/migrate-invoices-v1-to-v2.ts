/**
 * Invoice V1 to V2 Migration Script
 *
 * This script migrates data from the 11-table V1 schema to the consolidated 4-table V2 schema.
 *
 * V1 Tables (11):
 * - invoices, invoice_fields, invoice_company_details, invoice_company_details_metadata,
 * - invoice_client_details, invoice_client_details_metadata, invoice_details,
 * - invoice_details_billing_details, invoice_items, invoice_metadata,
 * - invoice_metadata_payment_information
 *
 * V2 Tables (4):
 * - invoices_v2, invoice_items_v2, invoice_payments_v2, invoice_activities_v2
 *
 * Status Mapping:
 * - pending  -> open (finalized, awaiting payment)
 * - success  -> paid
 * - error    -> void (system error treated as voided)
 * - expired  -> uncollectible
 * - refunded -> refunded
 *
 * Run with: npx tsx packages/db/scripts/migrate-invoices-v1-to-v2.ts
 *
 * Options:
 *   --dry-run      Preview changes without writing to database
 *   --batch-size=N Process N invoices at a time (default: 100)
 *   --user=UUID    Only migrate invoices for a specific user
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import Decimal from "decimal.js";

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
const userArg = args.find((a) => a.startsWith("--user="));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1], 10) : 100;
const specificUserId = userArg ? userArg.split("=")[1] : undefined;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

// Status mapping from V1 to V2
type V1Status = "pending" | "success" | "error" | "expired" | "refunded";
type V2Status =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "refunded";

function mapStatus(v1Status: V1Status): V2Status {
  const mapping: Record<V1Status, V2Status> = {
    pending: "open", // Finalized invoices awaiting payment
    success: "paid", // Paid invoices
    error: "void", // System errors treated as voided
    expired: "uncollectible", // Expired = unlikely to be collected
    refunded: "refunded", // Direct mapping
  };
  return mapping[v1Status] || "open";
}

interface MigrationStats {
  totalProcessed: number;
  migrated: number;
  skipped: number;
  errors: number;
  byStatus: Record<string, number>;
}

async function migrateInvoices(): Promise<void> {
  console.log("========================================");
  console.log("Invoice V1 to V2 Migration");
  console.log("========================================");
  console.log(`Dry run: ${dryRun}`);
  console.log(`Batch size: ${batchSize}`);
  if (specificUserId) {
    console.log(`Specific user: ${specificUserId}`);
  }
  console.log("");

  const stats: MigrationStats = {
    totalProcessed: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    byStatus: {},
  };

  // Get total count
  const whereClause = specificUserId
    ? and(
        eq(schema.invoices.userId, specificUserId),
        isNull(schema.invoices.deletedAt)
      )
    : isNull(schema.invoices.deletedAt);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.invoices)
    .where(whereClause);

  const totalCount = countResult?.count ?? 0;
  console.log(`Found ${totalCount} invoices to process\n`);

  if (totalCount === 0) {
    console.log("No invoices to migrate. Exiting.");
    process.exit(0);
  }

  // Process in batches
  let offset = 0;
  let batchNum = 1;

  while (offset < totalCount) {
    console.log(
      `Processing batch ${batchNum} (${offset + 1} to ${Math.min(offset + batchSize, totalCount)})...`
    );

    // Fetch batch of V1 invoices with all relations
    const v1Invoices = await db.query.invoices.findMany({
      where: whereClause,
      limit: batchSize,
      offset,
      with: {
        invoiceFields: {
          with: {
            companyDetails: {
              with: {
                metadata: true,
              },
            },
            clientDetails: {
              with: {
                metadata: true,
              },
            },
            invoiceDetails: {
              with: {
                billingDetails: true,
              },
            },
            items: true,
            metadata: {
              with: {
                paymentInformation: true,
              },
            },
          },
        },
        customer: true,
      },
    });

    for (const v1Invoice of v1Invoices) {
      stats.totalProcessed++;

      try {
        // Check if already migrated (by checking if V2 exists with same ID)
        const existing = await db.query.invoicesV2.findFirst({
          where: eq(schema.invoicesV2.id, v1Invoice.id),
          columns: { id: true },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        // Extract V1 data
        const fields = v1Invoice.invoiceFields;
        if (!fields) {
          console.warn(
            `  Warning: Invoice ${v1Invoice.id} has no fields, skipping`
          );
          stats.skipped++;
          continue;
        }

        const companyDetails = fields.companyDetails;
        const clientDetails = fields.clientDetails;
        const invoiceDetails = fields.invoiceDetails;
        const items = fields.items ?? [];
        const metadata = fields.metadata;

        if (!companyDetails || !clientDetails || !invoiceDetails) {
          console.warn(
            `  Warning: Invoice ${v1Invoice.id} missing required details, skipping`
          );
          stats.skipped++;
          continue;
        }

        // Map V1 status to V2
        const v2Status = mapStatus(v1Invoice.status as V1Status);
        stats.byStatus[v2Status] = (stats.byStatus[v2Status] ?? 0) + 1;

        // Calculate totals
        const subtotal = items.reduce((sum, item) => {
          return sum.plus(new Decimal(item.quantity).times(item.unitPrice));
        }, new Decimal(0));

        let taxTotal = new Decimal(0);
        let discountTotal = new Decimal(0);
        const billingDetails = invoiceDetails.billingDetails ?? [];

        for (const detail of billingDetails) {
          const value = new Decimal(detail.value);
          const amount =
            detail.type === "percentage"
              ? subtotal.times(value).div(100)
              : value;

          if (value.greaterThanOrEqualTo(0)) {
            taxTotal = taxTotal.plus(amount);
          } else {
            discountTotal = discountTotal.plus(amount.abs());
          }
        }

        const total = subtotal.plus(taxTotal).minus(discountTotal);
        const amountPaid = v2Status === "paid" ? total : new Decimal(0);
        const amountDue = total.minus(amountPaid);

        // Build V2 data structures
        const v2CompanyDetails = {
          name: companyDetails.name,
          address: companyDetails.address,
          logo: companyDetails.logo,
          signature: companyDetails.signature,
          metadata: companyDetails.metadata?.map((m) => ({
            label: m.label,
            value: m.value,
          })),
        };

        const v2ClientDetails = {
          name: clientDetails.name,
          address: clientDetails.address,
          metadata: clientDetails.metadata?.map((m) => ({
            label: m.label,
            value: m.value,
          })),
        };

        const v2BillingDetails = billingDetails.map((bd) => ({
          label: bd.label,
          type: bd.type,
          value: bd.value,
          isSstTax: bd.isSstTax ?? false,
          sstTaxType: bd.sstTaxType,
          sstRateCode: bd.sstRateCode,
        }));

        const v2Metadata = {
          notes: metadata?.notes,
          terms: metadata?.terms,
          paymentInformation: metadata?.paymentInformation?.map((pi) => ({
            label: pi.label,
            value: pi.value,
          })),
        };

        if (!dryRun) {
          await db.transaction(async (tx) => {
            // Format dates as ISO strings for SQL
            const invoiceDateStr =
              invoiceDetails.date?.toISOString() ?? new Date().toISOString();
            const dueDateStr = invoiceDetails.dueDate?.toISOString() ?? null;
            const createdAtStr =
              v1Invoice.createdAt?.toISOString() ?? new Date().toISOString();
            const updatedAtStr =
              v1Invoice.updatedAt?.toISOString() ?? new Date().toISOString();
            const paidAtStr = v1Invoice.paidAt?.toISOString() ?? null;
            const deletedAtStr = v1Invoice.deletedAt?.toISOString() ?? null;

            // Insert main invoice - use raw SQL to preserve original ID
            await tx.execute(sql`
              INSERT INTO invoices_v2 (
                id, user_id, customer_id, vendor_id, type, status, einvoice_status,
                prefix, serial_number, currency, invoice_date, due_date, payment_terms,
                subtotal, tax_total, discount_total, total, amount_paid, amount_due,
                theme, company_details, client_details, billing_details, metadata,
                created_at, updated_at, paid_at, deleted_at
              ) VALUES (
                ${v1Invoice.id},
                ${v1Invoice.userId},
                ${v1Invoice.customerId},
                ${v1Invoice.vendorId},
                ${v1Invoice.type},
                ${v2Status},
                ${v1Invoice.einvoiceStatus},
                ${invoiceDetails.prefix},
                ${invoiceDetails.serialNumber},
                ${invoiceDetails.currency},
                ${invoiceDateStr}::timestamp,
                ${dueDateStr}::timestamp,
                ${invoiceDetails.paymentTerms},
                ${subtotal.toFixed(2)},
                ${taxTotal.toFixed(2)},
                ${discountTotal.toFixed(2)},
                ${total.toFixed(2)},
                ${amountPaid.toFixed(2)},
                ${amountDue.toFixed(2)},
                ${JSON.stringify(invoiceDetails.theme)}::jsonb,
                ${JSON.stringify(v2CompanyDetails)}::jsonb,
                ${JSON.stringify(v2ClientDetails)}::jsonb,
                ${JSON.stringify(v2BillingDetails)}::jsonb,
                ${JSON.stringify(v2Metadata)}::jsonb,
                ${createdAtStr}::timestamp,
                ${updatedAtStr}::timestamp,
                ${paidAtStr}::timestamp,
                ${deletedAtStr}::timestamp
              )
            `);

            // Insert items
            if (items.length > 0) {
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const amount = new Decimal(item.quantity)
                  .times(item.unitPrice)
                  .toFixed(2);

                await tx.execute(sql`
                  INSERT INTO invoice_items_v2 (
                    invoice_id, name, description, quantity, unit_price, amount, sort_order, created_at
                  ) VALUES (
                    ${v1Invoice.id},
                    ${item.name},
                    ${item.description},
                    ${String(item.quantity)},
                    ${item.unitPrice},
                    ${amount},
                    ${String(i)},
                    ${createdAtStr}::timestamp
                  )
                `);
              }
            }

            // Log migration as activity
            await tx.execute(sql`
              INSERT INTO invoice_activities_v2 (
                invoice_id, action, description, performed_at
              ) VALUES (
                ${v1Invoice.id},
                'migrated',
                ${`Migrated from V1 schema. Original status: ${v1Invoice.status}`},
                NOW()
              )
            `);
          });
        }

        stats.migrated++;
      } catch (error) {
        stats.errors++;
        console.error(`  Error migrating invoice ${v1Invoice.id}:`, error);
      }
    }

    offset += batchSize;
    batchNum++;
    console.log(
      `  Batch complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`
    );
  }

  // Print summary
  console.log("\n========================================");
  console.log("Migration Summary");
  console.log("========================================");
  console.log(`Total processed: ${stats.totalProcessed}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped (already migrated): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log("\nBy status:");
  for (const [status, count] of Object.entries(stats.byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made to the database");
  } else {
    console.log("\n✓ Migration complete!");
  }
}

// Run the migration
migrateInvoices()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error during migration:", err);
    process.exit(1);
  });
