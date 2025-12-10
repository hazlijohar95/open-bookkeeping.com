/**
 * Shared Authentication Helpers
 * Consolidates auth logic used across REST routes
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db, users } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";

// Environment configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase configuration missing - authentication may not work");
}

// Shared Supabase client instance
export const supabase: SupabaseClient | null = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Authenticated user type
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Authenticate a request using the Authorization header
 * Validates the Bearer token against Supabase and looks up the internal user
 */
export async function authenticateRequest(
  authHeader: string | null | undefined
): Promise<AuthenticatedUser | null> {
  if (!authHeader?.startsWith("Bearer ") || !supabase) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error || !supabaseUser) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseUser.id),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  } catch {
    return null;
  }
}
