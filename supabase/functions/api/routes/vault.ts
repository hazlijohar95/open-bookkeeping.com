/**
 * Vault Document Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/vault.ts
 * Handles document storage and processing
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENTS = 100;
const VAULT_BUCKET = "vault";
const ASSETS_BUCKET = "assets";

const CATEGORIES = [
  "contracts", "receipts", "images", "invoices",
  "bills", "statements", "tax_documents", "other"
] as const;

// ============================================
// ZOD SCHEMAS
// ============================================

const categoryEnum = z.enum(CATEGORIES);

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  base64: z.string(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const renameSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
});

const updateTagsSchema = z.object({
  tags: z.array(z.string()),
});

const changeCategorySchema = z.object({
  category: categoryEnum,
});

const createBillFromDocumentSchema = z.object({
  vendorId: z.string().uuid().optional(),
  createVendorIfNotFound: z.boolean().default(true),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function determineCategory(fileName: string, mimeType: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Image types
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return "images";
  }

  // PDF could be various documents
  if (ext === "pdf" || mimeType === "application/pdf") {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes("invoice")) return "invoices";
    if (lowerName.includes("bill")) return "bills";
    if (lowerName.includes("receipt")) return "receipts";
    if (lowerName.includes("contract") || lowerName.includes("agreement")) return "contracts";
    if (lowerName.includes("statement")) return "statements";
    if (lowerName.includes("tax") || lowerName.includes("return")) return "tax_documents";
    return "other";
  }

  // Word documents
  if (["doc", "docx"].includes(ext) || mimeType.includes("word")) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes("contract") || lowerName.includes("agreement")) return "contracts";
    return "other";
  }

  // Excel/spreadsheets
  if (["xls", "xlsx", "csv"].includes(ext) || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return "statements";
  }

  return "other";
}

// ============================================
// ROUTES
// ============================================

// List all documents
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const category = c.req.query("category");

  let query = db
    .from("vault_documents")
    .select(`
      *,
      tags:vault_document_tags(tag)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    query = query.eq("category", category);
  }

  const { data: documents, error } = await query;

  if (error) {
    console.error("Error fetching documents:", error);
    return c.json({ error: "Failed to fetch documents" }, 500);
  }

  return c.json(documents);
});

// Get a single document
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const { data: document, error } = await db
    .from("vault_documents")
    .select(`
      *,
      tags:vault_document_tags(tag)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Document not found" }, 404);
    }
    console.error("Error fetching document:", error);
    return c.json({ error: "Failed to fetch document" }, 500);
  }

  return c.json(document);
});

// Upload a new document
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const supabase = c.get("supabase");

  const body = await c.req.json();
  const parseResult = uploadSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Pre-validate base64 length
  const estimatedSize = Math.ceil(input.base64.length * 0.75);
  if (estimatedSize > MAX_FILE_SIZE) {
    return c.json({
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    }, 413);
  }

  // Decode base64
  const binaryString = atob(input.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  if (bytes.length > MAX_FILE_SIZE) {
    return c.json({
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    }, 413);
  }

  // Check document count
  const { count } = await db
    .from("vault_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count || 0) >= MAX_DOCUMENTS) {
    return c.json({
      error: `Maximum ${MAX_DOCUMENTS} documents allowed`,
    }, 403);
  }

  // Determine category
  const category = determineCategory(input.fileName, input.mimeType);

  // Generate unique filename and path
  const ext = input.fileName.split(".").pop() || "bin";
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const storagePath = `${user.id}/${category}/${uniqueName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(`vault/${storagePath}`, bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return c.json({ error: "Failed to upload document" }, 500);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(ASSETS_BUCKET)
    .getPublicUrl(`vault/${storagePath}`);

  try {
    // Create database record
    const { data: document, error: dbError } = await db
      .from("vault_documents")
      .insert({
        user_id: user.id,
        name: input.fileName,
        display_name: input.fileName,
        category,
        mime_type: input.mimeType,
        size: bytes.length,
        storage_path: `vault/${storagePath}`,
        storage_bucket: ASSETS_BUCKET,
        public_url: urlData.publicUrl,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Add tags if provided
    if (input.tags?.length) {
      await db.from("vault_document_tags").insert(
        input.tags.map((tag) => ({
          document_id: document.id,
          tag,
        }))
      );
    }

    return c.json(document, 201);
  } catch (error) {
    // Clean up uploaded file on DB error
    await supabase.storage.from(ASSETS_BUCKET).remove([`vault/${storagePath}`]);
    console.error("Database error:", error);
    return c.json({ error: "Failed to save document record" }, 500);
  }
});

// Rename document
app.patch("/:id/rename", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = renameSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const { data: updated, error } = await db
    .from("vault_documents")
    .update({
      display_name: parseResult.data.displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Document not found" }, 404);
    }
    console.error("Error renaming document:", error);
    return c.json({ error: "Failed to rename document" }, 500);
  }

  return c.json(updated);
});

// Update tags
app.patch("/:id/tags", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateTagsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  // Verify ownership
  const { data: existing } = await db
    .from("vault_documents")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Delete existing tags
  await db.from("vault_document_tags").delete().eq("document_id", id);

  // Insert new tags
  if (parseResult.data.tags.length) {
    await db.from("vault_document_tags").insert(
      parseResult.data.tags.map((tag) => ({
        document_id: id,
        tag,
      }))
    );
  }

  // Update timestamp
  await db
    .from("vault_documents")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return c.json({ success: true });
});

// Change category
app.patch("/:id/category", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = changeCategorySchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const { data: updated, error } = await db
    .from("vault_documents")
    .update({
      category: parseResult.data.category,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Document not found" }, 404);
    }
    return c.json({ error: "Failed to change category" }, 500);
  }

  return c.json(updated);
});

// Delete document
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  // Get document to get storage path
  const { data: document, error: fetchError } = await db
    .from("vault_documents")
    .select("storage_path, storage_bucket")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !document) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);

  if (storageError) {
    console.warn("Failed to delete from storage:", storageError);
  }

  // Delete from database (tags will cascade)
  await db.from("vault_documents").delete().eq("id", id);

  return c.json({ success: true });
});

// Search documents
app.get("/search", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const query = c.req.query("q") || "";

  if (!query.trim()) {
    return c.json([]);
  }

  const searchPattern = `%${query}%`;

  const { data: documents, error } = await db
    .from("vault_documents")
    .select(`
      *,
      tags:vault_document_tags(tag)
    `)
    .eq("user_id", user.id)
    .or(`display_name.ilike.${searchPattern},name.ilike.${searchPattern}`)
    .limit(20)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error searching documents:", error);
    return c.json({ error: "Failed to search documents" }, 500);
  }

  return c.json(documents);
});

// Get document counts by category
app.get("/counts", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: documents, error } = await db
    .from("vault_documents")
    .select("category")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error fetching counts:", error);
    return c.json({ error: "Failed to fetch counts" }, 500);
  }

  const counts: Record<string, number> = {
    all: documents?.length || 0,
    contracts: 0,
    receipts: 0,
    images: 0,
    invoices: 0,
    bills: 0,
    statements: 0,
    tax_documents: 0,
    other: 0,
  };

  (documents || []).forEach((doc) => {
    const category = doc.category;
    if (category && category in counts) {
      counts[category]++;
    }
  });

  return c.json(counts);
});

// ============================================
// DOCUMENT PROCESSING
// ============================================

// Check if processing is available
app.get("/processing/available", (c) => {
  // Check if Reducto API key is configured
  const reductoApiKey = Deno.env.get("REDUCTO_API_KEY");
  return c.json({ available: !!reductoApiKey });
});

// Process document (OCR/extraction)
app.post("/:id/process", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  // Get document
  const { data: doc, error: docError } = await db
    .from("vault_documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (docError || !doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Check if Reducto is configured
  const reductoApiKey = Deno.env.get("REDUCTO_API_KEY");
  if (!reductoApiKey) {
    return c.json({
      error: "Document processing is not configured",
    }, 503);
  }

  // Create signed URL for Reducto
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return c.json({ error: "Failed to create document access URL" }, 500);
  }

  // Create processing job record
  const { data: job, error: jobError } = await db
    .from("vault_processing_jobs")
    .insert({
      document_id: id,
      user_id: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (jobError) {
    return c.json({ error: "Failed to create processing job" }, 500);
  }

  // TODO: Call Reducto API for document processing
  // For now, return the job info
  return c.json({
    jobId: job.id,
    status: "pending",
    message: "Document processing started",
  });
});

// Get processing result
app.get("/:id/processing-result", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const { data: job, error } = await db
    .from("vault_processing_jobs")
    .select(`
      *,
      matched_vendor:vendors(id, name, email)
    `)
    .eq("document_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json(null);
    }
    return c.json({ error: "Failed to fetch processing result" }, 500);
  }

  // Parse extracted data
  let extractedData = null;
  if (job.extracted_data) {
    try {
      extractedData = typeof job.extracted_data === "string"
        ? JSON.parse(job.extracted_data)
        : job.extracted_data;
    } catch {
      // Ignore parse error
    }
  }

  return c.json({
    id: job.id,
    status: job.status,
    extractedData,
    matchedVendor: job.matched_vendor,
    linkedBillId: job.linked_bill_id,
    confidenceScore: job.confidence_score,
    processingDurationMs: job.processing_duration_ms,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  });
});

// Get processing history
app.get("/:id/processing-history", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const { data: jobs, error } = await db
    .from("vault_processing_jobs")
    .select("*")
    .eq("document_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: "Failed to fetch history" }, 500);
  }

  return c.json(jobs);
});

// Create bill from processed document
app.post("/:id/create-bill", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid document ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = createBillFromDocumentSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  // Get the latest processing job for this document
  const { data: job, error: jobError } = await db
    .from("vault_processing_jobs")
    .select("*")
    .eq("document_id", id)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (jobError || !job || !job.extracted_data) {
    return c.json({
      error: "No processed data available. Please process the document first.",
    }, 400);
  }

  const extractedData = typeof job.extracted_data === "string"
    ? JSON.parse(job.extracted_data)
    : job.extracted_data;

  // Create bill from extracted data
  const { data: bill, error: billError } = await db
    .from("bills")
    .insert({
      user_id: user.id,
      vendor_id: parseResult.data.vendorId || job.matched_vendor_id,
      bill_number: extractedData.invoiceNumber || `BILL-${Date.now()}`,
      description: extractedData.description,
      currency: extractedData.currency || "MYR",
      bill_date: extractedData.date || new Date().toISOString(),
      due_date: extractedData.dueDate,
      status: "pending",
      total_amount: extractedData.total || "0",
    })
    .select()
    .single();

  if (billError) {
    console.error("Error creating bill:", billError);
    return c.json({ error: "Failed to create bill" }, 500);
  }

  // Create bill items if available
  if (extractedData.lineItems?.length) {
    await db.from("bill_items").insert(
      extractedData.lineItems.map((item: { description: string; quantity: number; unitPrice: string }) => ({
        bill_id: bill.id,
        description: item.description,
        quantity: String(item.quantity || 1),
        unit_price: item.unitPrice || "0",
      }))
    );
  }

  // Update processing job with linked bill
  await db
    .from("vault_processing_jobs")
    .update({ linked_bill_id: bill.id })
    .eq("id", job.id);

  return c.json({
    billId: bill.id,
    message: "Bill created successfully",
  }, 201);
});

// Get vendors for matching UI
app.get("/vendors-for-matching", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: vendors, error } = await db
    .from("vendors")
    .select("id, name, email, tax_id")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    return c.json({ error: "Failed to fetch vendors" }, 500);
  }

  return c.json(vendors);
});

export default app;
