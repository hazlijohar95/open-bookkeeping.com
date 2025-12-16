import { createClient } from "@supabase/supabase-js";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { db, users } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from "../lib/redis";
import crypto from "crypto";

/**
 * Hash a token to create a secure, collision-resistant cache key.
 * Using SHA-256 ensures different tokens always produce different keys.
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Supabase URL not configured. " +
      "Please set SUPABASE_URL or VITE_SUPABASE_URL in your environment."
  );
}

if (!supabaseServiceKey) {
  throw new Error(
    "Supabase service key not configured. " +
      "Please set SUPABASE_SERVICE_KEY in your environment."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type UserRole = "superadmin" | "admin" | "user" | "viewer";

export interface User {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isSuspended: boolean;
  allowedSavingData: boolean;
}

export interface Context extends Record<string, unknown> {
  user: User | null;
  supabase: typeof supabase;
}

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const USER_CACHE_PREFIX = "user:token:";
const USER_ID_CACHE_PREFIX = "user:id:";

/**
 * Get cached user from Redis/memory
 */
async function getCachedUser(token: string): Promise<User | null> {
  const cacheKey = `${USER_CACHE_PREFIX}${hashToken(token)}`;
  return cacheGet<User>(cacheKey);
}

/**
 * Cache user data
 */
async function setCachedUser(token: string, user: User): Promise<void> {
  // Cache by token hash (SHA-256 for collision resistance)
  const tokenKey = `${USER_CACHE_PREFIX}${hashToken(token)}`;
  await cacheSet(tokenKey, user, CACHE_TTL_SECONDS);

  // Also cache token reference by user ID for invalidation
  const userIdKey = `${USER_ID_CACHE_PREFIX}${user.id}:tokens`;
  const existingTokens = (await cacheGet<string[]>(userIdKey)) ?? [];
  if (!existingTokens.includes(tokenKey)) {
    existingTokens.push(tokenKey);
    await cacheSet(userIdKey, existingTokens, CACHE_TTL_SECONDS);
  }
}

/**
 * Invalidate all cached sessions for a user (call on logout)
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  const userIdKey = `${USER_ID_CACHE_PREFIX}${userId}:tokens`;
  const tokens = await cacheGet<string[]>(userIdKey);

  if (tokens && tokens.length > 0) {
    // Delete all cached tokens for this user
    for (const tokenKey of tokens) {
      await cacheDel(tokenKey);
    }
  }

  // Delete the token list
  await cacheDel(userIdKey);

  // Also try pattern-based deletion as fallback
  await cacheDelPattern(`${USER_CACHE_PREFIX}*`);
}

/**
 * Invalidate a specific token (call on single session logout)
 */
export async function invalidateToken(token: string): Promise<void> {
  const tokenKey = `${USER_CACHE_PREFIX}${hashToken(token)}`;
  await cacheDel(tokenKey);
}

export async function createContext({
  req,
}: FetchCreateContextFnOptions): Promise<Context> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, supabase };
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return { user: null, supabase };
  }

  // Check cache first
  const cachedUser = await getCachedUser(token);
  if (cachedUser) {
    return { user: cachedUser, supabase };
  }

  try {
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return { user: null, supabase };
    }

    // Get or create user in our database
    let user = await db.query.users.findFirst({
      where: eq(users.supabaseId, supabaseUser.id),
    });

    if (!user) {
      // Create user if doesn't exist
      const [newUser] = await db
        .insert(users)
        .values({
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.full_name ?? null,
          avatarUrl: supabaseUser.user_metadata?.avatar_url ?? null,
          allowedSavingData: true,
        })
        .returning();

      user = newUser;
    }

    const userData: User | null = user
      ? {
          id: user.id,
          supabaseId: user.supabaseId,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: (user.role as UserRole) || "user",
          isSuspended: user.isSuspended || false,
          allowedSavingData: user.allowedSavingData,
        }
      : null;

    // Cache the user data
    if (userData) {
      await setCachedUser(token, userData);
    }

    return { user: userData, supabase };
  } catch (error) {
    // Sanitize error logging - never log tokens or sensitive data
    const errorMessage = error instanceof Error ? error.message : "Unknown auth error";
    console.error("Auth error:", errorMessage);
    return { user: null, supabase };
  }
}

export type { Context as TRPCContext };
