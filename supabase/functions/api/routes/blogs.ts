/**
 * Blog Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/blog.ts
 *
 * Note: These are PUBLIC routes (no auth required)
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

/**
 * Format date to "MMMM d, yyyy" format
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// List all published blogs
app.get("/", async (c) => {
  const db = createDbClient();

  const { data: blogs, error } = await db
    .from("blogs")
    .select("slug, title, description, cover_image, published_at, created_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching blogs:", error);
    return c.json({ error: "Failed to fetch blogs" }, 500);
  }

  const formattedBlogs = blogs.map((blog) => ({
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    coverImage: blog.cover_image,
    date: blog.published_at
      ? formatDate(blog.published_at)
      : formatDate(blog.created_at),
  }));

  return c.json(formattedBlogs);
});

// Get a single blog by slug
app.get("/:slug", async (c) => {
  const db = createDbClient();
  const slug = c.req.param("slug");

  const slugSchema = z.string().min(1).max(255);
  const parseResult = slugSchema.safeParse(slug);
  if (!parseResult.success) {
    return c.json({ error: "Invalid slug format" }, 400);
  }

  const { data: blog, error } = await db
    .from("blogs")
    .select("slug, title, description, content, cover_image, published_at, created_at, published")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Blog post not found" }, 404);
    }
    console.error("Error fetching blog:", error);
    return c.json({ error: "Failed to fetch blog" }, 500);
  }

  if (!blog.published) {
    return c.json({ error: "Blog post not found" }, 404);
  }

  return c.json({
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    content: blog.content,
    coverImage: blog.cover_image,
    date: blog.published_at
      ? formatDate(blog.published_at)
      : formatDate(blog.created_at),
  });
});

export default app;
