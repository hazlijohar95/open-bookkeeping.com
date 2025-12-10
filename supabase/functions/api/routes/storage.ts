/**
 * Storage Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/storage.ts
 * Handles logo and signature image storage
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";

const app = new Hono();

// ============================================
// CONSTANTS
// ============================================

const MAX_IMAGES = 25;
const MAX_LOGO_SIZE = 400 * 1024; // 400KB
const MAX_SIGNATURE_SIZE = 150 * 1024; // 150KB
const ASSETS_BUCKET = "assets";

// ============================================
// ZOD SCHEMAS
// ============================================

const uploadSchema = z.object({
  type: z.enum(["logo", "signature"]),
  base64: z.string(),
  fileName: z.string(),
});

const deleteSchema = z.object({
  key: z.string(),
});

// ============================================
// ROUTES
// ============================================

// List all images (logos and signatures)
app.get("/", async (c) => {
  const user = c.get("user");
  const supabase = c.get("supabase");

  // List both logos and signatures
  const [logosResult, signaturesResult] = await Promise.all([
    supabase.storage.from(ASSETS_BUCKET).list(`${user.id}/logo`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    }),
    supabase.storage.from(ASSETS_BUCKET).list(`${user.id}/signature`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    }),
  ]);

  if (logosResult.error && signaturesResult.error) {
    console.error("Error listing images:", logosResult.error, signaturesResult.error);
    return c.json({ error: "Failed to list images" }, 500);
  }

  const results: Array<{
    key: string;
    name: string;
    type: string;
    url: string;
    createdAt: string | undefined;
  }> = [];

  // Process logos
  (logosResult.data || []).forEach((file) => {
    const path = `${user.id}/logo/${file.name}`;
    const { data: { publicUrl } } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);

    results.push({
      key: path,
      name: file.name,
      type: "logo",
      url: publicUrl,
      createdAt: file.created_at,
    });
  });

  // Process signatures
  (signaturesResult.data || []).forEach((file) => {
    const path = `${user.id}/signature/${file.name}`;
    const { data: { publicUrl } } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);

    results.push({
      key: path,
      name: file.name,
      type: "signature",
      url: publicUrl,
      createdAt: file.created_at,
    });
  });

  return c.json(results);
});

// List logos only
app.get("/logos", async (c) => {
  const user = c.get("user");
  const supabase = c.get("supabase");

  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(`${user.id}/logo`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    console.error("Error listing logos:", error);
    return c.json({ error: "Failed to list logos" }, 500);
  }

  return c.json((data || []).map((file) => {
    const path = `${user.id}/logo/${file.name}`;
    const { data: { publicUrl } } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);

    return {
      key: path,
      name: file.name,
      type: "logo",
      url: publicUrl,
      createdAt: file.created_at,
    };
  }));
});

// List signatures only
app.get("/signatures", async (c) => {
  const user = c.get("user");
  const supabase = c.get("supabase");

  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(`${user.id}/signature`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    console.error("Error listing signatures:", error);
    return c.json({ error: "Failed to list signatures" }, 500);
  }

  return c.json((data || []).map((file) => {
    const path = `${user.id}/signature/${file.name}`;
    const { data: { publicUrl } } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);

    return {
      key: path,
      name: file.name,
      type: "signature",
      url: publicUrl,
      createdAt: file.created_at,
    };
  }));
});

// Upload image (logo or signature)
app.post("/", async (c) => {
  const user = c.get("user");
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

  // Decode base64
  const binaryString = atob(input.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Check file size
  const maxSize = input.type === "logo" ? MAX_LOGO_SIZE : MAX_SIGNATURE_SIZE;
  if (bytes.length > maxSize) {
    return c.json({
      error: `File too large. Maximum size for ${input.type} is ${maxSize / 1024}KB`,
    }, 413);
  }

  // Check image count
  const { data: existing } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(`${user.id}/${input.type}`, { limit: 100 });

  if (existing && existing.length >= MAX_IMAGES) {
    return c.json({
      error: `Maximum ${MAX_IMAGES} ${input.type}s allowed`,
    }, 403);
  }

  // Generate unique filename
  const ext = input.fileName.split(".").pop() || "png";
  const uniqueName = `${input.type}_${Date.now()}.${ext}`;
  const path = `${user.id}/${input.type}/${uniqueName}`;

  // Determine content type
  let contentType = "image/png";
  if (ext === "jpg" || ext === "jpeg") {
    contentType = "image/jpeg";
  } else if (ext === "gif") {
    contentType = "image/gif";
  } else if (ext === "webp") {
    contentType = "image/webp";
  } else if (ext === "svg") {
    contentType = "image/svg+xml";
  }

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to upload image" }, 500);
  }

  const { data: { publicUrl } } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);

  return c.json({ url: publicUrl, key: path }, 201);
});

// Delete image
app.delete("/", async (c) => {
  const user = c.get("user");
  const supabase = c.get("supabase");

  const body = await c.req.json();
  const parseResult = deleteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const { key } = parseResult.data;

  // Verify ownership - key should start with user's ID
  if (!key.startsWith(user.id)) {
    return c.json({
      error: "You don't have permission to delete this file",
    }, 403);
  }

  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .remove([key]);

  if (error) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete image" }, 500);
  }

  return c.json({ success: true });
});

// Delete by key in path parameter
app.delete("/:key(*)", async (c) => {
  const user = c.get("user");
  const supabase = c.get("supabase");
  const key = c.req.param("key");

  // Verify ownership
  if (!key.startsWith(user.id)) {
    return c.json({
      error: "You don't have permission to delete this file",
    }, 403);
  }

  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .remove([key]);

  if (error) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete image" }, 500);
  }

  return c.json({ success: true });
});

export default app;
