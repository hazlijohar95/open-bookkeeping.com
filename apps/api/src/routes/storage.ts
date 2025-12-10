/**
 * Storage REST Routes
 * Provides REST API endpoints for image storage (logos, signatures)
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const storageRoutes = new Hono();

// In-memory storage for development (replace with R2/S3 in production)
const imageStore = new Map<string, {
  key: string;
  url: string;
  type: "logo" | "signature" | "other";
  userId: string;
  createdAt: Date;
}>();

// Validation schemas
const uploadSchema = z.object({
  file: z.string(), // Base64 encoded file
  filename: z.string().max(255),
  type: z.enum(["logo", "signature", "other"]).optional().default("other"),
});

// GET /storage - Get all images for user
storageRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const images = Array.from(imageStore.values())
      .filter((img) => img.userId === user.id)
      .map(({ key, url, type, createdAt }) => ({ key, url, type, createdAt }));

    return c.json(images);
  } catch (error) {
    console.error("Error fetching images:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch images");
  }
});

// GET /storage/logos - Get logo images
storageRoutes.get("/logos", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const logos = Array.from(imageStore.values())
      .filter((img) => img.userId === user.id && img.type === "logo")
      .map(({ key, url, type, createdAt }) => ({ key, url, type, createdAt }));

    return c.json(logos);
  } catch (error) {
    console.error("Error fetching logos:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch logos");
  }
});

// GET /storage/signatures - Get signature images
storageRoutes.get("/signatures", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const signatures = Array.from(imageStore.values())
      .filter((img) => img.userId === user.id && img.type === "signature")
      .map(({ key, url, type, createdAt }) => ({ key, url, type, createdAt }));

    return c.json(signatures);
  } catch (error) {
    console.error("Error fetching signatures:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch signatures");
  }
});

// POST /storage - Upload image
storageRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = uploadSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { file, filename, type } = validation.data;

    // Generate unique key
    const key = `${user.id}/${type}/${Date.now()}-${filename}`;

    // In development, create a data URL
    // In production, this would upload to R2/S3
    const url = `data:image/png;base64,${file.substring(0, 100)}...`; // Truncated for storage

    // Store in memory (replace with actual cloud storage)
    imageStore.set(key, {
      key,
      url: `https://storage.open-bookkeeping.com/${key}`, // Simulated URL
      type,
      userId: user.id,
      createdAt: new Date(),
    });

    return c.json(
      {
        success: true,
        key,
        url: `https://storage.open-bookkeeping.com/${key}`,
      },
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error uploading image:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to upload image");
  }
});

// DELETE /storage - Delete image
storageRoutes.delete("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const key = body.key;

    if (!key) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Image key is required");
    }

    const image = imageStore.get(key);

    if (!image) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Image not found");
    }

    if (image.userId !== user.id) {
      return errorResponse(c, HTTP_STATUS.FORBIDDEN, "Not authorized to delete this image");
    }

    imageStore.delete(key);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete image");
  }
});
