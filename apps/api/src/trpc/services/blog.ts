import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { db, blogs } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

export const blogRouter = router({
  list: publicProcedure.query(async () => {
    const allBlogs = await db.query.blogs.findMany({
      where: eq(blogs.published, true),
      orderBy: (blogs, { desc }) => [desc(blogs.publishedAt)],
    });

    return allBlogs.map((blog) => ({
      slug: blog.slug,
      title: blog.title,
      description: blog.description,
      coverImage: blog.coverImage,
      date: blog.publishedAt
        ? format(blog.publishedAt, "MMMM d, yyyy")
        : format(blog.createdAt, "MMMM d, yyyy"),
    }));
  }),

  get: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const blog = await db.query.blogs.findFirst({
        where: eq(blogs.slug, input.slug),
      });

      if (!blog || !blog.published) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Blog post not found",
        });
      }

      return {
        slug: blog.slug,
        title: blog.title,
        description: blog.description,
        content: blog.content,
        coverImage: blog.coverImage,
        date: blog.publishedAt
          ? format(blog.publishedAt, "MMMM d, yyyy")
          : format(blog.createdAt, "MMMM d, yyyy"),
      };
    }),
});
