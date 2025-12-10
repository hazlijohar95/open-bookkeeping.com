/**
 * Scheduled Aggregation Function
 * Runs daily to update dashboard statistics and monthly aggregations
 *
 * This replaces the BullMQ aggregation worker from the Node.js backend
 */

import { createClient } from "npm:@supabase/supabase-js@2";

interface AggregationResult {
  userId: string;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  updatedAt: string;
}

/**
 * Get Supabase admin client
 */
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Calculate aggregations for a single user
 */
async function calculateUserAggregations(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<AggregationResult> {
  const now = new Date();

  // Get all non-deleted invoices for user
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id,
      status,
      invoice_details (
        currency
      ),
      invoice_items (
        quantity,
        unit_price
      )
    `)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    console.error(`Error fetching invoices for user ${userId}:`, error);
    throw error;
  }

  // Calculate statistics
  let totalInvoices = 0;
  let paidInvoices = 0;
  let pendingInvoices = 0;
  let overdueInvoices = 0;
  let totalRevenue = 0;
  let pendingAmount = 0;
  let overdueAmount = 0;

  for (const invoice of invoices || []) {
    totalInvoices++;

    // Calculate invoice total
    const total = (invoice.invoice_items || []).reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0
    );

    switch (invoice.status) {
      case "paid":
        paidInvoices++;
        totalRevenue += total;
        break;
      case "pending":
        pendingInvoices++;
        pendingAmount += total;
        break;
      case "overdue":
        overdueInvoices++;
        overdueAmount += total;
        break;
    }
  }

  return {
    userId,
    totalInvoices,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    totalRevenue,
    pendingAmount,
    overdueAmount,
    updatedAt: now.toISOString(),
  };
}

/**
 * Update aggregations table for a user
 */
async function updateAggregations(
  supabase: ReturnType<typeof createClient>,
  aggregation: AggregationResult
) {
  const { error } = await supabase
    .from("aggregations")
    .upsert({
      user_id: aggregation.userId,
      total_invoices: aggregation.totalInvoices,
      paid_invoices: aggregation.paidInvoices,
      pending_invoices: aggregation.pendingInvoices,
      overdue_invoices: aggregation.overdueInvoices,
      total_revenue: aggregation.totalRevenue,
      pending_amount: aggregation.pendingAmount,
      overdue_amount: aggregation.overdueAmount,
      updated_at: aggregation.updatedAt,
    }, {
      onConflict: "user_id",
    });

  if (error) {
    console.error(`Error updating aggregations for user ${aggregation.userId}:`, error);
    throw error;
  }
}

/**
 * Main handler - runs daily via cron
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log("Starting scheduled aggregation...");

  try {
    const supabase = getSupabaseClient();

    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id")
      .is("deleted_at", null);

    if (usersError) {
      throw usersError;
    }

    console.log(`Processing ${users?.length || 0} users...`);

    let processed = 0;
    let failed = 0;

    // Process each user
    for (const user of users || []) {
      try {
        const aggregation = await calculateUserAggregations(supabase, user.id);
        await updateAggregations(supabase, aggregation);
        processed++;
      } catch (err) {
        console.error(`Failed to process user ${user.id}:`, err);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Aggregation complete. Processed: ${processed}, Failed: ${failed}, Duration: ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        duration,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Aggregation failed:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
