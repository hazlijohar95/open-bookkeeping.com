/**
 * Authentication utilities for Supabase Edge Functions
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import type { Context, Next } from "npm:hono@4";

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Creates the Supabase admin client (with service role key)
 */
export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates the Supabase client from request Authorization header
 */
export function createClientFromRequest(authHeader: string | undefined) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader || "",
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Validates the JWT token and returns user info
 */
export async function validateToken(token: string): Promise<AuthContext["user"] | null> {
  const adminClient = createAdminClient();

  try {
    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
      console.error("Token validation failed:", error?.message);
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      role: user.role,
    };
  } catch (err) {
    console.error("Token validation error:", err);
    return null;
  }
}

/**
 * Authentication middleware for Hono
 */
export function createAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        { error: "Missing or invalid Authorization header" },
        401
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const user = await validateToken(token);

    if (!user) {
      return c.json(
        { error: "Invalid or expired token" },
        401
      );
    }

    // Set user in context for downstream handlers
    c.set("user", user);

    // Set supabase client with user's token for storage operations
    const supabase = createClientFromRequest(authHeader);
    c.set("supabase", supabase);

    await next();
  };
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export function createOptionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const user = await validateToken(token);

      if (user) {
        c.set("user", user);
      }
    }

    await next();
  };
}
