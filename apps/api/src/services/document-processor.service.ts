/**
 * Document Processor Service
 * Handles the full workflow of processing vault documents:
 * - Extract data using Reducto
 * - Match or create vendors
 * - Create bills from extracted data
 */

import { createLogger } from "@open-bookkeeping/shared";
import {
  db,
  vaultDocuments,
  vaultProcessingJobs,
  vendors,
  bills,
  billItems,
  bankTransactions,
  bankStatementUploads,
} from "@open-bookkeeping/db";
import { eq, and } from "drizzle-orm";
import {
  reductoService,
  ExtractedInvoiceData,
  ExtractedBankStatementData,
  ExtractedDocumentData,
  DocumentType,
  ReductoError,
} from "./reducto.service";
import type { VaultCategory, Vendor } from "@open-bookkeeping/db";

const logger = createLogger("document-processor");

/**
 * Suggested vendor updates when extracted data has additional info
 */
export interface SuggestedVendorUpdates {
  address?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

/**
 * Processing result returned after document processing
 */
export interface ProcessingResult {
  jobId: string;
  status: "completed" | "failed";
  documentType: DocumentType;
  extractedData?: ExtractedDocumentData;
  matchedVendor?: { id: string; name: string };
  suggestedVendorUpdates?: SuggestedVendorUpdates;
  suggestedCategory?: VaultCategory;
  confidenceScore?: number;
  durationMs: number;
  error?: string;
}

/**
 * Bill creation result
 */
export interface BillCreationResult {
  billId: string;
  vendorId: string;
  vendorCreated: boolean;
  total: number;
  currency: string;
}

/**
 * Bank statement import result
 */
export interface BankStatementImportResult {
  uploadId: string;
  bankAccountId: string;
  importedCount: number;
  statementPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
}

/**
 * Document Processor Service
 */
export class DocumentProcessorService {
  /**
   * Process a single document - extract data, match vendor, update status
   * @param documentId - The document ID
   * @param userId - The user ID
   * @param signedUrl - A signed URL that Reducto can access (optional, falls back to publicUrl)
   */
  async processDocument(
    documentId: string,
    userId: string,
    signedUrl?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Get document details
    const doc = await db.query.vaultDocuments.findFirst({
      where: and(
        eq(vaultDocuments.id, documentId),
        eq(vaultDocuments.userId, userId)
      ),
    });

    if (!doc) {
      throw new Error("Document not found");
    }

    // Use signed URL if provided, otherwise fall back to public URL
    const documentUrl = signedUrl || doc.publicUrl;
    if (!documentUrl) {
      throw new Error("Document has no accessible URL");
    }

    // Create processing job
    const [job] = await db
      .insert(vaultProcessingJobs)
      .values({
        userId,
        documentId,
        status: "processing",
      })
      .returning();

    if (!job) {
      throw new Error("Failed to create processing job");
    }

    // Update document status
    await db
      .update(vaultDocuments)
      .set({ processingStatus: "processing" })
      .where(eq(vaultDocuments.id, documentId));

    try {
      // Check if Reducto is configured
      if (!reductoService.isConfigured()) {
        throw new ReductoError("Reducto API not configured");
      }

      // Use smart classify-and-extract flow
      const { documentType, data: extracted, classification } =
        await reductoService.classifyAndExtract(documentUrl);

      // Try to match vendor (for invoice/bill/receipt types that have vendor info)
      let matchedVendor: { id: string; name: string } | undefined;
      let suggestedVendorUpdates: SuggestedVendorUpdates | undefined;
      let existingVendor: Vendor | undefined;

      if ("vendor" in extracted && extracted.vendor?.name) {
        const vendorMatch = await this.findMatchingVendor(userId, extracted.vendor.name);
        if (vendorMatch) {
          matchedVendor = vendorMatch;
          // Get full vendor details to compare for enrichment suggestions
          existingVendor = await db.query.vendors.findFirst({
            where: eq(vendors.id, vendorMatch.id),
          });

          if (existingVendor) {
            suggestedVendorUpdates = this.computeVendorUpdates(
              existingVendor,
              extracted.vendor
            );
          }
        }
      }

      // Map document type to category
      const suggestedCategory = this.mapDocumentTypeToCategory(documentType);

      const durationMs = Date.now() - startTime;

      // Update job with results
      await db
        .update(vaultProcessingJobs)
        .set({
          status: "completed",
          extractedData: JSON.stringify(extracted),
          matchedVendorId: matchedVendor?.id,
          confidenceScore: String(classification.confidence), // Actual from Reducto
          processingDurationMs: durationMs,
          completedAt: new Date(),
        })
        .where(eq(vaultProcessingJobs.id, job.id));

      // Update document status and category if better match found
      await db
        .update(vaultDocuments)
        .set({
          processingStatus: "processed",
          lastProcessedAt: new Date(),
          category: suggestedCategory,
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, documentId));

      logger.info(
        {
          documentId,
          jobId: job.id,
          documentType,
          vendorMatched: !!matchedVendor,
          hasSuggestedUpdates: !!suggestedVendorUpdates,
          category: suggestedCategory,
          confidence: classification.confidence,
          durationMs,
        },
        "Document processed successfully"
      );

      return {
        jobId: job.id,
        status: "completed",
        documentType,
        extractedData: extracted,
        matchedVendor,
        suggestedVendorUpdates,
        suggestedCategory,
        confidenceScore: classification.confidence,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update job with error
      await db
        .update(vaultProcessingJobs)
        .set({
          status: "failed",
          errorMessage,
          processingDurationMs: durationMs,
          completedAt: new Date(),
        })
        .where(eq(vaultProcessingJobs.id, job.id));

      // Update document status
      await db
        .update(vaultDocuments)
        .set({
          processingStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, documentId));

      logger.error(
        { documentId, jobId: job.id, error: errorMessage, durationMs },
        "Document processing failed"
      );

      return {
        jobId: job.id,
        status: "failed",
        documentType: "unknown",
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Compute vendor updates by comparing extracted data with existing vendor
   */
  private computeVendorUpdates(
    existingVendor: Vendor,
    extractedVendor: {
      address?: string;
      taxId?: string;
      email?: string;
      phone?: string;
      bankName?: string;
      bankAccountNumber?: string;
    }
  ): SuggestedVendorUpdates | undefined {
    const updates: SuggestedVendorUpdates = {};

    // Only suggest updates for fields that are empty in existing vendor but present in extracted
    if (!existingVendor.address && extractedVendor.address) {
      updates.address = extractedVendor.address;
    }
    if (!existingVendor.taxId && extractedVendor.taxId) {
      updates.taxId = extractedVendor.taxId;
    }
    if (!existingVendor.email && extractedVendor.email) {
      updates.email = extractedVendor.email;
    }
    if (!existingVendor.phone && extractedVendor.phone) {
      updates.phone = extractedVendor.phone;
    }
    if (!existingVendor.bankName && extractedVendor.bankName) {
      updates.bankName = extractedVendor.bankName;
    }
    if (!existingVendor.bankAccountNumber && extractedVendor.bankAccountNumber) {
      updates.bankAccountNumber = extractedVendor.bankAccountNumber;
    }

    // Return undefined if no updates available
    return Object.keys(updates).length > 0 ? updates : undefined;
  }

  /**
   * Map document type to vault category
   */
  private mapDocumentTypeToCategory(documentType: DocumentType): VaultCategory {
    switch (documentType) {
      case "bank_statement":
        return "statements";
      case "receipt":
        return "receipts";
      case "invoice":
        return "invoices";
      case "bill":
      default:
        return "bills";
    }
  }

  /**
   * Find a vendor by name similarity
   */
  async findMatchingVendor(
    userId: string,
    vendorName: string
  ): Promise<{ id: string; name: string } | undefined> {
    if (!vendorName) return undefined;

    const normalizedName = vendorName.toLowerCase().trim();

    // Get all user's vendors
    const userVendors = await db.query.vendors.findMany({
      where: eq(vendors.userId, userId),
      columns: { id: true, name: true },
    });

    // Try exact match first
    let match = userVendors.find(
      (v) => v.name.toLowerCase().trim() === normalizedName
    );

    if (match) {
      return { id: match.id, name: match.name };
    }

    // Try partial match (vendor name contains search or vice versa)
    match = userVendors.find((v) => {
      const vName = v.name.toLowerCase().trim();
      return (
        vName.includes(normalizedName) || normalizedName.includes(vName)
      );
    });

    if (match) {
      return { id: match.id, name: match.name };
    }

    // Try word-based matching (at least 2 words match)
    const searchWords = normalizedName.split(/\s+/).filter((w) => w.length > 2);
    if (searchWords.length >= 2) {
      match = userVendors.find((v) => {
        const vendorWords = v.name.toLowerCase().split(/\s+/);
        const matchCount = searchWords.filter((sw) =>
          vendorWords.some((vw) => vw.includes(sw) || sw.includes(vw))
        ).length;
        return matchCount >= 2;
      });

      if (match) {
        return { id: match.id, name: match.name };
      }
    }

    return undefined;
  }

  /**
   * Create a bill from processed document data
   */
  async createBillFromDocument(
    userId: string,
    documentId: string,
    options?: {
      vendorId?: string;
      vendorUpdates?: SuggestedVendorUpdates; // User-approved updates to existing vendor
      createVendorIfNotFound?: boolean;
    }
  ): Promise<BillCreationResult> {
    // Get the latest processing job for this document
    const job = await db.query.vaultProcessingJobs.findFirst({
      where: and(
        eq(vaultProcessingJobs.documentId, documentId),
        eq(vaultProcessingJobs.userId, userId),
        eq(vaultProcessingJobs.status, "completed")
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    if (!job || !job.extractedData) {
      throw new Error("No processed data available for this document");
    }

    const extracted: ExtractedInvoiceData = JSON.parse(job.extractedData);

    // Get or create vendor
    let vendorId = options?.vendorId || job.matchedVendorId;
    let vendorCreated = false;

    // Apply vendor updates if user approved them
    if (vendorId && options?.vendorUpdates && Object.keys(options.vendorUpdates).length > 0) {
      await db
        .update(vendors)
        .set({
          ...options.vendorUpdates,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));

      logger.info(
        { vendorId, updates: Object.keys(options.vendorUpdates) },
        "Applied vendor updates from document"
      );
    }

    if (!vendorId && extracted.vendor?.name) {
      if (options?.createVendorIfNotFound !== false) {
        // Create new vendor with all extracted info including bank details
        const [newVendor] = await db
          .insert(vendors)
          .values({
            userId,
            name: extracted.vendor.name,
            address: extracted.vendor.address,
            taxId: extracted.vendor.taxId,
            email: extracted.vendor.email,
            phone: extracted.vendor.phone,
            bankName: extracted.vendor.bankName,
            bankAccountNumber: extracted.vendor.bankAccountNumber,
          })
          .returning();

        if (!newVendor) {
          throw new Error("Failed to create vendor");
        }

        vendorId = newVendor.id;
        vendorCreated = true;

        // Update job with created vendor
        await db
          .update(vaultProcessingJobs)
          .set({ createdVendorId: vendorId })
          .where(eq(vaultProcessingJobs.id, job.id));

        logger.info(
          { vendorId, vendorName: extracted.vendor.name },
          "Created new vendor from document"
        );
      }
    }

    if (!vendorId) {
      throw new Error("No vendor available - provide vendorId or enable vendor creation");
    }

    // Get document for attachment URL
    const doc = await db.query.vaultDocuments.findFirst({
      where: eq(vaultDocuments.id, documentId),
    });

    // Parse dates
    const billDate = extracted.invoiceDate
      ? new Date(extracted.invoiceDate)
      : new Date();
    const dueDate = extracted.dueDate
      ? new Date(extracted.dueDate)
      : null;

    // Get tax amount - support both new taxAmount and legacy tax field
    const taxAmount = extracted.taxAmount ?? extracted.tax;

    // Create bill with ALL extracted financial fields
    const [bill] = await db
      .insert(bills)
      .values({
        userId,
        vendorId,
        billNumber: extracted.invoiceNumber || `DOC-${Date.now()}`,
        billDate,
        dueDate,
        currency: extracted.currency || "MYR",
        subtotal: extracted.subtotal ? String(extracted.subtotal) : null,
        taxRate: extracted.taxRate ? String(extracted.taxRate) : null,
        taxAmount: taxAmount ? String(taxAmount) : null,
        total: extracted.total ? String(extracted.total) : null,
        paymentTerms: extracted.paymentTerms,
        status: "pending",
        attachmentUrl: doc?.publicUrl,
        notes: extracted.notes || `Created from vault document: ${doc?.displayName}`,
      })
      .returning();

    if (!bill) {
      throw new Error("Failed to create bill");
    }

    // Create bill items with amount field
    if (extracted.lineItems?.length) {
      await db.insert(billItems).values(
        extracted.lineItems.map((item) => ({
          billId: bill.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.amount), // Now persisting the line item amount
        }))
      );
    } else if (extracted.total) {
      // If no line items but we have a total, create a single line item
      await db.insert(billItems).values({
        billId: bill.id,
        description: "Total from document",
        quantity: "1",
        unitPrice: String(extracted.total),
        amount: String(extracted.total),
      });
    }

    // Update job with linked bill
    await db
      .update(vaultProcessingJobs)
      .set({ linkedBillId: bill.id })
      .where(eq(vaultProcessingJobs.id, job.id));

    logger.info(
      {
        billId: bill.id,
        vendorId,
        vendorCreated,
        subtotal: extracted.subtotal,
        taxRate: extracted.taxRate,
        taxAmount,
        total: extracted.total,
        itemCount: extracted.lineItems?.length || 0,
      },
      "Created bill from document"
    );

    return {
      billId: bill.id,
      vendorId,
      vendorCreated,
      total: extracted.total || 0,
      currency: extracted.currency || "MYR",
    };
  }

  /**
   * Import transactions from a bank statement document
   */
  async importTransactionsFromStatement(
    userId: string,
    documentId: string,
    bankAccountId: string
  ): Promise<BankStatementImportResult> {
    // Get the latest processing job for this document
    const job = await db.query.vaultProcessingJobs.findFirst({
      where: and(
        eq(vaultProcessingJobs.documentId, documentId),
        eq(vaultProcessingJobs.userId, userId),
        eq(vaultProcessingJobs.status, "completed")
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    if (!job || !job.extractedData) {
      throw new Error("No processed data available for this document");
    }

    const extracted: ExtractedBankStatementData = JSON.parse(job.extractedData);

    if (extracted.documentType !== "bank_statement") {
      throw new Error("Document is not a bank statement");
    }

    if (!extracted.transactions || extracted.transactions.length === 0) {
      throw new Error("No transactions found in bank statement");
    }

    // Get document for file info
    const doc = await db.query.vaultDocuments.findFirst({
      where: eq(vaultDocuments.id, documentId),
    });

    // Create a statement upload record
    const [upload] = await db
      .insert(bankStatementUploads)
      .values({
        userId,
        bankAccountId,
        fileName: doc?.displayName || `Statement-${Date.now()}`,
        fileType: "pdf", // Vault documents are typically PDFs
        bankPreset: extracted.bankName?.toLowerCase().replace(/\s+/g, "_"),
        transactionCount: extracted.transactions.length,
        startDate: extracted.statementPeriod?.startDate
          ? new Date(extracted.statementPeriod.startDate)
          : undefined,
        endDate: extracted.statementPeriod?.endDate
          ? new Date(extracted.statementPeriod.endDate)
          : undefined,
      })
      .returning();

    if (!upload) {
      throw new Error("Failed to create statement upload record");
    }

    // Insert transactions
    const insertedTransactions = await db
      .insert(bankTransactions)
      .values(
        extracted.transactions.map((tx) => {
          // Determine transaction type and amount
          const isDebit = tx.debit !== undefined && tx.debit > 0;
          const amount = isDebit ? tx.debit! : tx.credit || 0;

          return {
            userId,
            bankAccountId,
            uploadId: upload.id,
            transactionDate: new Date(tx.date),
            description: tx.description,
            reference: tx.reference,
            amount: String(amount),
            type: isDebit ? ("withdrawal" as const) : ("deposit" as const),
            balance: tx.balance ? String(tx.balance) : undefined,
            matchStatus: "unmatched" as const,
          };
        })
      )
      .returning();

    logger.info(
      {
        uploadId: upload.id,
        bankAccountId,
        documentId,
        transactionCount: insertedTransactions.length,
        statementPeriod: extracted.statementPeriod,
      },
      "Imported transactions from bank statement"
    );

    return {
      uploadId: upload.id,
      bankAccountId,
      importedCount: insertedTransactions.length,
      statementPeriod: extracted.statementPeriod,
      openingBalance: extracted.openingBalance,
      closingBalance: extracted.closingBalance,
      currency: extracted.currency,
    };
  }

  /**
   * Get processing history for a document
   */
  async getProcessingHistory(
    documentId: string,
    userId: string
  ): Promise<
    Array<{
      id: string;
      status: string;
      extractedData: ExtractedDocumentData | null;
      matchedVendorId: string | null;
      linkedBillId: string | null;
      createdAt: Date;
      completedAt: Date | null;
      errorMessage: string | null;
    }>
  > {
    const jobs = await db.query.vaultProcessingJobs.findMany({
      where: and(
        eq(vaultProcessingJobs.documentId, documentId),
        eq(vaultProcessingJobs.userId, userId)
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      extractedData: job.extractedData
        ? JSON.parse(job.extractedData)
        : null,
      matchedVendorId: job.matchedVendorId,
      linkedBillId: job.linkedBillId,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    }));
  }

  /**
   * Get the latest processing result for a document
   */
  async getLatestProcessingResult(
    documentId: string,
    userId: string
  ): Promise<ProcessingResult | null> {
    const job = await db.query.vaultProcessingJobs.findFirst({
      where: and(
        eq(vaultProcessingJobs.documentId, documentId),
        eq(vaultProcessingJobs.userId, userId)
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    if (!job) return null;

    const extractedData = job.extractedData
      ? (JSON.parse(job.extractedData) as ExtractedDocumentData)
      : undefined;

    // Determine document type from extracted data
    let documentType: DocumentType = "unknown";
    if (extractedData && "documentType" in extractedData && extractedData.documentType) {
      documentType = extractedData.documentType as DocumentType;
    }

    // Get matched vendor info
    let matchedVendor: { id: string; name: string } | undefined;
    if (job.matchedVendorId) {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, job.matchedVendorId),
        columns: { id: true, name: true },
      });
      if (vendor) {
        matchedVendor = { id: vendor.id, name: vendor.name };
      }
    }

    // Compute suggested vendor updates if vendor was matched and has invoice data
    let suggestedVendorUpdates: SuggestedVendorUpdates | undefined;
    if (matchedVendor && extractedData && "vendor" in extractedData && extractedData.vendor) {
      const existingVendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, matchedVendor.id),
      });
      if (existingVendor) {
        suggestedVendorUpdates = this.computeVendorUpdates(
          existingVendor,
          extractedData.vendor
        );
      }
    }

    return {
      jobId: job.id,
      status: job.status === "completed" ? "completed" : "failed",
      documentType,
      extractedData,
      matchedVendor,
      suggestedVendorUpdates,
      suggestedCategory: this.mapDocumentTypeToCategory(documentType),
      confidenceScore: job.confidenceScore ? parseFloat(job.confidenceScore) : undefined,
      durationMs: job.processingDurationMs || 0,
      error: job.errorMessage || undefined,
    };
  }

  /**
   * Reprocess a document (creates new processing job)
   */
  async reprocessDocument(
    documentId: string,
    userId: string,
    signedUrl?: string
  ): Promise<ProcessingResult> {
    // Reset document status
    await db
      .update(vaultDocuments)
      .set({
        processingStatus: "queued",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vaultDocuments.id, documentId),
          eq(vaultDocuments.userId, userId)
        )
      );

    // Process again
    return this.processDocument(documentId, userId, signedUrl);
  }
}

// Export singleton instance
export const documentProcessorService = new DocumentProcessorService();
