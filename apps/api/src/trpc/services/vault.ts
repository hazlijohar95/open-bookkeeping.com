import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  db,
  vaultDocuments,
  vaultDocumentTags,
  vaultProcessingJobs,
  vendors,
  determineCategory,
} from "@open-bookkeeping/db";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentProcessorService } from "../../services/document-processor.service";
import { reductoService } from "../../services/reducto.service";
import { validateMimeType } from "../../utils/mime-validator";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENTS = 100; // Max documents per user
const VAULT_BUCKET = "vault";
const ASSETS_BUCKET = "assets";

const categoryEnum = z.enum([
  "contracts",
  "receipts",
  "images",
  "invoices",
  "bills",
  "statements",
  "tax_documents",
  "other",
]);

/**
 * Ensure the vault bucket exists, create if not
 */
async function ensureBucketExists(
  supabase: SupabaseClient,
  bucketName: string
): Promise<boolean> {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    console.error("[Vault] Failed to list buckets:", listError.message);
    return false;
  }

  const exists = buckets?.some((b) => b.name === bucketName);

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(
      bucketName,
      {
        public: false,
        fileSizeLimit: MAX_FILE_SIZE,
      }
    );

    if (createError) {
      console.error("[Vault] Failed to create bucket:", createError.message);
      return false;
    }
    console.log("[Vault] Created bucket:", bucketName);
  }

  return true;
}

