/**
 * Database client utilities for Supabase Edge Functions
 * Uses Supabase JS client for database operations
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let dbClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for database operations
 * Uses service role key for full access
 */
export function createDbClient(): SupabaseClient {
  if (dbClient) {
    return dbClient;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  dbClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });

  return dbClient;
}

/**
 * Execute a raw SQL query using Supabase RPC
 * For complex queries that can't be done with the JS client
 */
export async function executeRawQuery<T>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const db = createDbClient();

  const { data, error } = await db.rpc("execute_sql", {
    query: sql,
    params: params || {},
  });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as T[];
}

/**
 * Database table names - matches existing Drizzle schema
 */
export const tables = {
  users: "users",
  userSettings: "user_settings",
  customers: "customers",
  vendors: "vendors",
  invoices: "invoices",
  invoiceItems: "invoice_items",
  invoiceDetails: "invoice_details",
  invoiceFields: "invoice_fields",
  quotations: "quotations",
  quotationItems: "quotation_items",
  quotationDetails: "quotation_details",
  quotationFields: "quotation_fields",
  creditNotes: "credit_notes",
  creditNoteItems: "credit_note_items",
  debitNotes: "debit_notes",
  debitNoteItems: "debit_note_items",
  bills: "bills",
  billItems: "bill_items",
  chartOfAccounts: "chart_of_accounts",
  aggregations: "aggregations",
  vaultDocuments: "vault_documents",
  sstTransactions: "sst_transactions",
  bankFeeds: "bank_feeds",
  bankTransactions: "bank_transactions",
  blogs: "blogs",
} as const;

/**
 * Common query patterns
 */
export const queries = {
  /**
   * Get paginated results with count
   */
  async paginate<T>(
    tableName: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      ascending?: boolean;
    } = {}
  ) {
    const db = createDbClient();
    const {
      limit = 50,
      offset = 0,
      orderBy = "created_at",
      ascending = false,
    } = options;

    const { data, error, count } = await db
      .from(tableName)
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return {
      data: data as T[],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    };
  },

  /**
   * Get single record by ID with user ownership check
   */
  async getById<T>(
    tableName: string,
    id: string,
    userId: string
  ): Promise<T | null> {
    const db = createDbClient();

    const { data, error } = await db
      .from(tableName)
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Query failed: ${error.message}`);
    }

    return data as T;
  },

  /**
   * Soft delete a record
   */
  async softDelete(
    tableName: string,
    id: string,
    userId: string
  ): Promise<boolean> {
    const db = createDbClient();

    const { error } = await db
      .from(tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  },
};
