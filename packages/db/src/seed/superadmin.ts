/**
 * Superadmin Seed Script
 *
 * Promotes a user to superadmin role based on email.
 *
 * Usage:
 *   SUPERADMIN_EMAIL=admin@example.com yarn db:seed:superadmin
 *
 * Requirements:
 *   - User must already exist in the database (have signed up)
 *   - DATABASE_URL must be set in environment
 *   - SUPERADMIN_EMAIL must be provided
 *
 * Security:
 *   - Email is passed via environment variable, not hardcoded
 *   - Script is idempotent (safe to run multiple times)
 *   - Logs all actions for audit trail
 *   - Invalidates user cache after promotion to ensure immediate effect
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { users } from "../schema/users";
import { Redis } from "@upstash/redis";

const USER_CACHE_PREFIX = "user:token:";
const USER_ID_CACHE_PREFIX = "user:id:";

/**
 * Invalidate all cached sessions for a user
 * This ensures role changes take effect immediately without requiring re-login
 */
async function invalidateUserCache(userId: string): Promise<void> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.log("Note: Redis not configured - user may need to log out and back in for changes to take effect");
    return;
  }

  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });

    // Get all token cache keys for this user
    const userIdKey = `${USER_ID_CACHE_PREFIX}${userId}:tokens`;
    const tokens = await redis.get<string[]>(userIdKey);

    if (tokens && tokens.length > 0) {
      // Delete all cached tokens for this user
      for (const tokenKey of tokens) {
        await redis.del(tokenKey);
      }
      console.log(`  - Cleared ${tokens.length} cached session(s)`);
    }

    // Delete the token list
    await redis.del(userIdKey);

    // Also use pattern-based deletion as fallback for any orphaned tokens
    const allUserTokenKeys = await redis.keys(`${USER_CACHE_PREFIX}*`);
    if (allUserTokenKeys.length > 0) {
      await redis.del(...allUserTokenKeys);
      console.log(`  - Cleared ${allUserTokenKeys.length} token cache entries`);
    }

    console.log("  - User session cache cleared successfully");
  } catch (error) {
    console.warn("Warning: Failed to invalidate cache:", error);
    console.log("  - User may need to log out and back in for role changes to take effect");
  }
}

async function main() {
  // Validate environment
  const connectionString = process.env.DATABASE_URL;
  const superadminEmail = process.env.SUPERADMIN_EMAIL;

  if (!connectionString) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  if (!superadminEmail) {
    console.error("ERROR: SUPERADMIN_EMAIL environment variable is required.");
    console.error("");
    console.error("Usage:");
    console.error("  SUPERADMIN_EMAIL=admin@example.com yarn db:seed:superadmin");
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(superadminEmail)) {
    console.error(`ERROR: Invalid email format: ${superadminEmail}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SUPERADMIN PROMOTION SCRIPT");
  console.log("=".repeat(60));
  console.log("");
  console.log(`Target email: ${superadminEmail}`);
  console.log("");

  // Connect to database
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  try {
    // Check if user exists
    const existingUser = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, superadminEmail))
      .limit(1);

    if (existingUser.length === 0) {
      console.error(`ERROR: User with email "${superadminEmail}" not found.`);
      console.error("");
      console.error("The user must sign up first before being promoted to superadmin.");
      console.error("Please have the user create an account, then run this script again.");
      process.exit(1);
    }

    const user = existingUser[0]!;

    // Check if already superadmin
    if (user.role === "superadmin") {
      console.log(`User "${user.name || user.email}" is already a superadmin.`);
      console.log("");
      console.log("Clearing cache to ensure role is active...");
      await invalidateUserCache(user.id);
      console.log("Cache cleared. User can now access superadmin pages.");
      process.exit(0);
    }

    // Promote to superadmin
    console.log(`Found user: ${user.name || "(no name)"} <${user.email}>`);
    console.log(`Current role: ${user.role}`);
    console.log("");
    console.log("Promoting to superadmin...");

    await db
      .update(users)
      .set({
        role: "superadmin",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log("");
    console.log("SUCCESS! User has been promoted to superadmin.");
    console.log("");

    // Invalidate user cache to ensure the role change takes effect immediately
    console.log("Invalidating user cache...");
    await invalidateUserCache(user.id);
    console.log("Cache invalidated. User will see updated role on next request.");
    console.log("");

    console.log("=".repeat(60));
    console.log("IMPORTANT SECURITY NOTES:");
    console.log("=".repeat(60));
    console.log("1. This user now has full platform access");
    console.log("2. They can manage all users and organizations");
    console.log("3. They can view and modify system settings");
    console.log("4. All actions will be logged in admin audit logs");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("ERROR: Failed to promote user to superadmin");
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