export const vaultRouter = router({
  // List all documents (optionally filtered by category)
  list: protectedProcedure
    .input(
      z
        .object({
          category: categoryEnum.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vaultDocuments.userId, ctx.user.id)];

      if (input?.category) {
        conditions.push(eq(vaultDocuments.category, input.category));
      }

      const documents = await db.query.vaultDocuments.findMany({
        where: and(...conditions),
        with: {
          tags: true,
        },
        orderBy: [desc(vaultDocuments.createdAt)],
      });

      return documents;
    }),

  // Get a single document
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const document = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.id),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
        with: {
          tags: true,
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      return document;
    }),

  // Upload a new document
  upload: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(100),
        base64: z.string(),
        tags: z.array(z.string().max(50)).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Pre-validate base64 length before decoding (base64 is ~33% larger than binary)
      const estimatedSize = Math.ceil(input.base64.length * 0.75);
      if (estimatedSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }

      // Check file size after decoding
      const buffer = Buffer.from(input.base64, "base64");

      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }

      // Validate MIME type from actual file content
      const mimeValidation = validateMimeType(
        buffer,
        input.mimeType,
        input.fileName
      );
      if (!mimeValidation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mimeValidation.error ?? "Invalid file type",
        });
      }

      // Use validated MIME type (detected type if available, otherwise claimed)
      const validatedMimeType = mimeValidation.detectedType || input.mimeType;

      // Check document count
      const existingDocs = await db.query.vaultDocuments.findMany({
        where: eq(vaultDocuments.userId, ctx.user.id),
        columns: { id: true },
      });

      if (existingDocs.length >= MAX_DOCUMENTS) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum ${MAX_DOCUMENTS} documents allowed`,
        });
      }

      // Determine category
      const category = determineCategory(input.fileName, validatedMimeType);

      // Generate unique filename and path
      const ext = input.fileName.split(".").pop() ?? "bin";
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const storagePath = `${ctx.user.id}/${category}/${uniqueName}`;

      // Track which bucket was used for the upload
      let usedBucket = VAULT_BUCKET;
      let actualStoragePath = storagePath;
      let uploadSucceeded = false;

      // Ensure vault bucket exists before upload
      const vaultBucketReady = await ensureBucketExists(
        ctx.supabase,
        VAULT_BUCKET
      );

      if (vaultBucketReady) {
        // Upload to Supabase Storage (vault bucket)
        const { error: uploadError } = await ctx.supabase.storage
          .from(VAULT_BUCKET)
          .upload(storagePath, buffer, {
            contentType: validatedMimeType,
            upsert: false,
          });

        if (!uploadError) {
          uploadSucceeded = true;
        } else {
          console.warn(
            "[Vault] Upload to vault bucket failed:",
            uploadError.message
          );
        }
      }

      // If vault bucket failed, try assets bucket as fallback
      if (!uploadSucceeded) {
        actualStoragePath = `vault/${storagePath}`;
        usedBucket = ASSETS_BUCKET;

        const { error: fallbackError } = await ctx.supabase.storage
          .from(ASSETS_BUCKET)
          .upload(actualStoragePath, buffer, {
            contentType: validatedMimeType,
            upsert: false,
          });

        if (fallbackError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Failed to upload document: " +
              (fallbackError.message ?? "Unknown error"),
          });
        }
      }

      // Get public URL from the bucket that was used
      const { data: urlData } = ctx.supabase.storage
        .from(usedBucket)
        .getPublicUrl(actualStoragePath);

      try {
        // Create database record only after successful upload
        const [document] = await db
          .insert(vaultDocuments)
          .values({
            userId: ctx.user.id,
            name: input.fileName,
            displayName: input.fileName,
            category,
            mimeType: validatedMimeType,
            size: buffer.length,
            storagePath: actualStoragePath,
            storageBucket: usedBucket,
            publicUrl: urlData.publicUrl,
          })
          .returning();

        // Add tags if provided
        if (input.tags?.length) {
          await db.insert(vaultDocumentTags).values(
            input.tags.map((tag) => ({
              documentId: document!.id,
              tag,
            }))
          );
        }

        return document;
      } catch (dbError) {
        // If database insert fails, clean up the uploaded file
        console.error("[Vault DB Error]:", dbError);
        await ctx.supabase.storage.from(usedBucket).remove([actualStoragePath]);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save document record",
          cause: dbError,
        });
      }
    }),

  // Rename document (update displayName)
  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        displayName: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.id),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const [updated] = await db
        .update(vaultDocuments)
        .set({
          displayName: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, input.id))
        .returning();

      return updated;
    }),

  // Update tags
  updateTags: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tags: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.id),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Delete existing tags
      await db
        .delete(vaultDocumentTags)
        .where(eq(vaultDocumentTags.documentId, input.id));

      // Insert new tags
      if (input.tags.length) {
        await db.insert(vaultDocumentTags).values(
          input.tags.map((tag) => ({
            documentId: input.id,
            tag,
          }))
        );
      }

      // Update timestamp
      await db
        .update(vaultDocuments)
        .set({ updatedAt: new Date() })
        .where(eq(vaultDocuments.id, input.id));

      return { success: true };
    }),

  // Change category
  changeCategory: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        category: categoryEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.id),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      const [updated] = await db
        .update(vaultDocuments)
        .set({
          category: input.category,
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, input.id))
        .returning();

      return updated;
    }),

  // Delete document
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and get storage path + bucket
      const document = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.id),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Delete from storage using the correct bucket
      const { error: deleteError } = await ctx.supabase.storage
        .from(document.storageBucket)
        .remove([document.storagePath]);

      if (deleteError) {
        console.warn(
          "[Vault] Failed to delete from storage:",
          deleteError.message
        );
        // Continue to delete from DB even if storage delete fails
      }

      // Delete from database (tags and processing jobs will cascade)
      await db.delete(vaultDocuments).where(eq(vaultDocuments.id, input.id));

      return { success: true };
    }),

  // Search documents
  search: protectedProcedure
    .input(z.object({ query: z.string().max(200) }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) {
        return [];
      }

      const searchPattern = `%${input.query}%`;

      const documents = await db.query.vaultDocuments.findMany({
        where: and(
          eq(vaultDocuments.userId, ctx.user.id),
          or(
            ilike(vaultDocuments.displayName, searchPattern),
            ilike(vaultDocuments.name, searchPattern)
          )
        ),
        with: {
          tags: true,
        },
        limit: 20,
        orderBy: [desc(vaultDocuments.createdAt)],
      });

      return documents;
    }),

  // Get document counts by category
  getCounts: protectedProcedure.query(async ({ ctx }) => {
    const documents = await db.query.vaultDocuments.findMany({
      where: eq(vaultDocuments.userId, ctx.user.id),
      columns: {
        category: true,
      },
    });

    const counts: Record<string, number> = {
      all: documents.length,
      contracts: 0,
      receipts: 0,
      images: 0,
      invoices: 0,
      bills: 0,
      statements: 0,
      tax_documents: 0,
      other: 0,
    };

    for (const doc of documents) {
      const category = doc.category;
      if (category && Object.prototype.hasOwnProperty.call(counts, category)) {
        const key = category as keyof typeof counts;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }

    return counts;
  }),

  // ==================== DOCUMENT PROCESSING ====================

  // Check if Reducto is configured
  isProcessingAvailable: protectedProcedure.query(() => {
    return { available: reductoService.isConfigured() };
  }),

  // Process a document with Reducto
  processDocument: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // First get the document to get its storage path and bucket
      const doc = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.documentId),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Generate a signed URL that Reducto can access (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } =
        await ctx.supabase.storage
          .from(doc.storageBucket)
          .createSignedUrl(doc.storagePath, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.warn(
          "[Vault] Failed to create signed URL:",
          signedUrlError?.message
        );
        // Fall back to public URL if signed URL fails
      }

      const result = await documentProcessorService.processDocument(
        input.documentId,
        ctx.user.id,
        signedUrlData?.signedUrl
      );

      if (result.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Processing failed",
        });
      }

      return result;
    }),

  // Get processing result for a document
  getProcessingResult: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await db.query.vaultProcessingJobs.findFirst({
        where: and(
          eq(vaultProcessingJobs.documentId, input.documentId),
          eq(vaultProcessingJobs.userId, ctx.user.id)
        ),
        orderBy: [desc(vaultProcessingJobs.createdAt)],
      });

      if (!job) {
        return null;
      }

      // Parse and validate extracted data with Zod schema
      const extractedDataSchema = z
        .object({
          vendor: z
            .object({
              name: z.string().optional(),
              address: z.string().optional(),
              taxId: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
            })
            .optional(),
          invoice: z
            .object({
              number: z.string().optional(),
              date: z.string().optional(),
              dueDate: z.string().optional(),
              subtotal: z.number().optional(),
              tax: z.number().optional(),
              total: z.number().optional(),
              currency: z.string().optional(),
            })
            .optional(),
          lineItems: z
            .array(
              z.object({
                description: z.string().optional(),
                quantity: z.number().optional(),
                unitPrice: z.number().optional(),
                amount: z.number().optional(),
              })
            )
            .optional(),
          raw: z.record(z.string(), z.unknown()).optional(),
        })
        .passthrough(); // Allow additional fields

      let extractedData = null;
      if (job.extractedData) {
        try {
          const parsed = JSON.parse(job.extractedData);
          // Validate with Zod schema, but use passthrough to allow extra fields
          const validated = extractedDataSchema.safeParse(parsed);
          extractedData = validated.success ? validated.data : parsed;
        } catch {
          // Ignore parse error - leave extractedData as null
        }
      }

      // Get matched vendor details if any
      let matchedVendor = null;
      if (job.matchedVendorId) {
        matchedVendor = await db.query.vendors.findFirst({
          where: eq(vendors.id, job.matchedVendorId),
          columns: { id: true, name: true, email: true },
        });
      }

      return {
        id: job.id,
        status: job.status,
        extractedData,
        matchedVendor,
        linkedBillId: job.linkedBillId,
        confidenceScore: job.confidenceScore,
        processingDurationMs: job.processingDurationMs,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      };
    }),

  // Get processing history for a document
  getProcessingHistory: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return documentProcessorService.getProcessingHistory(
        input.documentId,
        ctx.user.id
      );
    }),

  // Create bill from processed document
  createBillFromDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        vendorId: z.string().uuid().optional(),
        createVendorIfNotFound: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await documentProcessorService.createBillFromDocument(
          ctx.user.id,
          input.documentId,
          {
            vendorId: input.vendorId,
            createVendorIfNotFound: input.createVendorIfNotFound,
          }
        );

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Failed to create bill",
        });
      }
    }),

  // Reprocess a document
  reprocessDocument: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // First get the document to get its storage path and bucket
      const doc = await db.query.vaultDocuments.findFirst({
        where: and(
          eq(vaultDocuments.id, input.documentId),
          eq(vaultDocuments.userId, ctx.user.id)
        ),
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Generate a signed URL that Reducto can access (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } =
        await ctx.supabase.storage
          .from(doc.storageBucket)
          .createSignedUrl(doc.storagePath, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.warn(
          "[Vault] Failed to create signed URL for reprocess:",
          signedUrlError?.message
        );
        // Fall back to public URL if signed URL fails
      }

      const result = await documentProcessorService.reprocessDocument(
        input.documentId,
        ctx.user.id,
        signedUrlData?.signedUrl
      );

      if (result.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Reprocessing failed",
        });
      }

      return result;
    }),

  // Get all vendors for matching UI
  getVendorsForMatching: protectedProcedure.query(async ({ ctx }) => {
    const userVendors = await db.query.vendors.findMany({
      where: eq(vendors.userId, ctx.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        taxId: true,
      },
      orderBy: (vendors, { asc }) => [asc(vendors.name)],
    });

    return userVendors;
  }),
});
