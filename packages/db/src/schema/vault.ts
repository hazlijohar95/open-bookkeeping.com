import { pgTable, uuid, text, timestamp, integer, index, pgEnum, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Document category enum (expanded for Reducto processing)
export const vaultCategoryEnum = pgEnum("vault_category", [
  "contracts",
  "receipts",
  "images",
  "invoices",
  "bills",         // Vendor bills (AP)
  "statements",    // Bank statements
  "tax_documents", // Tax receipts, returns
  "other",
]);

// Processing status enum for Reducto integration
export const processingStatusEnum = pgEnum("processing_status", [
  "unprocessed",
  "queued",
  "processing",
  "processed",
  "failed",
]);

// Vault documents table
export const vaultDocuments = pgTable(
  "vault_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // File information
    name: text("name").notNull(), // Original filename
    displayName: text("display_name").notNull(), // User-editable name
    category: vaultCategoryEnum("category").notNull().default("other"),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(), // File size in bytes

    // Storage information
    storagePath: text("storage_path").notNull(), // Path in Supabase storage
    storageBucket: text("storage_bucket").default("vault").notNull(), // Which bucket (vault or assets)
    publicUrl: text("public_url"), // Public accessible URL

    // Processing status for Reducto integration
    processingStatus: processingStatusEnum("processing_status").default("unprocessed").notNull(),
    lastProcessedAt: timestamp("last_processed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("vault_documents_user_id_idx").on(table.userId),
    index("vault_documents_category_idx").on(table.category),
    index("vault_documents_created_at_idx").on(table.createdAt),
    // Composite index for filtering by user and processing status
    index("vault_documents_user_status_idx").on(table.userId, table.processingStatus),
    // Composite index for user + category queries
    index("vault_documents_user_category_idx").on(table.userId, table.category),
  ]
);

// Processing jobs for tracking Reducto requests
export const vaultProcessingJobs = pgTable(
  "vault_processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id")
      .references(() => vaultDocuments.id, { onDelete: "cascade" })
      .notNull(),

    // Reducto job tracking
    reductoJobId: text("reducto_job_id"),
    status: text("status").default("pending").notNull(), // pending, processing, completed, failed

    // Extracted data (JSON)
    extractedData: text("extracted_data"), // JSON string of extracted invoice data

    // Entity linking results
    matchedVendorId: uuid("matched_vendor_id"),
    createdVendorId: uuid("created_vendor_id"),
    linkedBillId: uuid("linked_bill_id"),

    // Processing metadata
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    processingDurationMs: integer("processing_duration_ms"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("vault_processing_jobs_user_id_idx").on(table.userId),
    index("vault_processing_jobs_document_id_idx").on(table.documentId),
    index("vault_processing_jobs_status_idx").on(table.status),
  ]
);

// Tags for documents (many-to-many)
export const vaultDocumentTags = pgTable(
  "vault_document_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => vaultDocuments.id, { onDelete: "cascade" })
      .notNull(),
    tag: text("tag").notNull(),
  },
  (table) => [
    index("vault_document_tags_document_id_idx").on(table.documentId),
    index("vault_document_tags_tag_idx").on(table.tag),
  ]
);

// Relations
export const vaultDocumentsRelations = relations(vaultDocuments, ({ one, many }) => ({
  user: one(users, {
    fields: [vaultDocuments.userId],
    references: [users.id],
  }),
  tags: many(vaultDocumentTags),
  processingJobs: many(vaultProcessingJobs),
}));

export const vaultDocumentTagsRelations = relations(vaultDocumentTags, ({ one }) => ({
  document: one(vaultDocuments, {
    fields: [vaultDocumentTags.documentId],
    references: [vaultDocuments.id],
  }),
}));

export const vaultProcessingJobsRelations = relations(vaultProcessingJobs, ({ one }) => ({
  user: one(users, {
    fields: [vaultProcessingJobs.userId],
    references: [users.id],
  }),
  document: one(vaultDocuments, {
    fields: [vaultProcessingJobs.documentId],
    references: [vaultDocuments.id],
  }),
}));

// All valid vault categories
export type VaultCategory = "contracts" | "receipts" | "images" | "invoices" | "bills" | "statements" | "tax_documents" | "other";

// Helper function to determine category based on file
export function determineCategory(
  filename: string,
  mimeType: string
): VaultCategory {
  const lowerName = filename.toLowerCase();

  // Check for images
  if (mimeType.startsWith("image/")) {
    return "images";
  }

  // Check for contracts/agreements
  if (
    lowerName.includes("contract") ||
    lowerName.includes("agreement") ||
    lowerName.includes("nda") ||
    lowerName.includes("terms")
  ) {
    return "contracts";
  }

  // Check for tax documents
  if (
    lowerName.includes("tax") ||
    lowerName.includes("form") ||
    lowerName.includes("w-9") ||
    lowerName.includes("1099")
  ) {
    return "tax_documents";
  }

  // Check for bank statements
  if (
    lowerName.includes("statement") ||
    lowerName.includes("bank")
  ) {
    return "statements";
  }

  // Check for receipts
  if (
    lowerName.includes("receipt") ||
    lowerName.includes("payment") ||
    lowerName.includes("transaction")
  ) {
    return "receipts";
  }

  // Check for bills (vendor invoices - accounts payable)
  if (lowerName.includes("bill")) {
    return "bills";
  }

  // Check for invoices (default for PDFs)
  if (lowerName.includes("invoice") || mimeType === "application/pdf") {
    return "invoices";
  }

  return "other";
}
