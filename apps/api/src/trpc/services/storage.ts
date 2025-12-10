import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const MAX_IMAGES = 25;
const MAX_LOGO_SIZE = 400 * 1024; // 400KB
const MAX_SIGNATURE_SIZE = 150 * 1024; // 150KB

export const storageRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase.storage
      .from("assets")
      .list(ctx.user.id, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list images",
      });
    }

    return (data || []).map((file) => {
      const path = `${ctx.user.id}/${file.name}`;
      const {
        data: { publicUrl },
      } = ctx.supabase.storage.from("assets").getPublicUrl(path);

      // Determine type from folder structure or filename
      const type = file.name.startsWith("logo") ? "logo" : "signature";

      return {
        key: path,
        name: file.name,
        type,
        url: publicUrl,
        createdAt: file.created_at,
      };
    });
  }),

  upload: protectedProcedure
    .input(
      z.object({
        type: z.enum(["logo", "signature"]),
        base64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check file size
      const buffer = Buffer.from(input.base64, "base64");
      const maxSize = input.type === "logo" ? MAX_LOGO_SIZE : MAX_SIGNATURE_SIZE;

      if (buffer.length > maxSize) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `File too large. Maximum size for ${input.type} is ${maxSize / 1024}KB`,
        });
      }

      // Check image count
      const { data: existing } = await ctx.supabase.storage
        .from("assets")
        .list(`${ctx.user.id}/${input.type}`, { limit: 100 });

      if (existing && existing.length >= MAX_IMAGES) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum ${MAX_IMAGES} ${input.type}s allowed`,
        });
      }

      // Generate unique filename
      const ext = input.fileName.split(".").pop() || "png";
      const uniqueName = `${input.type}_${Date.now()}.${ext}`;
      const path = `${ctx.user.id}/${input.type}/${uniqueName}`;

      // Upload to Supabase Storage
      const { error } = await ctx.supabase.storage
        .from("assets")
        .upload(path, buffer, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload image",
        });
      }

      const {
        data: { publicUrl },
      } = ctx.supabase.storage.from("assets").getPublicUrl(path);

      return { url: publicUrl, key: path };
    }),

  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership - key should start with user's ID
      if (!input.key.startsWith(ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this file",
        });
      }

      const { error } = await ctx.supabase.storage
        .from("assets")
        .remove([input.key]);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete image",
        });
      }

      return { success: true };
    }),
});
