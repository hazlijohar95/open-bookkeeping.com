import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
    "Please set it in your .env file or environment."
  );
}

// Connection pool configuration
const client = postgres(connectionString, {
  prepare: false, // Required for Supabase
  max: 20, // Maximum connections in the pool
  idle_timeout: 30, // Close idle connections after 30 seconds
  connect_timeout: 10, // Connection timeout in seconds
  max_lifetime: 60 * 30, // Max connection lifetime (30 minutes)
});

export const db = drizzle(client, { schema });

export * from "./schema";
export { schema };
export * from "./repositories";
