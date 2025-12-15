import { Hono } from "hono";
import { streamText, generateObject, convertToModelMessages, UIMessage, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  invoiceRepository,
  customerRepository,
  quotationRepository,
  ledgerRepository,
  accountingPeriodRepository,
  vendorRepository,
  billRepository,
  journalEntryRepository,
  accountRepository,
  migrationSessionRepository,
  openingBalanceRepository,
  accountMappingRepository,
} from "@open-bookkeeping/db";
import { aggregationService } from "../services/aggregation.service";
import {
  extractedInvoiceSchema,
  extractedReceiptSchema,
  extractedBankStatementSchema,
} from "../schemas/extraction";
import { authenticateRequest } from "../lib/auth-helpers";
import { createLogger } from "@open-bookkeeping/shared";
import { agentMemoryService } from "../services/agent-memory.service";
import { agentSafetyService } from "../services/agent-safety.service";
import { approvalService, type AgentAction, type AgentActionType } from "../services/approval.service";
import { agentAuditService } from "../services/agent-audit.service";
import { documentProcessorService } from "../services/document-processor.service";
import {
  db,
  vaultDocuments,
  vaultProcessingJobs,
  creditNotes,
  debitNotes,
  bankAccounts,
  bankTransactions,
  fixedAssets,
  fixedAssetCategories,
  fixedAssetDepreciations,
  employees,
  employeeSalaries,
  payrollRuns,
  paySlips,
  bills,
} from "@open-bookkeeping/db";
import { eq, and, desc, ilike, or, gte, lte, sql, isNull } from "drizzle-orm";

const logger = createLogger("ai-routes");

// ============================================
// AI TOOL RESOURCE LIMITS
// ============================================

/**
 * Per-tool execution limits to prevent resource exhaustion
 */
const TOOL_LIMITS = {
  // Maximum results per tool execution
  maxResults: {
    invoices: 50,
    customers: 50,
    vendors: 50,
    quotations: 50,
    bills: 50,
    transactions: 100,
    periods: 24, // 2 years of monthly periods
  },
  // Maximum tool calls per request
  maxToolCallsPerRequest: 10,
  // Timeout for tool execution (ms)
  toolTimeoutMs: 10_000,
} as const;

/**
 * Limit message history to prevent exceeding token limits
 * Keeps last N messages, prioritizing recent context
 */
function limitMessageHistory(messages: UIMessage[], maxMessages: number = 10): UIMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Keep last N messages for recent context
  // Simply slice without modifying content - AIMessage types are complex
  return messages.slice(-maxMessages);
}

// Helper to format currency
function formatCurrency(amount: number, currency: string = "MYR"): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
  }).format(amount);
}

// Helper to get month name
function getMonthName(month: number): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[month - 1] || `Month ${month}`;
}

// ============================================
// TYPE-SAFE EXTRACTION HELPERS
// ============================================

/**
 * Safely extract a string ID from an unknown result object
 * Returns undefined if not a valid string/number ID
 */
function extractResourceId(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }
  if (!("id" in result)) {
    return undefined;
  }
  const id = (result as { id: unknown }).id;
  if (typeof id === "string" && id.length > 0) {
    return id;
  }
  if (typeof id === "number" && !isNaN(id)) {
    return String(id);
  }
  return undefined;
}

/**
 * Safely extract an error message from an unknown result object
 * Returns undefined if not a valid error message
 */
function extractErrorMessage(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }
  if (!("error" in result)) {
    return undefined;
  }
  const error = (result as { error: unknown }).error;
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}

/**
 * Safely parse a numeric string, returning undefined for invalid values
 */
function safeParseFloat(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return isNaN(value) ? undefined : value;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Safely parse an integer, returning undefined for invalid values
 */
function safeParseInt(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return isNaN(value) || !Number.isInteger(value) ? Math.floor(value) : value;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

// Helper to calculate invoice total with NaN protection
function calculateInvoiceTotal(items: Array<{ quantity: number | string; unitPrice: number | string }>) {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    // Skip items with invalid numbers
    if (isNaN(quantity) || isNaN(unitPrice)) {
      return sum;
    }
    return sum + quantity * unitPrice;
  }, 0);
}

/**
 * Wrap tool execution with timeout and error handling
 */
async function withToolTimeout<T>(
  toolName: string,
  fn: () => Promise<T>,
  timeoutMs: number = TOOL_LIMITS.toolTimeoutMs
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// TOOL → ACTION TYPE MAPPING
// Maps AI tool names to approval action types
// ============================================
const TOOL_ACTION_MAPPING: Record<string, AgentActionType> = {
  // Invoice actions
  createInvoice: "create_invoice",
  updateInvoice: "update_invoice",
  updateInvoiceStatus: "update_invoice",
  markInvoiceAsPaid: "mark_invoice_paid",
  postInvoiceToLedger: "send_invoice", // Posting = finalizing
  // Bill actions
  createBill: "create_bill",
  updateBill: "update_bill",
  markBillAsPaid: "mark_bill_paid",
  // Quotation actions
  createQuotation: "create_quotation",
  updateQuotation: "update_quotation",
  updateQuotationStatus: "update_quotation",
  convertQuotationToInvoice: "convert_quotation",
  // Customer/Vendor actions
  createCustomer: "create_customer",
  updateCustomer: "update_customer",
  createVendor: "create_vendor",
  updateVendor: "update_vendor",
  // Journal entry actions
  createJournalEntry: "create_journal_entry",
  postJournalEntry: "create_journal_entry",
  reverseJournalEntry: "reverse_journal_entry",
  // Smart accounting tools (create journal entries)
  recordSalesRevenue: "create_journal_entry",
  recordExpense: "create_journal_entry",
  recordPaymentReceived: "create_journal_entry",
  recordPaymentMade: "create_journal_entry",
  createEntriesFromDocument: "create_journal_entry",
  // Bank transaction matching
  matchTransaction: "match_transaction",
  createMatchingEntry: "create_matching_entry",
};

// Resource type mapping for audit logs
const TOOL_RESOURCE_MAPPING: Record<string, string> = {
  createInvoice: "invoice",
  updateInvoice: "invoice",
  updateInvoiceStatus: "invoice",
  markInvoiceAsPaid: "invoice",
  postInvoiceToLedger: "invoice",
  createBill: "bill",
  updateBill: "bill",
  markBillAsPaid: "bill",
  createQuotation: "quotation",
  updateQuotation: "quotation",
  updateQuotationStatus: "quotation",
  convertQuotationToInvoice: "quotation",
  createCustomer: "customer",
  updateCustomer: "customer",
  createVendor: "vendor",
  updateVendor: "vendor",
  createJournalEntry: "journal_entry",
  postJournalEntry: "journal_entry",
  reverseJournalEntry: "journal_entry",
  recordSalesRevenue: "journal_entry",
  recordExpense: "journal_entry",
  recordPaymentReceived: "journal_entry",
  recordPaymentMade: "journal_entry",
  createEntriesFromDocument: "journal_entry",
};

/**
 * Check quota and approval for write tools
 * Returns approval result or null if no approval needed
 * Enforces: rate limits, daily quotas, amount limits, emergency stop
 */
async function checkToolApproval(
  userId: string,
  sessionId: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
  estimatedAmount?: number
): Promise<{ requiresApproval: boolean; approvalId?: string; message?: string; blocked?: boolean } | null> {
  const actionType = TOOL_ACTION_MAPPING[toolName];
  if (!actionType) {
    // Not a write tool, no approval needed
    return null;
  }

  // =====================================
  // STEP 1: Check quota limits FIRST
  // This includes: emergency stop, rate limit, daily quotas, amount limits
  // =====================================
  const quotaResult = await agentSafetyService.checkQuota(userId, actionType, estimatedAmount);
  if (!quotaResult.allowed) {
    logger.warn({ userId, toolName, reason: quotaResult.reason }, "Tool blocked by quota");
    return {
      requiresApproval: true, // Treat as "requires approval" but actually blocked
      blocked: true,
      message: `⛔ Action blocked: ${quotaResult.reason}${quotaResult.remaining !== undefined ? `. Remaining: ${quotaResult.remaining}` : ""}`,
    };
  }

  // =====================================
  // STEP 2: Check approval requirements
  // =====================================
  const action: AgentAction = {
    type: actionType,
    payload: args,
    estimatedAmount,
    currency: "MYR",
    resourceType: TOOL_RESOURCE_MAPPING[toolName],
  };

  const checkResult = await approvalService.checkRequiresApproval(userId, action);

  if (!checkResult.requiresApproval) {
    return { requiresApproval: false };
  }

  // Create approval request
  const approval = await approvalService.createApprovalRequest({
    userId,
    actionType,
    actionPayload: args,
    sessionId,
    reasoning: `AI agent requested to execute ${toolName}`,
    estimatedImpact: {
      amount: estimatedAmount,
      currency: "MYR",
      resourceType: TOOL_RESOURCE_MAPPING[toolName],
    },
    previewData: args,
  });

  return {
    requiresApproval: true,
    approvalId: approval.id,
    message: `⏳ This action requires approval. ${checkResult.reason}. Please review in your approval queue.`,
  };
}

/**
 * Log tool execution to audit trail and record usage for quota tracking
 */
async function logToolAudit(
  userId: string,
  sessionId: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  success: boolean,
  estimatedAmount?: number,
  approvalType: "auto" | "manual" | "threshold" = "auto"
): Promise<void> {
  const actionType = TOOL_ACTION_MAPPING[toolName];
  if (!actionType) {
    // Not a write tool, don't log
    return;
  }

  try {
    // =====================================
    // STEP 1: Log to audit trail (always)
    // =====================================
    await agentAuditService.logAction({
      userId,
      sessionId,
      action: actionType,
      resourceType: TOOL_RESOURCE_MAPPING[toolName] || "unknown",
      resourceId: extractResourceId(result),
      newState: typeof result === "object" && result !== null ? result as Record<string, unknown> : { result },
      reasoning: `Executed ${toolName} via chat`,
      approvalType,
      success,
      errorMessage: !success ? extractErrorMessage(result) : undefined,
      financialImpact: estimatedAmount !== undefined && estimatedAmount > 0 ? {
        amount: estimatedAmount,
        currency: "MYR",
        direction: actionType.includes("expense") || actionType.includes("bill") || actionType.includes("payment_made") ? "decrease" : "increase",
      } : undefined,
    });

    // =====================================
    // STEP 2: Record usage for quota tracking (only on success)
    // This updates daily counters: invoicesCreated, billsCreated, etc.
    // =====================================
    if (success) {
      await agentSafetyService.recordUsage(userId, {
        action: actionType,
        amount: estimatedAmount,
        currency: "MYR",
      });
      logger.debug({ userId, toolName, actionType, estimatedAmount }, "Usage recorded for quota tracking");
    }
  } catch (error) {
    logger.error({ error, toolName, userId }, "Failed to log tool audit or record usage");
  }
}

const aiRoutes = new Hono();

/**
 * Chat endpoint - Agentic AI with tool calling and deep data integration
 * Features: Session Memory, Long-term Memory, Planning Phase, ReAct Loop
 */
aiRoutes.post("/chat", async (c) => {
  const authHeader = c.req.header("Authorization");
  const user = await authenticateRequest(authHeader);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { messages, sessionId }: { messages: UIMessage[]; sessionId?: string } = await c.req.json();

  // ============================================
  // SESSION MEMORY - Load or create session
  // ============================================
  let session: Awaited<ReturnType<typeof agentMemoryService.getOrCreateSession>> | undefined;
  try {
    session = await agentMemoryService.getOrCreateSession(user.id, sessionId);
    logger.debug({ userId: user.id, sessionId: session.id }, "Session loaded/created");
  } catch (error) {
    logger.error({ error, userId: user.id }, "Failed to load session, continuing without persistence");
  }

  // ============================================
  // TOKEN BUDGET PRE-CHECK
  // ============================================
  try {
    const usage = await agentSafetyService.getTodayUsage(user.id);
    const quotas = await agentSafetyService.getQuotas(user.id);

    // Estimate minimum tokens needed for this request (conservative estimate)
    // A typical request uses ~500-2000 tokens for prompt + ~500-1500 for completion
    const estimatedMinTokens = 1500;

    if (usage.tokensUsed + estimatedMinTokens > quotas.dailyTokenLimit) {
      logger.warn(
        { userId: user.id, tokensUsed: usage.tokensUsed, dailyLimit: quotas.dailyTokenLimit },
        "Token budget would be exceeded"
      );
      return c.json(
        {
          error: "Daily token limit reached",
          details: `You've used ${usage.tokensUsed.toLocaleString()} of ${quotas.dailyTokenLimit.toLocaleString()} tokens today. Please try again tomorrow or contact support to increase your limit.`,
          tokensUsed: usage.tokensUsed,
          dailyLimit: quotas.dailyTokenLimit,
        },
        429
      );
    }

    // Also check if emergency stop is enabled
    if (quotas.emergencyStopEnabled) {
      logger.warn({ userId: user.id }, "Emergency stop is enabled");
      return c.json(
        {
          error: "AI agent is paused",
          details: "AI agent actions are currently disabled. Please contact support or disable emergency stop in settings.",
        },
        403
      );
    }
  } catch (error) {
    logger.error({ error, userId: user.id }, "Failed to check token budget, continuing anyway");
  }

  // ============================================
  // LONG-TERM MEMORY - Build context from memories
  // ============================================
  let memoryContext = "";
  try {
    memoryContext = await agentMemoryService.buildAgentContext(user.id);
    if (memoryContext) {
      logger.debug({ userId: user.id }, "Memory context built successfully");
    }
  } catch (error) {
    logger.error({ error, userId: user.id }, "Failed to build memory context");
  }

  // Define tools for data access using AI SDK v5 tool() helper
  const tools = {
    // Dashboard & Statistics
    getDashboardStats: tool({
      description: "Get dashboard statistics including total revenue, pending invoices, overdue invoices, quotation conversion rate, and monthly revenue. Use this to answer questions about overall business performance.",
      inputSchema: z.object({
        includeQuotations: z.boolean().optional().describe("Whether to include quotation statistics (defaults to true)"),
      }),
      execute: async ({ includeQuotations = true }) => {
        return withToolTimeout("getDashboardStats", async () => {
          try {
            const stats = await aggregationService.getDashboardStats(user.id);

            const result: Record<string, unknown> = {
              totalRevenue: formatCurrency(stats.totalRevenue),
              totalRevenueRaw: stats.totalRevenue,
              pendingAmount: formatCurrency(stats.pendingAmount),
              pendingAmountRaw: stats.pendingAmount,
              totalInvoices: stats.totalInvoices,
              overdueCount: stats.overdueCount,
              paidThisMonth: stats.paidThisMonth,
              revenueThisMonth: formatCurrency(stats.revenueThisMonth),
              revenueThisMonthRaw: stats.revenueThisMonth,
              currency: "MYR",
            };

            if (includeQuotations) {
              // Use efficient count query instead of fetching all records
              const quotationStats = await quotationRepository.getStats(user.id);
              result.totalQuotations = quotationStats.total;
              result.convertedQuotations = quotationStats.converted;
              result.conversionRate = `${quotationStats.conversionRate}%`;
            }

            return result;
          } catch (error) {
            logger.error({ error }, "getDashboardStats failed");
            return { error: "Failed to fetch dashboard stats" };
          }
        });
      },
    }),

    // Invoice Operations
    listInvoices: tool({
      description: "List user's invoices with optional filters. Use this to show recent invoices, find invoices by status, or get an overview of invoicing activity.",
      inputSchema: z.object({
        limit: z.number().max(TOOL_LIMITS.maxResults.invoices).optional().describe(`Number of invoices to return (default 10, max ${TOOL_LIMITS.maxResults.invoices})`),
        status: z.enum(["pending", "success", "overdue", "expired", "refunded"]).optional().describe("Filter by invoice status"),
      }),
      execute: async ({ limit = 10, status }: { limit?: number; status?: "pending" | "success" | "overdue" | "expired" | "refunded" }) => {
        return withToolTimeout("listInvoices", async () => {
          try {
            // Enforce limits
            const effectiveLimit = Math.min(limit || 10, TOOL_LIMITS.maxResults.invoices);
            const invoices = await invoiceRepository.findManyLight(user.id, { limit: effectiveLimit });

            let filtered = invoices;
            if (status) {
              const now = new Date();
              filtered = invoices.filter(inv => {
                if (status === "overdue") {
                  return inv.status === "pending" && inv.dueDate && new Date(inv.dueDate) < now;
                }
                return inv.status === status;
              });
            }

            return {
              invoices: filtered.slice(0, effectiveLimit).map(inv => ({
                id: inv.id,
                serialNumber: `${inv.prefix ?? ""}${inv.serialNumber ?? "N/A"}`,
                clientName: inv.clientName ?? "Unknown",
                amount: formatCurrency(inv.amount, inv.currency ?? "MYR"),
                amountRaw: inv.amount,
                status: inv.status,
                dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "No due date",
                createdAt: new Date(inv.createdAt).toLocaleDateString(),
                isOverdue: inv.status === "pending" && inv.dueDate && new Date(inv.dueDate) < new Date(),
              })),
              total: filtered.length,
            };
          } catch (error) {
            logger.error({ error }, "listInvoices failed");
            return { error: "Failed to fetch invoices" };
          }
        });
      },
    }),

    getInvoiceDetails: tool({
      description: "Get detailed information about a specific invoice by ID. Use this when user asks about a specific invoice.",
      inputSchema: z.object({
        invoiceId: z.string().describe("The invoice ID to look up"),
      }),
      execute: async ({ invoiceId }: { invoiceId: string }) => {
        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          const items = invoice.invoiceFields?.items ?? [];
          const total = calculateInvoiceTotal(items);
          const currency = invoice.invoiceFields?.invoiceDetails?.currency ?? "MYR";

          return {
            id: invoice.id,
            serialNumber: `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`,
            status: invoice.status,
            clientName: invoice.invoiceFields?.clientDetails?.name ?? "Unknown",
            clientAddress: invoice.invoiceFields?.clientDetails?.address ?? "",
            companyName: invoice.invoiceFields?.companyDetails?.name ?? "",
            date: invoice.invoiceFields?.invoiceDetails?.date
              ? new Date(invoice.invoiceFields.invoiceDetails.date).toLocaleDateString()
              : "",
            dueDate: invoice.invoiceFields?.invoiceDetails?.dueDate
              ? new Date(invoice.invoiceFields.invoiceDetails.dueDate).toLocaleDateString()
              : "No due date",
            items: items.map(item => ({
              name: item.name,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: formatCurrency(Number(item.unitPrice), currency),
              total: formatCurrency(Number(item.quantity) * Number(item.unitPrice), currency),
            })),
            subtotal: formatCurrency(total, currency),
            total: formatCurrency(total, currency),
            currency,
            notes: invoice.invoiceFields?.metadata?.notes ?? "",
            terms: invoice.invoiceFields?.metadata?.terms ?? "",
            paidAt: invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : null,
            createdAt: new Date(invoice.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          return { error: "Failed to fetch invoice details" };
        }
      },
    }),

    getAgingReport: tool({
      description: "Get accounts receivable aging report showing overdue invoices grouped by days overdue (current, 1-30 days, 31-60 days, 61-90 days, over 90 days). Use this to understand payment delays and outstanding amounts.",
      inputSchema: z.object({
        customerId: z.string().optional().describe("Optional customer ID to filter the report"),
      }),
      execute: async ({ customerId }: { customerId?: string }) => {
        try {
          const report = await invoiceRepository.getAgingReport(user.id, customerId);
          return {
            summary: report.totals,
            breakdown: {
              current: `${report.totals.current} invoices (not yet due)`,
              days1to30: `${report.totals.days1to30} invoices (1-30 days overdue)`,
              days31to60: `${report.totals.days31to60} invoices (31-60 days overdue)`,
              days61to90: `${report.totals.days61to90} invoices (61-90 days overdue)`,
              over90: `${report.totals.over90} invoices (over 90 days overdue)`,
            },
            totalUnpaid: report.totals.total,
          };
        } catch (error) {
          return { error: "Failed to fetch aging report" };
        }
      },
    }),

    // Customer Operations
    listCustomers: tool({
      description: "List all customers. Use this to show customer list or find information about customers.",
      inputSchema: z.object({
        limit: z.number().optional().describe("Number of customers to return (default 20)"),
      }),
      execute: async ({ limit = 20 }) => {
        try {
          const customers = await customerRepository.findMany(user.id, { limit });
          return {
            customers: customers.map(c => ({
              id: c.id,
              name: c.name,
              email: c.email ?? "No email",
              phone: c.phone ?? "No phone",
              address: c.address ?? "No address",
              createdAt: new Date(c.createdAt).toLocaleDateString(),
            })),
            total: customers.length,
          };
        } catch (error) {
          return { error: "Failed to fetch customers" };
        }
      },
    }),

    searchCustomers: tool({
      description: "Search customers by name or email. Use this when user wants to find a specific customer.",
      inputSchema: z.object({
        query: z.string().describe("Search query (name or email)"),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const customers = await customerRepository.search(user.id, query);
          return {
            customers: customers.map(c => ({
              id: c.id,
              name: c.name,
              email: c.email ?? "No email",
              phone: c.phone ?? "No phone",
            })),
            total: customers.length,
            query,
          };
        } catch (error) {
          return { error: "Failed to search customers" };
        }
      },
    }),

    getCustomerInvoices: tool({
      description: "Get all invoices for a specific customer. Use this to see a customer's invoice history or find unpaid invoices for a customer.",
      inputSchema: z.object({
        customerId: z.string().describe("The customer ID"),
        unpaidOnly: z.boolean().optional().describe("Return only unpaid invoices (defaults to false)"),
      }),
      execute: async ({ customerId, unpaidOnly = false }: { customerId: string; unpaidOnly?: boolean }) => {
        try {
          const customer = await customerRepository.findById(customerId, user.id);
          if (!customer) {
            return { error: "Customer not found" };
          }

          const invoices = unpaidOnly
            ? await invoiceRepository.getUnpaidByCustomer(customerId, user.id)
            : await invoiceRepository.findByCustomer(customerId, user.id);

          return {
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
            },
            invoices: invoices.map(inv => {
              const items = inv.invoiceFields?.items ?? [];
              const total = calculateInvoiceTotal(items);
              const currency = inv.invoiceFields?.invoiceDetails?.currency ?? "MYR";
              return {
                id: inv.id,
                serialNumber: `${inv.invoiceFields?.invoiceDetails?.prefix ?? ""}${inv.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`,
                amount: formatCurrency(total, currency),
                status: inv.status,
                dueDate: inv.invoiceFields?.invoiceDetails?.dueDate
                  ? new Date(inv.invoiceFields.invoiceDetails.dueDate).toLocaleDateString()
                  : "No due date",
              };
            }),
            totalInvoices: invoices.length,
          };
        } catch (error) {
          return { error: "Failed to fetch customer invoices" };
        }
      },
    }),

    // Quotation Operations
    listQuotations: tool({
      description: "List user's quotations with optional status filter. Use this to show quotations or find quotes by status.",
      inputSchema: z.object({
        limit: z.number().optional().describe("Number of quotations to return (default 10)"),
        status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]).optional().describe("Filter by quotation status"),
      }),
      execute: async ({ limit = 10, status }: { limit?: number; status?: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted" }) => {
        try {
          const quotations = await quotationRepository.findMany(user.id, { limit: 50 });

          let filtered = status
            ? quotations.filter(q => q.status === status)
            : quotations;

          return {
            quotations: filtered.slice(0, limit).map(q => {
              const items = q.quotationFields?.items ?? [];
              const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
              const currency = q.quotationFields?.quotationDetails?.currency ?? "MYR";
              return {
                id: q.id,
                serialNumber: `${q.quotationFields?.quotationDetails?.prefix ?? ""}${q.quotationFields?.quotationDetails?.serialNumber ?? ""}`,
                clientName: q.quotationFields?.clientDetails?.name ?? "Unknown",
                amount: formatCurrency(total, currency),
                status: q.status,
                validUntil: q.quotationFields?.quotationDetails?.validUntil
                  ? new Date(q.quotationFields.quotationDetails.validUntil).toLocaleDateString()
                  : "No expiry",
                createdAt: new Date(q.createdAt).toLocaleDateString(),
              };
            }),
            total: filtered.length,
          };
        } catch (error) {
          return { error: "Failed to fetch quotations" };
        }
      },
    }),

    // Financial Reports & Ledger
    getTrialBalance: tool({
      description: "Get the trial balance report showing all account balances as of a specific date. Use this to verify that debits equal credits and get an overview of all account balances.",
      inputSchema: z.object({
        asOfDate: z.string().optional().describe("The date for the trial balance (YYYY-MM-DD format, defaults to today)"),
      }),
      execute: async ({ asOfDate }) => {
        try {
          const dateStr = asOfDate || new Date().toISOString().split("T")[0];
          const result = await ledgerRepository.getTrialBalance(user.id, dateStr);

          return {
            asOfDate: result.asOfDate,
            accounts: result.accounts.map(acc => ({
              code: acc.accountCode,
              name: acc.accountName,
              type: acc.accountType,
              debit: acc.debitBalance !== "0" ? formatCurrency(parseFloat(acc.debitBalance)) : null,
              credit: acc.creditBalance !== "0" ? formatCurrency(parseFloat(acc.creditBalance)) : null,
            })),
            totalDebits: formatCurrency(parseFloat(result.totalDebits)),
            totalCredits: formatCurrency(parseFloat(result.totalCredits)),
            isBalanced: result.isBalanced,
            accountCount: result.accounts.length,
          };
        } catch (error) {
          return { error: "Failed to fetch trial balance" };
        }
      },
    }),

    getProfitAndLoss: tool({
      description: "Get the Profit and Loss (Income Statement) for a specific period. Shows revenue, expenses, and net profit/loss. Use this to understand business profitability.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date of the period (YYYY-MM-DD format)"),
        endDate: z.string().describe("End date of the period (YYYY-MM-DD format)"),
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const result = await ledgerRepository.getProfitAndLoss(user.id, startDate, endDate);

          return {
            period: result.period,
            revenue: {
              items: result.revenue.accounts.map(acc => ({
                code: acc.code,
                name: acc.name,
                amount: formatCurrency(parseFloat(acc.balance)),
              })),
              total: formatCurrency(parseFloat(result.revenue.total)),
            },
            expenses: {
              costOfGoodsSold: {
                items: result.expenses.costOfGoodsSold.map(acc => ({
                  code: acc.code,
                  name: acc.name,
                  amount: formatCurrency(parseFloat(acc.balance)),
                })),
                total: formatCurrency(parseFloat(result.expenses.totalCOGS)),
              },
              operatingExpenses: {
                items: result.expenses.operatingExpenses.map(acc => ({
                  code: acc.code,
                  name: acc.name,
                  amount: formatCurrency(parseFloat(acc.balance)),
                })),
                total: formatCurrency(parseFloat(result.expenses.totalOperating)),
              },
              otherExpenses: {
                items: result.expenses.otherExpenses.map(acc => ({
                  code: acc.code,
                  name: acc.name,
                  amount: formatCurrency(parseFloat(acc.balance)),
                })),
                total: formatCurrency(parseFloat(result.expenses.totalOther)),
              },
              totalExpenses: formatCurrency(parseFloat(result.expenses.total)),
            },
            grossProfit: formatCurrency(parseFloat(result.grossProfit)),
            operatingProfit: formatCurrency(parseFloat(result.operatingProfit)),
            netProfit: formatCurrency(parseFloat(result.netProfit)),
            isProfitable: parseFloat(result.netProfit) > 0,
          };
        } catch (error) {
          return { error: "Failed to fetch profit and loss statement" };
        }
      },
    }),

    getBalanceSheet: tool({
      description: "Get the Balance Sheet showing assets, liabilities, and equity as of a specific date. Use this to understand the financial position of the business.",
      inputSchema: z.object({
        asOfDate: z.string().optional().describe("The date for the balance sheet (YYYY-MM-DD format, defaults to today)"),
      }),
      execute: async ({ asOfDate }) => {
        try {
          const dateStr = asOfDate || new Date().toISOString().split("T")[0];
          const result = await ledgerRepository.getBalanceSheet(user.id, dateStr);

          return {
            asOfDate: result.asOfDate,
            assets: {
              currentAssets: result.assets.currentAssets.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: formatCurrency(parseFloat(acc.balance)),
              })),
              fixedAssets: result.assets.fixedAssets.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: formatCurrency(parseFloat(acc.balance)),
              })),
              totalCurrent: formatCurrency(parseFloat(result.assets.totalCurrent)),
              totalFixed: formatCurrency(parseFloat(result.assets.totalFixed)),
              totalAssets: formatCurrency(parseFloat(result.assets.total)),
            },
            liabilities: {
              currentLiabilities: result.liabilities.currentLiabilities.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: formatCurrency(parseFloat(acc.balance)),
              })),
              nonCurrentLiabilities: result.liabilities.nonCurrentLiabilities.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: formatCurrency(parseFloat(acc.balance)),
              })),
              totalCurrent: formatCurrency(parseFloat(result.liabilities.totalCurrent)),
              totalNonCurrent: formatCurrency(parseFloat(result.liabilities.totalNonCurrent)),
              totalLiabilities: formatCurrency(parseFloat(result.liabilities.total)),
            },
            equity: {
              accounts: result.equity.accounts.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: formatCurrency(parseFloat(acc.balance)),
              })),
              retainedEarnings: formatCurrency(parseFloat(result.equity.retainedEarnings)),
              currentYearEarnings: formatCurrency(parseFloat(result.equity.currentYearEarnings)),
              totalEquity: formatCurrency(parseFloat(result.equity.total)),
            },
            totalLiabilitiesAndEquity: formatCurrency(parseFloat(result.totalLiabilitiesAndEquity)),
            isBalanced: result.isBalanced,
          };
        } catch (error) {
          return { error: "Failed to fetch balance sheet" };
        }
      },
    }),

    getSSTReport: tool({
      description: "Get the SST (Sales and Service Tax) report for a period showing taxable sales, SST collected, and SST payable.",
      inputSchema: z.object({
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const { invoices } = await import("@open-bookkeeping/db");

          // Query successful (paid) invoices for the period
          const invoiceList = await db.query.invoices.findMany({
            where: and(
              eq(invoices.userId, user.id),
              eq(invoices.status, "success"),
              gte(invoices.createdAt, new Date(startDate)),
              lte(invoices.createdAt, new Date(endDate))
            ),
            with: {
              invoiceFields: {
                with: {
                  invoiceDetails: {
                    with: {
                      billingDetails: true,
                    },
                  },
                  items: true,
                },
              },
            },
          });

          let totalSales = 0;
          let totalSST = 0;
          const sstBreakdown: Record<string, { sales: number; sst: number; count: number }> = {};

          for (const invoice of invoiceList) {
            const invoiceDetails = invoice.invoiceFields?.invoiceDetails;
            const billingDetails = invoiceDetails?.billingDetails || [];
            const items = invoice.invoiceFields?.items || [];

            // Calculate invoice total from items
            let itemsTotal = 0;
            for (const item of items) {
              itemsTotal += Number(item.quantity) * Number(item.unitPrice);
            }

            // Find SST from billing details (type="additional" with isSstTax=true or label contains "SST")
            let invoiceSst = 0;
            for (const bd of billingDetails) {
              if (bd.isSstTax || bd.label?.toLowerCase().includes("sst")) {
                invoiceSst += Number(bd.value);
              }
            }

            // Calculate grand total from items + billing details
            // Billing details include taxes, discounts etc. - all values are added
            // (discounts would be negative values)
            let grandTotal = itemsTotal;
            for (const bd of billingDetails) {
              grandTotal += Number(bd.value);
            }

            totalSales += grandTotal - invoiceSst;
            totalSST += invoiceSst;

            // Group by SST rate (6% standard, 0% exempted)
            const sstRate = invoiceSst > 0 ? "6%" : "0%";
            if (!sstBreakdown[sstRate]) {
              sstBreakdown[sstRate] = { sales: 0, sst: 0, count: 0 };
            }
            sstBreakdown[sstRate].sales += grandTotal - invoiceSst;
            sstBreakdown[sstRate].sst += invoiceSst;
            sstBreakdown[sstRate].count += 1;
          }

          return {
            period: { startDate, endDate },
            summary: {
              totalInvoices: invoiceList.length,
              totalTaxableSales: formatCurrency(totalSales),
              totalSSTCollected: formatCurrency(totalSST),
              netSSTPayable: formatCurrency(totalSST),
            },
            breakdown: Object.entries(sstBreakdown).map(([rate, data]) => ({
              rate,
              sales: formatCurrency(data.sales),
              sst: formatCurrency(data.sst),
              invoiceCount: data.count,
            })),
            note: "This is a simplified SST report. For official SST-02 filing, please use the complete SST module.",
          };
        } catch (error) {
          logger.error({ error }, "getSSTReport failed");
          return { error: "Failed to generate SST report" };
        }
      },
    }),

    getCustomerStatement: tool({
      description: "Get a statement of account for a specific customer showing all invoices, payments, and outstanding balance.",
      inputSchema: z.object({
        customerId: z.string().describe("The customer ID"),
        startDate: z.string().optional().describe("Statement start date (YYYY-MM-DD, defaults to 90 days ago)"),
        endDate: z.string().optional().describe("Statement end date (YYYY-MM-DD, defaults to today)"),
      }),
      execute: async ({ customerId, startDate, endDate }) => {
        try {
          const customer = await customerRepository.findById(customerId, user.id);
          if (!customer) {
            return { error: "Customer not found" };
          }

          const now = new Date();
          const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          const effectiveStartDate = startDate || defaultStart.toISOString().split("T")[0];
          const effectiveEndDate = endDate || now.toISOString().split("T")[0];

          const { invoices } = await import("@open-bookkeeping/db");

          // Get invoices for the customer within the period
          const invoiceList = await db.query.invoices.findMany({
            where: and(
              eq(invoices.userId, user.id),
              eq(invoices.customerId, customerId),
              gte(invoices.createdAt, new Date(effectiveStartDate)),
              lte(invoices.createdAt, new Date(effectiveEndDate))
            ),
            with: {
              invoiceFields: {
                with: {
                  invoiceDetails: {
                    with: {
                      billingDetails: true,
                    },
                  },
                  items: true,
                },
              },
            },
            orderBy: (inv, { desc }) => [desc(inv.createdAt)],
          });

          let totalInvoiced = 0;
          let totalPaid = 0;

          const transactions = invoiceList.map((inv) => {
            const invoiceDetails = inv.invoiceFields?.invoiceDetails;
            const billingDetails = invoiceDetails?.billingDetails || [];
            const items = inv.invoiceFields?.items || [];

            // Calculate invoice total from items
            let itemsTotal = 0;
            for (const item of items) {
              itemsTotal += Number(item.quantity) * Number(item.unitPrice);
            }

            // Calculate grand total from items + billing details
            // Billing details include taxes, discounts etc. - all values are added
            // (discounts would be negative values)
            let invoiceTotal = itemsTotal;
            for (const bd of billingDetails) {
              invoiceTotal += Number(bd.value);
            }

            // Paid status based on invoice status
            const isPaid = inv.status === "success";
            const amountPaid = isPaid ? invoiceTotal : 0;

            totalInvoiced += invoiceTotal;
            totalPaid += amountPaid;

            return {
              date: new Date(inv.createdAt).toLocaleDateString(),
              type: "Invoice",
              reference: inv.invoiceNumber,
              description: `Invoice #${inv.invoiceNumber}`,
              amount: formatCurrency(invoiceTotal),
              amountPaid: formatCurrency(amountPaid),
              balance: formatCurrency(invoiceTotal - amountPaid),
              status: inv.status,
            };
          });

          const outstandingBalance = totalInvoiced - totalPaid;

          return {
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
            },
            period: { startDate: effectiveStartDate, endDate: effectiveEndDate },
            summary: {
              totalInvoiced: formatCurrency(totalInvoiced),
              totalPaid: formatCurrency(totalPaid),
              outstandingBalance: formatCurrency(outstandingBalance),
              invoiceCount: invoiceList.length,
            },
            transactions,
          };
        } catch (error) {
          logger.error({ error }, "getCustomerStatement failed");
          return { error: "Failed to generate customer statement" };
        }
      },
    }),

    getVendorStatement: tool({
      description: "Get a statement of account for a specific vendor showing all bills, payments, and outstanding balance.",
      inputSchema: z.object({
        vendorId: z.string().describe("The vendor ID"),
        startDate: z.string().optional().describe("Statement start date (YYYY-MM-DD, defaults to 90 days ago)"),
        endDate: z.string().optional().describe("Statement end date (YYYY-MM-DD, defaults to today)"),
      }),
      execute: async ({ vendorId, startDate, endDate }) => {
        try {
          const vendor = await vendorRepository.findById(vendorId, user.id);
          if (!vendor) {
            return { error: "Vendor not found" };
          }

          const now = new Date();
          const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          const effectiveStartDate = startDate || defaultStart.toISOString().split("T")[0];
          const effectiveEndDate = endDate || now.toISOString().split("T")[0];

          // Get bills for the vendor within the period
          const billList = await db.query.bills.findMany({
            where: and(
              eq(bills.userId, user.id),
              eq(bills.vendorId, vendorId),
              gte(bills.billDate, new Date(effectiveStartDate)),
              lte(bills.billDate, new Date(effectiveEndDate))
            ),
            orderBy: (b, { desc }) => [desc(b.billDate)],
          });

          let totalBilled = 0;
          let totalPaid = 0;

          const transactions = billList.map((bill) => {
            // Calculate total from subtotal + tax
            const subtotal = bill.subtotal ? Number(bill.subtotal) : 0;
            const taxAmount = bill.taxAmount ? Number(bill.taxAmount) : 0;
            const billTotal = subtotal + taxAmount;
            // Status-based paid calculation
            const isPaid = bill.status === "paid";
            const amountPaid = isPaid ? billTotal : 0;
            totalBilled += billTotal;
            totalPaid += amountPaid;

            return {
              date: new Date(bill.billDate).toLocaleDateString(),
              type: "Bill",
              reference: bill.billNumber,
              description: `Bill #${bill.billNumber}`,
              amount: formatCurrency(billTotal),
              amountPaid: formatCurrency(amountPaid),
              balance: formatCurrency(billTotal - amountPaid),
              status: bill.status,
            };
          });

          const outstandingBalance = totalBilled - totalPaid;

          return {
            vendor: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
            },
            period: { startDate: effectiveStartDate, endDate: effectiveEndDate },
            summary: {
              totalBilled: formatCurrency(totalBilled),
              totalPaid: formatCurrency(totalPaid),
              outstandingBalance: formatCurrency(outstandingBalance),
              billCount: billList.length,
            },
            transactions,
          };
        } catch (error) {
          logger.error({ error }, "getVendorStatement failed");
          return { error: "Failed to generate vendor statement" };
        }
      },
    }),

    getAccountingPeriodStatus: tool({
      description: "Get the status of accounting periods (open, closed, or locked). IMPORTANT: In this system, accounting periods are IMPLICITLY OPEN by default - you do NOT need to create them. If no period records exist, all periods are open and ready for posting. Period records are only created when periods are explicitly closed.",
      inputSchema: z.object({
        year: z.number().optional().describe("Filter periods by year (defaults to showing all)"),
      }),
      execute: async ({ year }) => {
        try {
          const periods = await accountingPeriodRepository.listPeriods(user.id, year);

          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];

          // IMPORTANT: No periods = all periods are implicitly open
          const isAllOpen = periods.length === 0;

          return {
            periods: periods.map(p => ({
              period: `${monthNames[p.month - 1]} ${p.year}`,
              year: p.year,
              month: p.month,
              status: p.status,
              closedAt: p.closedAt ? new Date(p.closedAt).toLocaleDateString() : null,
              notes: p.notes,
            })),
            totalPeriods: periods.length,
            openPeriods: periods.filter(p => p.status === "open").length,
            closedPeriods: periods.filter(p => p.status === "closed").length,
            lockedPeriods: periods.filter(p => p.status === "locked").length,
            // Helpful context for the AI
            message: isAllOpen
              ? "No period records found. This means ALL periods are implicitly OPEN and ready for posting transactions. You can post journal entries and transactions for any date without needing to create periods first."
              : `Found ${periods.length} period record(s). Periods without explicit records are implicitly open.`,
            canPostToAnyDate: isAllOpen || periods.some(p => p.status === "open"),
          };
        } catch (error) {
          return { error: "Failed to fetch accounting period status" };
        }
      },
    }),

    searchLedgerTransactions: tool({
      description: "Search through ledger transactions by description, reference, or entry number. Use this to find specific transactions or investigate entries.",
      inputSchema: z.object({
        query: z.string().describe("Search query (searches description, reference, and entry number)"),
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        limit: z.number().optional().describe("Maximum results to return (default 20)"),
      }),
      execute: async ({ query, startDate, endDate, limit = 20 }) => {
        try {
          const results = await ledgerRepository.searchTransactions(user.id, {
            query,
            startDate,
            endDate,
            limit,
          });

          return {
            transactions: results.map(t => ({
              date: t.transactionDate,
              entryNumber: t.entryNumber,
              description: t.description,
              reference: t.reference,
              debit: t.debitAmount !== "0" ? formatCurrency(parseFloat(t.debitAmount)) : null,
              credit: t.creditAmount !== "0" ? formatCurrency(parseFloat(t.creditAmount)) : null,
            })),
            totalResults: results.length,
            query,
          };
        } catch (error) {
          return { error: "Failed to search transactions" };
        }
      },
    }),

    // ==========================================
    // ACTION TOOLS - Create/Update/Delete Operations
    // ==========================================

    createCustomer: tool({
      description: "Create a new customer in the system. Use this when the user wants to add a new client or customer. Returns the created customer details.",
      inputSchema: z.object({
        name: z.string().describe("Customer's full name or company name"),
        email: z.string().email().optional().describe("Customer's email address"),
        phone: z.string().optional().describe("Customer's phone number"),
        address: z.string().optional().describe("Customer's billing address"),
      }),
      execute: async ({ name, email, phone, address }) => {
        const toolArgs = { name, email, phone, address };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createCustomer", toolArgs);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "customer", name },
            };
          }

          const customer = await customerRepository.create({
            userId: user.id,
            name,
            email: email ?? null,
            phone: phone ?? null,
            address: address ?? null,
          });

          const result = {
            success: true,
            message: `Customer "${name}" created successfully`,
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
            },
          };

          await logToolAudit(user.id, session?.id, "createCustomer", toolArgs, result.customer, true);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to create customer", details: String(error) };
          await logToolAudit(user.id, session?.id, "createCustomer", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    createVendor: tool({
      description: "Create a new vendor/supplier in the system. Use this when the user wants to add a new vendor or supplier.",
      inputSchema: z.object({
        name: z.string().describe("Vendor's name or company name"),
        email: z.string().email().optional().describe("Vendor's email address"),
        phone: z.string().optional().describe("Vendor's phone number"),
        address: z.string().optional().describe("Vendor's address"),
      }),
      execute: async ({ name, email, phone, address }) => {
        const toolArgs = { name, email, phone, address };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createVendor", toolArgs);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "vendor", name },
            };
          }

          const vendor = await vendorRepository.create({
            userId: user.id,
            name,
            email: email ?? null,
            phone: phone ?? null,
            address: address ?? null,
          });

          const result = {
            success: true,
            message: `Vendor "${name}" created successfully`,
            vendor: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
            },
          };

          await logToolAudit(user.id, session?.id, "createVendor", toolArgs, result.vendor, true);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to create vendor", details: String(error) };
          await logToolAudit(user.id, session?.id, "createVendor", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    markInvoiceAsPaid: tool({
      description: "Mark an invoice as paid. Use this when the user confirms payment has been received for an invoice.",
      inputSchema: z.object({
        invoiceId: z.string().describe("The ID of the invoice to mark as paid"),
      }),
      execute: async ({ invoiceId }) => {
        const toolArgs = { invoiceId };

        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          // Calculate estimated amount for approval check
          const items = invoice.invoiceFields?.items ?? [];
          const estimatedAmount = calculateInvoiceTotal(items);

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "markInvoiceAsPaid", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "invoice_payment", invoiceId, amount: formatCurrency(estimatedAmount) },
            };
          }

          if (invoice.status === "success") {
            return { error: "Invoice is already marked as paid" };
          }

          const updated = await invoiceRepository.updateStatus(invoiceId, user.id, "success");
          if (!updated) {
            return { error: "Failed to update invoice status" };
          }

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`;

          const result = {
            success: true,
            message: `Invoice ${serialNumber} has been marked as paid`,
            invoice: {
              id: updated.id,
              serialNumber,
              status: updated.status,
              paidAt: updated.paidAt ? new Date(updated.paidAt).toLocaleDateString() : null,
            },
          };

          await logToolAudit(user.id, session?.id, "markInvoiceAsPaid", toolArgs, result.invoice, true, estimatedAmount);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to mark invoice as paid", details: String(error) };
          await logToolAudit(user.id, session?.id, "markInvoiceAsPaid", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    convertQuotationToInvoice: tool({
      description: "Convert an accepted quotation into an invoice. Use this when the user wants to convert a quote to an invoice after it's been accepted.",
      inputSchema: z.object({
        quotationId: z.string().describe("The ID of the quotation to convert"),
      }),
      execute: async ({ quotationId }) => {
        const toolArgs = { quotationId };

        try {
          const quotation = await quotationRepository.findById(quotationId, user.id);
          if (!quotation) {
            return { error: "Quotation not found" };
          }

          // Calculate estimated amount for approval check
          const items = quotation.quotationFields?.items ?? [];
          const estimatedAmount = calculateInvoiceTotal(items);

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "convertQuotationToInvoice", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "quotation_conversion", quotationId, amount: formatCurrency(estimatedAmount) },
            };
          }

          if (quotation.status === "converted") {
            return { error: "This quotation has already been converted to an invoice" };
          }

          const result = await quotationRepository.convertToInvoice(quotationId, user.id);

          // Handle error case from repository
          if ('error' in result) {
            await logToolAudit(user.id, session?.id, "convertQuotationToInvoice", toolArgs, result, false, estimatedAmount);
            return { error: result.error };
          }

          const quotationNumber = `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`;

          const successResult = {
            success: true,
            message: `Quotation ${quotationNumber} has been converted to an invoice`,
            invoice: {
              id: result.invoiceId,
              quotationId: result.quotationId,
              status: "pending",
            },
            quotation: {
              id: quotation.id,
              serialNumber: quotationNumber,
              newStatus: "converted",
            },
          };

          await logToolAudit(user.id, session?.id, "convertQuotationToInvoice", toolArgs, successResult, true, estimatedAmount);

          return successResult;
        } catch (error) {
          const errorResult = { error: "Failed to convert quotation", details: String(error) };
          await logToolAudit(user.id, session?.id, "convertQuotationToInvoice", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    updateInvoiceStatus: tool({
      description: "Update the status of an invoice. Can mark as pending, paid (success), overdue, expired, or refunded.",
      inputSchema: z.object({
        invoiceId: z.string().describe("The ID of the invoice to update"),
        status: z.enum(["pending", "success", "expired", "refunded"]).describe("The new status for the invoice"),
      }),
      execute: async ({ invoiceId, status }) => {
        const toolArgs = { invoiceId, status };

        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          // Calculate estimated amount for approval check
          const items = invoice.invoiceFields?.items ?? [];
          const estimatedAmount = calculateInvoiceTotal(items);

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateInvoiceStatus", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "invoice_status_update", invoiceId, newStatus: status },
            };
          }

          const updated = await invoiceRepository.updateStatus(invoiceId, user.id, status);
          if (!updated) {
            return { error: "Failed to update invoice status" };
          }

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`;

          const result = {
            success: true,
            message: `Invoice ${serialNumber} status updated to "${status}"`,
            invoice: {
              id: updated.id,
              serialNumber,
              previousStatus: invoice.status,
              newStatus: updated.status,
            },
          };

          await logToolAudit(user.id, session?.id, "updateInvoiceStatus", toolArgs, result.invoice, true, estimatedAmount);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to update invoice status", details: String(error) };
          await logToolAudit(user.id, session?.id, "updateInvoiceStatus", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    updateQuotationStatus: tool({
      description: "Update the status of a quotation. Can mark as draft, sent, accepted, rejected, or expired.",
      inputSchema: z.object({
        quotationId: z.string().describe("The ID of the quotation to update"),
        status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).describe("The new status for the quotation"),
      }),
      execute: async ({ quotationId, status }) => {
        const toolArgs = { quotationId, status };

        try {
          const quotation = await quotationRepository.findById(quotationId, user.id);
          if (!quotation) {
            return { error: "Quotation not found" };
          }

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateQuotationStatus", toolArgs);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "quotation_status_update", quotationId, newStatus: status },
            };
          }

          if (quotation.status === "converted") {
            return { error: "Cannot update status of a converted quotation" };
          }

          const updated = await quotationRepository.updateStatus(quotationId, user.id, status);
          if (!updated) {
            return { error: "Failed to update quotation status" };
          }

          // Handle error case from repository
          if ('error' in updated) {
            await logToolAudit(user.id, session?.id, "updateQuotationStatus", toolArgs, updated, false);
            return { error: updated.error };
          }

          const serialNumber = `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`;

          const result = {
            success: true,
            message: `Quotation ${serialNumber} status updated to "${status}"`,
            quotation: {
              id: updated.id,
              serialNumber,
              previousStatus: quotation.status,
              newStatus: updated.status,
            },
          };

          await logToolAudit(user.id, session?.id, "updateQuotationStatus", toolArgs, result.quotation, true);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to update quotation status", details: String(error) };
          await logToolAudit(user.id, session?.id, "updateQuotationStatus", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    // Vendor & Bill Operations
    listVendors: tool({
      description: "List all vendors/suppliers. Use this to show vendor list or find vendors.",
      inputSchema: z.object({
        limit: z.number().optional().describe("Number of vendors to return (default 20)"),
      }),
      execute: async ({ limit = 20 }) => {
        try {
          const vendors = await vendorRepository.findMany(user.id, { limit });
          return {
            vendors: vendors.map(v => ({
              id: v.id,
              name: v.name,
              email: v.email ?? "No email",
              phone: v.phone ?? "No phone",
              address: v.address ?? "No address",
            })),
            total: vendors.length,
          };
        } catch (error) {
          return { error: "Failed to fetch vendors" };
        }
      },
    }),

    listBills: tool({
      description: "List bills (vendor invoices/accounts payable). Use this to see outstanding bills or payment obligations.",
      inputSchema: z.object({
        limit: z.number().optional().describe("Number of bills to return (default 20)"),
        status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).optional().describe("Filter by bill status"),
      }),
      execute: async ({ limit = 20, status }) => {
        try {
          const bills = await billRepository.findMany(user.id, { limit, status });
          return {
            bills: bills.map(b => ({
              id: b.id,
              billNumber: b.billNumber,
              vendorName: b.vendor?.name ?? "Unknown vendor",
              amount: formatCurrency(Number(b.total ?? 0), b.currency),
              status: b.status,
              dueDate: b.dueDate ? new Date(b.dueDate).toLocaleDateString() : "No due date",
              billDate: new Date(b.billDate).toLocaleDateString(),
            })),
            total: bills.length,
          };
        } catch (error) {
          return { error: "Failed to fetch bills" };
        }
      },
    }),

    getUnpaidBills: tool({
      description: "Get unpaid bills that need payment. Use this to see what needs to be paid.",
      inputSchema: z.object({
        vendorId: z.string().optional().describe("Optional vendor ID to filter bills"),
      }),
      execute: async ({ vendorId }) => {
        try {
          const bills = await billRepository.getUnpaidBills(user.id, vendorId);

          const totalUnpaid = bills.reduce((sum, b) => sum + Number(b.total ?? 0), 0);

          return {
            bills: bills.map(b => ({
              id: b.id,
              billNumber: b.billNumber,
              vendorName: b.vendor?.name ?? "Unknown vendor",
              amount: formatCurrency(Number(b.total ?? 0), b.currency),
              status: b.status,
              dueDate: b.dueDate ? new Date(b.dueDate).toLocaleDateString() : "No due date",
              isOverdue: b.status === "overdue" || (b.dueDate && new Date(b.dueDate) < new Date()),
            })),
            totalUnpaid: formatCurrency(totalUnpaid),
            totalUnpaidRaw: totalUnpaid,
            count: bills.length,
          };
        } catch (error) {
          return { error: "Failed to fetch unpaid bills" };
        }
      },
    }),

    markBillAsPaid: tool({
      description: "Mark a bill as paid. Use this when the user has made payment to a vendor.",
      inputSchema: z.object({
        billId: z.string().describe("The ID of the bill to mark as paid"),
      }),
      execute: async ({ billId }) => {
        const toolArgs = { billId };

        try {
          const bill = await billRepository.findById(billId, user.id);
          if (!bill) {
            return { error: "Bill not found" };
          }

          // Calculate estimated amount for approval check
          const estimatedAmount = Number(bill.total ?? 0);

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "markBillAsPaid", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "bill_payment", billId, amount: formatCurrency(estimatedAmount, bill.currency) },
            };
          }

          if (bill.status === "paid") {
            return { error: "Bill is already marked as paid" };
          }

          const updated = await billRepository.updateStatus(billId, user.id, "paid");
          if (!updated) {
            return { error: "Failed to update bill status" };
          }

          const result = {
            success: true,
            message: `Bill ${bill.billNumber} has been marked as paid`,
            bill: {
              id: updated.id,
              billNumber: bill.billNumber,
              vendorName: bill.vendor?.name,
              status: updated.status,
              paidAt: updated.paidAt ? new Date(updated.paidAt).toLocaleDateString() : null,
            },
          };

          await logToolAudit(user.id, session?.id, "markBillAsPaid", toolArgs, result.bill, true, estimatedAmount);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to mark bill as paid", details: String(error) };
          await logToolAudit(user.id, session?.id, "markBillAsPaid", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    // ==========================================
    // ADVANCED MUTATION TOOLS - Full Document Creation
    // ==========================================

    createInvoice: tool({
      description: "Create a new invoice with line items. Use this when the user wants to create an invoice for a customer. Requires company details, client details, and at least one line item.",
      inputSchema: z.object({
        customerId: z.string().optional().describe("Optional customer ID to link the invoice"),
        companyName: z.string().describe("Your company/business name"),
        companyAddress: z.string().describe("Your company/business address"),
        clientName: z.string().describe("Customer/client name"),
        clientAddress: z.string().describe("Customer/client address"),
        currency: z.string().default("MYR").describe("Currency code (default: MYR)"),
        prefix: z.string().default("INV-").describe("Invoice number prefix"),
        serialNumber: z.string().describe("Invoice serial number (e.g., '0001')"),
        date: z.string().describe("Invoice date (YYYY-MM-DD format)"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD format)"),
        items: z.array(z.object({
          name: z.string().describe("Item/service name"),
          description: z.string().optional().describe("Item description"),
          quantity: z.number().describe("Quantity"),
          unitPrice: z.number().describe("Unit price"),
        })).min(1).describe("Invoice line items (at least one required)"),
        notes: z.string().optional().describe("Additional notes for the invoice"),
        terms: z.string().optional().describe("Payment terms"),
      }),
      execute: async ({ customerId, companyName, companyAddress, clientName, clientAddress, currency, prefix, serialNumber, date, dueDate, items, notes, terms }) => {
        const toolArgs = { customerId, companyName, companyAddress, clientName, clientAddress, currency, prefix, serialNumber, date, dueDate, items, notes, terms };
        const estimatedAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createInvoice", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: {
                type: "invoice",
                clientName,
                amount: formatCurrency(estimatedAmount, currency),
                items: items.length,
              },
            };
          }

          // Validate customer if provided
          if (customerId) {
            const customer = await customerRepository.findById(customerId, user.id);
            if (!customer) {
              await logToolAudit(user.id, session?.id, "createInvoice", toolArgs, { error: "Customer not found" }, false, estimatedAmount);
              return { error: "Customer not found" };
            }
          }

          const invoice = await invoiceRepository.create({
            userId: user.id,
            customerId: customerId ?? undefined,
            companyDetails: {
              name: companyName,
              address: companyAddress,
            },
            clientDetails: {
              name: clientName,
              address: clientAddress,
            },
            invoiceDetails: {
              currency,
              prefix,
              serialNumber,
              date: new Date(date),
              dueDate: dueDate ? new Date(dueDate) : null,
            },
            items: items.map(item => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
            metadata: {
              notes: notes ?? undefined,
              terms: terms ?? undefined,
            },
          });

          const result = {
            success: true,
            message: `Invoice ${prefix}${serialNumber} created successfully for ${clientName}`,
            invoice: {
              id: invoice.invoiceId,
              serialNumber: `${prefix}${serialNumber}`,
              clientName,
              amount: formatCurrency(estimatedAmount, currency),
              amountRaw: estimatedAmount,
              currency,
              date,
              dueDate: dueDate ?? null,
              itemCount: items.length,
              status: "pending",
            },
          };

          // Log successful execution to audit
          await logToolAudit(user.id, session?.id, "createInvoice", toolArgs, result.invoice, true, estimatedAmount);

          return result;
        } catch (error) {
          logger.error({ error }, "createInvoice failed");
          const errorResult = { error: "Failed to create invoice", details: String(error) };
          await logToolAudit(user.id, session?.id, "createInvoice", toolArgs, errorResult, false, estimatedAmount);
          return errorResult;
        }
      },
    }),

    createBill: tool({
      description: "Create a new bill (accounts payable) from a vendor. Use this when the user receives an invoice from a vendor that needs to be paid.",
      inputSchema: z.object({
        vendorId: z.string().optional().describe("Optional vendor ID to link the bill"),
        billNumber: z.string().describe("Bill/invoice number from the vendor"),
        description: z.string().optional().describe("Bill description"),
        currency: z.string().default("MYR").describe("Currency code (default: MYR)"),
        billDate: z.string().describe("Bill date (YYYY-MM-DD format)"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD format)"),
        items: z.array(z.object({
          description: z.string().describe("Item/service description"),
          quantity: z.number().describe("Quantity"),
          unitPrice: z.number().describe("Unit price"),
        })).min(1).describe("Bill line items (at least one required)"),
        notes: z.string().optional().describe("Additional notes"),
      }),
      execute: async ({ vendorId, billNumber, description, currency, billDate, dueDate, items, notes }) => {
        const toolArgs = { vendorId, billNumber, description, currency, billDate, dueDate, items, notes };
        const estimatedAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createBill", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: {
                type: "bill",
                billNumber,
                amount: formatCurrency(estimatedAmount, currency),
                items: items.length,
              },
            };
          }

          // Validate vendor if provided
          let vendorName: string | null = null;
          if (vendorId) {
            const vendor = await vendorRepository.findById(vendorId, user.id);
            if (!vendor) {
              await logToolAudit(user.id, session?.id, "createBill", toolArgs, { error: "Vendor not found" }, false, estimatedAmount);
              return { error: "Vendor not found" };
            }
            vendorName = vendor.name;
          }

          const bill = await billRepository.create({
            userId: user.id,
            vendorId: vendorId ?? null,
            billNumber,
            description: description ?? null,
            currency,
            billDate: new Date(billDate),
            dueDate: dueDate ? new Date(dueDate) : null,
            status: "pending",
            notes: notes ?? null,
            items: items.map(item => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
            })),
          });

          const result = {
            success: true,
            message: `Bill ${billNumber} created successfully${vendorName ? ` from ${vendorName}` : ""}`,
            bill: {
              id: bill!.id,
              billNumber,
              vendorName,
              amount: formatCurrency(estimatedAmount, currency),
              amountRaw: estimatedAmount,
              currency,
              billDate,
              dueDate: dueDate ?? null,
              itemCount: items.length,
              status: "pending",
            },
          };

          // Log successful execution to audit
          await logToolAudit(user.id, session?.id, "createBill", toolArgs, result.bill, true, estimatedAmount);

          return result;
        } catch (error) {
          logger.error({ error }, "createBill failed");
          const errorResult = { error: "Failed to create bill", details: String(error) };
          await logToolAudit(user.id, session?.id, "createBill", toolArgs, errorResult, false, estimatedAmount);
          return errorResult;
        }
      },
    }),

    listAccounts: tool({
      description: "List chart of accounts for journal entry creation. Shows account codes, names, and types (asset, liability, equity, revenue, expense).",
      inputSchema: z.object({
        accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]).optional().describe("Filter by account type"),
        limit: z.number().optional().describe("Number of accounts to return (default 50)"),
      }),
      execute: async ({ accountType, limit = 50 }) => {
        try {
          const accounts = await accountRepository.findAll(user.id, { accountType, isHeader: false });
          const limitedAccounts = accounts.slice(0, limit);

          return {
            accounts: limitedAccounts.map((acc: { id: string; code: string; name: string; accountType: string; normalBalance: string; isHeader: boolean }) => ({
              id: acc.id,
              code: acc.code,
              name: acc.name,
              type: acc.accountType,
              normalBalance: acc.normalBalance,
              isHeader: acc.isHeader,
            })),
            total: accounts.length,
          };
        } catch (error) {
          return { error: "Failed to fetch accounts" };
        }
      },
    }),

    // ==========================================
    // SMART ACCOUNTING TOOLS - Built-in Double-Entry Logic
    // The breakthrough: AI just says WHAT happened, tools handle the HOW
    // ==========================================

    recordSalesRevenue: tool({
      description: `Record sales revenue with AUTOMATIC double-entry. Use this when user says "record sale", "made a sale", "revenue from", etc.
The tool automatically: DR appropriate Asset account, CR Sales Revenue account.`,
      inputSchema: z.object({
        amount: z.number().describe("Sale amount"),
        description: z.string().describe("Description (e.g., 'Sales to ABC Corp')"),
        entryDate: z.string().describe("Date (YYYY-MM-DD)"),
        paymentMethod: z.enum(["cash", "bank", "credit"]).describe("cash=DR Cash, bank=DR Bank, credit=DR Accounts Receivable"),
        reference: z.string().optional().describe("Invoice number or reference"),
      }),
      execute: async ({ amount, description, entryDate, paymentMethod, reference }) => {
        const toolArgs = { amount, description, entryDate, paymentMethod, reference };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "recordSalesRevenue", toolArgs, amount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "sales_revenue", amount: formatCurrency(amount), description, paymentMethod },
            };
          }

          // Get standard accounts based on payment method
          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          // Find the appropriate debit account
          let debitAccount;
          if (paymentMethod === "cash") {
            debitAccount = accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"));
          } else if (paymentMethod === "bank") {
            debitAccount = accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));
          } else {
            debitAccount = accounts.find(a => a.code === "1200" || a.name.toLowerCase().includes("accounts receivable"));
          }

          // Find sales revenue account
          const revenueAccount = accounts.find(a =>
            a.code === "4100" || a.code === "4000" ||
            (a.accountType === "revenue" && a.name.toLowerCase().includes("sales"))
          );

          if (!debitAccount || !revenueAccount) {
            const errorResult = {
              error: "Could not find required accounts. Please ensure Chart of Accounts has Cash/Bank/AR and Sales Revenue accounts.",
              suggestion: "Use listAccounts to see available accounts, then use createJournalEntry for custom entries.",
            };
            await logToolAudit(user.id, session?.id, "recordSalesRevenue", toolArgs, errorResult, false, amount);
            return errorResult;
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description: `Sales: ${description}`,
            reference: reference ?? undefined,
            sourceType: "manual",
            lines: [
              { accountId: debitAccount.id, debitAmount: String(amount), description: `${paymentMethod === "credit" ? "AR" : paymentMethod} received` },
              { accountId: revenueAccount.id, creditAmount: String(amount), description: "Sales revenue" },
            ],
          });

          // Auto-post the entry
          await journalEntryRepository.post(entry.id, user.id);

          const result = {
            success: true,
            message: `Sales revenue recorded and posted: ${formatCurrency(amount)}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              debitAccount: `${debitAccount.code} - ${debitAccount.name}`,
              creditAccount: `${revenueAccount.code} - ${revenueAccount.name}`,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };

          await logToolAudit(user.id, session?.id, "recordSalesRevenue", toolArgs, result.entry, true, amount);

          return result;
        } catch (error) {
          logger.error({ error }, "recordSalesRevenue failed");
          const errorResult = { error: "Failed to record sales revenue", details: String(error) };
          await logToolAudit(user.id, session?.id, "recordSalesRevenue", toolArgs, errorResult, false, amount);
          return errorResult;
        }
      },
    }),

    recordExpense: tool({
      description: `Record an expense with AUTOMATIC double-entry. Use this when user says "paid for", "expense", "bought", etc.
The tool automatically: DR Expense account, CR Cash/Bank/AP.`,
      inputSchema: z.object({
        amount: z.number().describe("Expense amount"),
        description: z.string().describe("What was the expense for"),
        entryDate: z.string().describe("Date (YYYY-MM-DD)"),
        expenseType: z.enum(["office", "utilities", "rent", "salary", "supplies", "other"]).describe("Type of expense"),
        paymentMethod: z.enum(["cash", "bank", "credit"]).describe("cash/bank=paid now, credit=on account"),
        reference: z.string().optional().describe("Bill number or reference"),
      }),
      execute: async ({ amount, description, entryDate, expenseType, paymentMethod, reference }) => {
        const toolArgs = { amount, description, entryDate, expenseType, paymentMethod, reference };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "recordExpense", toolArgs, amount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "expense", amount: formatCurrency(amount), description, expenseType },
            };
          }

          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          // Map expense type to account
          const expenseAccountMap: Record<string, string[]> = {
            office: ["6100", "office"],
            utilities: ["6200", "utilities"],
            rent: ["6300", "rent"],
            salary: ["6400", "salary", "wages"],
            supplies: ["6500", "supplies"],
            other: ["6900", "other expense", "miscellaneous"],
          };

          const searchTerms = expenseAccountMap[expenseType];
          let expenseAccount = accounts.find(a =>
            searchTerms.some(term => a.code === term || a.name.toLowerCase().includes(term))
          );

          // Fallback to any expense account
          if (!expenseAccount) {
            expenseAccount = accounts.find(a => a.accountType === "expense");
          }

          // Find credit account based on payment method
          let creditAccount;
          if (paymentMethod === "cash") {
            creditAccount = accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"));
          } else if (paymentMethod === "bank") {
            creditAccount = accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));
          } else {
            creditAccount = accounts.find(a => a.code === "2100" || a.name.toLowerCase().includes("accounts payable"));
          }

          if (!expenseAccount || !creditAccount) {
            const errorResult = {
              error: "Could not find required accounts.",
              suggestion: "Use listAccounts to see available accounts.",
            };
            await logToolAudit(user.id, session?.id, "recordExpense", toolArgs, errorResult, false, amount);
            return errorResult;
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description: `Expense: ${description}`,
            reference: reference ?? undefined,
            sourceType: "manual",
            lines: [
              { accountId: expenseAccount.id, debitAmount: String(amount), description },
              { accountId: creditAccount.id, creditAmount: String(amount), description: `Payment via ${paymentMethod}` },
            ],
          });

          await journalEntryRepository.post(entry.id, user.id);

          const result = {
            success: true,
            message: `Expense recorded and posted: ${formatCurrency(amount)}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              debitAccount: `${expenseAccount.code} - ${expenseAccount.name}`,
              creditAccount: `${creditAccount.code} - ${creditAccount.name}`,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };

          await logToolAudit(user.id, session?.id, "recordExpense", toolArgs, result.entry, true, amount);

          return result;
        } catch (error) {
          logger.error({ error }, "recordExpense failed");
          const errorResult = { error: "Failed to record expense", details: String(error) };
          await logToolAudit(user.id, session?.id, "recordExpense", toolArgs, errorResult, false, amount);
          return errorResult;
        }
      },
    }),

    recordPaymentReceived: tool({
      description: `Record payment received from customer. Use when "customer paid", "received payment", "collected".
Automatically: DR Cash/Bank, CR Accounts Receivable.`,
      inputSchema: z.object({
        amount: z.number().describe("Payment amount"),
        customerName: z.string().describe("Who paid"),
        entryDate: z.string().describe("Date (YYYY-MM-DD)"),
        depositTo: z.enum(["cash", "bank"]).describe("Where deposited"),
        reference: z.string().optional().describe("Invoice or receipt number"),
      }),
      execute: async ({ amount, customerName, entryDate, depositTo, reference }) => {
        const toolArgs = { amount, customerName, entryDate, depositTo, reference };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "recordPaymentReceived", toolArgs, amount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "payment_received", amount: formatCurrency(amount), customerName, depositTo },
            };
          }

          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          const cashOrBank = depositTo === "cash"
            ? accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"))
            : accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));

          const ar = accounts.find(a => a.code === "1200" || a.name.toLowerCase().includes("accounts receivable"));

          if (!cashOrBank || !ar) {
            const errorResult = { error: "Could not find Cash/Bank or Accounts Receivable accounts." };
            await logToolAudit(user.id, session?.id, "recordPaymentReceived", toolArgs, errorResult, false, amount);
            return errorResult;
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description: `Payment received from ${customerName}`,
            reference: reference ?? undefined,
            sourceType: "manual",
            lines: [
              { accountId: cashOrBank.id, debitAmount: String(amount), description: `Deposited to ${depositTo}` },
              { accountId: ar.id, creditAmount: String(amount), description: `Payment from ${customerName}` },
            ],
          });

          await journalEntryRepository.post(entry.id, user.id);

          const result = {
            success: true,
            message: `Payment received: ${formatCurrency(amount)} from ${customerName}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };

          await logToolAudit(user.id, session?.id, "recordPaymentReceived", toolArgs, result.entry, true, amount);

          return result;
        } catch (error) {
          logger.error({ error }, "recordPaymentReceived failed");
          const errorResult = { error: "Failed to record payment", details: String(error) };
          await logToolAudit(user.id, session?.id, "recordPaymentReceived", toolArgs, errorResult, false, amount);
          return errorResult;
        }
      },
    }),

    recordPaymentMade: tool({
      description: `Record payment made to vendor/supplier. Use when "paid vendor", "paid bill", "settled account".
Automatically: DR Accounts Payable, CR Cash/Bank.`,
      inputSchema: z.object({
        amount: z.number().describe("Payment amount"),
        vendorName: z.string().describe("Who was paid"),
        entryDate: z.string().describe("Date (YYYY-MM-DD)"),
        paidFrom: z.enum(["cash", "bank"]).describe("Paid from cash or bank"),
        reference: z.string().optional().describe("Bill or check number"),
      }),
      execute: async ({ amount, vendorName, entryDate, paidFrom, reference }) => {
        const toolArgs = { amount, vendorName, entryDate, paidFrom, reference };

        try {
          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "recordPaymentMade", toolArgs, amount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "payment_made", amount: formatCurrency(amount), vendorName, paidFrom },
            };
          }

          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          const ap = accounts.find(a => a.code === "2100" || a.name.toLowerCase().includes("accounts payable"));
          const cashOrBank = paidFrom === "cash"
            ? accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"))
            : accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));

          if (!ap || !cashOrBank) {
            const errorResult = { error: "Could not find Accounts Payable or Cash/Bank accounts." };
            await logToolAudit(user.id, session?.id, "recordPaymentMade", toolArgs, errorResult, false, amount);
            return errorResult;
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description: `Payment to ${vendorName}`,
            reference: reference ?? undefined,
            sourceType: "manual",
            lines: [
              { accountId: ap.id, debitAmount: String(amount), description: `Paid to ${vendorName}` },
              { accountId: cashOrBank.id, creditAmount: String(amount), description: `From ${paidFrom}` },
            ],
          });

          await journalEntryRepository.post(entry.id, user.id);

          const result = {
            success: true,
            message: `Payment made: ${formatCurrency(amount)} to ${vendorName}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };

          await logToolAudit(user.id, session?.id, "recordPaymentMade", toolArgs, result.entry, true, amount);

          return result;
        } catch (error) {
          logger.error({ error }, "recordPaymentMade failed");
          const errorResult = { error: "Failed to record payment", details: String(error) };
          await logToolAudit(user.id, session?.id, "recordPaymentMade", toolArgs, errorResult, false, amount);
          return errorResult;
        }
      },
    }),

    postInvoiceToLedger: tool({
      description: `Post an invoice to the accounting ledger. Creates proper journal entry: DR Accounts Receivable, CR Sales Revenue.
Use when user wants to "record invoice in books", "post invoice to accounting", "do accounting for invoice".`,
      inputSchema: z.object({
        invoiceId: z.string().describe("Invoice ID to post"),
        entryDate: z.string().optional().describe("Date (YYYY-MM-DD), defaults to invoice date"),
      }),
      execute: async ({ invoiceId, entryDate }) => {
        const toolArgs = { invoiceId, entryDate };

        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          const items = invoice.invoiceFields?.items ?? [];
          const total = calculateInvoiceTotal(items);
          const invoiceNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`;
          const clientName = invoice.invoiceFields?.clientDetails?.name ?? "Unknown";
          const invoiceDate = invoice.invoiceFields?.invoiceDetails?.date
            ? new Date(invoice.invoiceFields.invoiceDetails.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "postInvoiceToLedger", toolArgs, total);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "invoice_to_ledger", invoiceNumber, clientName, amount: formatCurrency(total) },
            };
          }

          const accounts = await accountRepository.findAll(user.id, { isHeader: false });
          const ar = accounts.find(a => a.code === "1200" || a.name.toLowerCase().includes("accounts receivable"));
          const revenue = accounts.find(a =>
            a.code === "4100" || a.code === "4000" ||
            (a.accountType === "revenue" && a.name.toLowerCase().includes("sales"))
          );

          if (!ar || !revenue) {
            const errorResult = { error: "Could not find AR or Sales Revenue accounts in Chart of Accounts." };
            await logToolAudit(user.id, session?.id, "postInvoiceToLedger", toolArgs, errorResult, false, total);
            return errorResult;
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate: entryDate || invoiceDate,
            description: `Invoice ${invoiceNumber} - ${clientName}`,
            reference: invoiceNumber,
            sourceType: "invoice",
            sourceId: invoiceId,
            lines: [
              { accountId: ar.id, debitAmount: String(total), description: `AR - ${clientName}` },
              { accountId: revenue.id, creditAmount: String(total), description: `Sales - ${invoiceNumber}` },
            ],
          });

          await journalEntryRepository.post(entry.id, user.id);

          const result = {
            success: true,
            message: `Invoice ${invoiceNumber} posted to ledger`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              invoiceNumber,
              clientName,
              amount: formatCurrency(total),
              debitAccount: `${ar.code} - ${ar.name}`,
              creditAccount: `${revenue.code} - ${revenue.name}`,
              status: "posted",
            },
          };

          await logToolAudit(user.id, session?.id, "postInvoiceToLedger", toolArgs, result.entry, true, total);

          return result;
        } catch (error) {
          logger.error({ error }, "postInvoiceToLedger failed");
          const errorResult = { error: "Failed to post invoice to ledger", details: String(error) };
          await logToolAudit(user.id, session?.id, "postInvoiceToLedger", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    // ==========================================
    // DOCUMENT PROCESSING TOOLS (Cabinet System)
    // ==========================================

    processDocuments: tool({
      description: `Process documents from the vault with AI extraction (Reducto). Extracts vendor info, amounts, line items, dates.
Use when user wants to "process documents", "extract from documents", "read these invoices/bills".
After processing, ALWAYS ask user what to do: create entries, show summary, or go through each.`,
      inputSchema: z.object({
        documentIds: z.array(z.string().uuid()).min(1).max(20).describe("Document IDs from vault to process"),
      }),
      execute: async ({ documentIds }) => {
        try {
          const results = [];
          const errors = [];

          // Process documents (sync for 1-5, could be batched for more)
          for (const documentId of documentIds) {
            try {
              const result = await documentProcessorService.processDocument(documentId, user.id);

              if (result.status === "completed" && result.extractedData) {
                const data = result.extractedData;
                results.push({
                  documentId,
                  status: "success",
                  documentType: result.documentType,
                  vendor: "vendor" in data ? data.vendor?.name : undefined,
                  total: "total" in data ? data.total : undefined,
                  currency: "currency" in data ? data.currency : "MYR",
                  date: "invoiceDate" in data ? data.invoiceDate : ("date" in data ? data.date : undefined),
                  invoiceNumber: "invoiceNumber" in data ? data.invoiceNumber : undefined,
                  lineItemCount: "lineItems" in data ? data.lineItems?.length ?? 0 : 0,
                  matchedVendor: result.matchedVendor?.name,
                  confidence: result.confidenceScore,
                });
              } else {
                errors.push({ documentId, error: result.error ?? "Processing failed" });
              }
            } catch (error) {
              errors.push({ documentId, error: error instanceof Error ? error.message : "Unknown error" });
            }
          }

          const totalAmount = results.reduce((sum, r) => sum + (r.total ?? 0), 0);

          return {
            processed: results.length,
            failed: errors.length,
            totalAmount: formatCurrency(totalAmount),
            results,
            errors: errors.length > 0 ? errors : undefined,
            nextStep: results.length > 0
              ? "Documents processed. Would you like me to: a) Create bills/entries for all, b) Show a detailed summary first, c) Go through each one individually?"
              : undefined,
          };
        } catch (error) {
          logger.error({ error }, "processDocuments failed");
          return { error: "Failed to process documents", details: String(error) };
        }
      },
    }),

    getDocumentDetails: tool({
      description: `Get full extracted data from a processed document. Shows all line items, vendor details, totals.
Use when user wants to see "details of document", "what's in this invoice", or "show extracted data".`,
      inputSchema: z.object({
        documentId: z.string().uuid().describe("Document ID to get details for"),
      }),
      execute: async ({ documentId }) => {
        try {
          const result = await documentProcessorService.getLatestProcessingResult(documentId, user.id);

          if (!result) {
            return { error: "Document not found or not yet processed" };
          }

          if (result.status === "failed") {
            return {
              error: "Document processing failed",
              details: result.error,
              suggestion: "You can try reprocessing the document.",
            };
          }

          const data = result.extractedData;

          return {
            documentId,
            documentType: result.documentType,
            status: result.status,
            confidence: result.confidenceScore,
            extractedData: {
              vendor: "vendor" in (data ?? {}) ? (data as { vendor?: { name?: string; address?: string; taxId?: string; email?: string; phone?: string } }).vendor : undefined,
              invoiceNumber: "invoiceNumber" in (data ?? {}) ? (data as { invoiceNumber?: string }).invoiceNumber : undefined,
              date: "invoiceDate" in (data ?? {}) ? (data as { invoiceDate?: string }).invoiceDate : ("date" in (data ?? {}) ? (data as { date?: string }).date : undefined),
              dueDate: "dueDate" in (data ?? {}) ? (data as { dueDate?: string }).dueDate : undefined,
              currency: "currency" in (data ?? {}) ? (data as { currency?: string }).currency : "MYR",
              subtotal: "subtotal" in (data ?? {}) ? (data as { subtotal?: number }).subtotal : undefined,
              taxRate: "taxRate" in (data ?? {}) ? (data as { taxRate?: number }).taxRate : undefined,
              taxAmount: "taxAmount" in (data ?? {}) ? (data as { taxAmount?: number }).taxAmount : undefined,
              total: "total" in (data ?? {}) ? (data as { total?: number }).total : undefined,
              lineItems: "lineItems" in (data ?? {}) ? (data as { lineItems?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> }).lineItems : undefined,
              paymentTerms: "paymentTerms" in (data ?? {}) ? (data as { paymentTerms?: string }).paymentTerms : undefined,
            },
            matchedVendor: result.matchedVendor,
            suggestedVendorUpdates: result.suggestedVendorUpdates,
          };
        } catch (error) {
          logger.error({ error }, "getDocumentDetails failed");
          return { error: "Failed to get document details", details: String(error) };
        }
      },
    }),

    createEntriesFromDocument: tool({
      description: `Create accounting entries (bills, journal entries) from processed document data.
ALWAYS ask user first what they want to do with extracted data. Use after processDocuments or getDocumentDetails.`,
      inputSchema: z.object({
        documentId: z.string().uuid().describe("Processed document ID"),
        action: z.enum(["create_bill", "skip"]).describe("What to create: create_bill (creates bill from invoice/receipt data) or skip"),
        options: z.object({
          vendorId: z.string().uuid().optional().describe("Override matched vendor with specific vendor ID"),
          createVendorIfNotFound: z.boolean().default(true).describe("Create new vendor if no match found"),
        }).optional(),
      }),
      execute: async ({ documentId, action, options }) => {
        try {
          if (action === "skip") {
            return {
              success: true,
              message: "Document skipped. No entries created.",
              documentId,
            };
          }

          if (action === "create_bill") {
            const result = await documentProcessorService.createBillFromDocument(
              user.id,
              documentId,
              {
                vendorId: options?.vendorId,
                createVendorIfNotFound: options?.createVendorIfNotFound ?? true,
              }
            );

            return {
              success: true,
              message: `Bill created successfully`,
              billId: result.billId,
              vendorId: result.vendorId,
              vendorCreated: result.vendorCreated,
              total: formatCurrency(result.total, result.currency),
              currency: result.currency,
              nextStep: "Would you like me to explain the accounting implications?",
            };
          }

          return { error: "Invalid action" };
        } catch (error) {
          logger.error({ error }, "createEntriesFromDocument failed");
          return { error: "Failed to create entries", details: String(error) };
        }
      },
    }),

    queryDocumentCabinet: tool({
      description: `Search through processed documents in the document cabinet. Filter by vendor, date, type, status.
Use when user asks "what documents do we have", "find invoices from X", "show processed bills".`,
      inputSchema: z.object({
        filters: z.object({
          vendorName: z.string().optional().describe("Filter by vendor name (partial match)"),
          documentType: z.enum(["bill", "invoice", "receipt", "statement"]).optional().describe("Filter by document type"),
          category: z.enum(["bills", "invoices", "receipts", "statements", "contracts", "tax_documents", "other"]).optional().describe("Filter by vault category"),
          processingStatus: z.enum(["unprocessed", "processed", "failed"]).optional().describe("Filter by processing status"),
          dateFrom: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
          dateTo: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
        }).optional(),
        limit: z.number().max(50).default(20).describe("Maximum results to return"),
      }),
      execute: async ({ filters, limit }) => {
        try {
          // Build query conditions
          const conditions = [eq(vaultDocuments.userId, user.id)];

          if (filters?.category) {
            conditions.push(eq(vaultDocuments.category, filters.category));
          }
          if (filters?.processingStatus) {
            conditions.push(eq(vaultDocuments.processingStatus, filters.processingStatus));
          }
          if (filters?.dateFrom) {
            conditions.push(gte(vaultDocuments.createdAt, new Date(filters.dateFrom)));
          }
          if (filters?.dateTo) {
            conditions.push(lte(vaultDocuments.createdAt, new Date(filters.dateTo)));
          }

          // Query documents
          const documents = await db.query.vaultDocuments.findMany({
            where: and(...conditions),
            orderBy: [desc(vaultDocuments.createdAt)],
            limit,
          });

          // Get processing results for processed documents
          const results = await Promise.all(
            documents.map(async (doc) => {
              let extractedSummary = null;

              if (doc.processingStatus === "processed") {
                const job = await db.query.vaultProcessingJobs.findFirst({
                  where: and(
                    eq(vaultProcessingJobs.documentId, doc.id),
                    eq(vaultProcessingJobs.status, "completed")
                  ),
                  orderBy: [desc(vaultProcessingJobs.createdAt)],
                });

                if (job?.extractedData) {
                  try {
                    const data = JSON.parse(job.extractedData);
                    extractedSummary = {
                      vendor: data.vendor?.name,
                      total: data.total,
                      currency: data.currency ?? "MYR",
                      date: data.invoiceDate || data.date,
                      invoiceNumber: data.invoiceNumber,
                    };
                  } catch {
                    // Ignore parse error
                  }
                }
              }

              return {
                id: doc.id,
                name: doc.displayName || doc.name,
                category: doc.category,
                processingStatus: doc.processingStatus,
                createdAt: doc.createdAt.toISOString().split("T")[0],
                extracted: extractedSummary,
              };
            })
          );

          // Filter by vendor name if specified (post-query filter on extracted data)
          let filteredResults = results;
          if (filters?.vendorName) {
            const searchTerm = filters.vendorName.toLowerCase();
            filteredResults = results.filter(
              (r) => r.extracted?.vendor?.toLowerCase().includes(searchTerm)
            );
          }

          // Filter by document type if specified
          if (filters?.documentType) {
            // This would need extracted documentType, simplify for now based on category
            const categoryMap: Record<string, string> = {
              bill: "bills",
              invoice: "invoices",
              receipt: "receipts",
              statement: "statements",
            };
            const targetCategory = categoryMap[filters.documentType];
            if (targetCategory) {
              filteredResults = filteredResults.filter((r) => r.category === targetCategory);
            }
          }

          const totalValue = filteredResults.reduce(
            (sum, r) => sum + (r.extracted?.total ?? 0),
            0
          );

          return {
            count: filteredResults.length,
            totalValue: formatCurrency(totalValue),
            documents: filteredResults,
            summary: filteredResults.length > 0
              ? `Found ${filteredResults.length} documents with total value ${formatCurrency(totalValue)}`
              : "No documents found matching your criteria",
          };
        } catch (error) {
          logger.error({ error }, "queryDocumentCabinet failed");
          return { error: "Failed to query document cabinet", details: String(error) };
        }
      },
    }),

    listVaultDocuments: tool({
      description: `List all documents in the user's vault. Shows unprocessed and processed documents.
Use when user asks "show my documents", "what's in the vault", "list uploaded files".`,
      inputSchema: z.object({
        category: z.enum(["all", "bills", "invoices", "receipts", "statements", "contracts", "tax_documents", "other"]).default("all").describe("Filter by category"),
        limit: z.number().max(50).default(20).describe("Maximum results"),
      }),
      execute: async ({ category, limit }) => {
        try {
          const conditions = [eq(vaultDocuments.userId, user.id)];
          if (category !== "all") {
            conditions.push(eq(vaultDocuments.category, category));
          }

          const documents = await db.query.vaultDocuments.findMany({
            where: and(...conditions),
            orderBy: [desc(vaultDocuments.createdAt)],
            limit,
          });

          const summary = {
            total: documents.length,
            unprocessed: documents.filter((d) => d.processingStatus === "unprocessed").length,
            processed: documents.filter((d) => d.processingStatus === "processed").length,
            failed: documents.filter((d) => d.processingStatus === "failed").length,
          };

          return {
            summary,
            documents: documents.map((doc) => ({
              id: doc.id,
              name: doc.displayName || doc.name,
              category: doc.category,
              processingStatus: doc.processingStatus,
              size: `${Math.round(doc.size / 1024)}KB`,
              uploadedAt: doc.createdAt.toISOString().split("T")[0],
            })),
            hint: summary.unprocessed > 0
              ? `You have ${summary.unprocessed} unprocessed document(s). Would you like me to process them?`
              : undefined,
          };
        } catch (error) {
          logger.error({ error }, "listVaultDocuments failed");
          return { error: "Failed to list documents", details: String(error) };
        }
      },
    }),

    // ==========================================
    // MANUAL JOURNAL ENTRY - For Complex/Custom Entries
    // ==========================================

    createJournalEntry: tool({
      description: `Create a CUSTOM journal entry. Only use this for complex entries not covered by smart tools above.
For common transactions, prefer: recordSalesRevenue, recordExpense, recordPaymentReceived, recordPaymentMade, postInvoiceToLedger.`,
      inputSchema: z.object({
        entryDate: z.string().describe("Date (YYYY-MM-DD)"),
        description: z.string().describe("Entry description"),
        reference: z.string().optional().describe("Reference number"),
        lines: z.array(z.object({
          accountId: z.string().describe("Account ID from listAccounts"),
          debitAmount: z.number().optional().describe("Debit amount"),
          creditAmount: z.number().optional().describe("Credit amount"),
          description: z.string().optional().describe("Line description"),
        })).min(2).describe("Entry lines - must use different accounts for debit/credit"),
      }),
      execute: async ({ entryDate, description, reference, lines }) => {
        const toolArgs = { entryDate, description, reference, lines };

        try {
          let totalDebit = 0;
          let totalCredit = 0;

          for (const line of lines) {
            totalDebit += line.debitAmount ?? 0;
            totalCredit += line.creditAmount ?? 0;
          }

          // Check approval before executing (use total debit as estimated amount)
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs, totalDebit);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "journal_entry", description, totalDebit: formatCurrency(totalDebit), lines: lines.length },
            };
          }

          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return {
              error: `Debits (${formatCurrency(totalDebit)}) must equal credits (${formatCurrency(totalCredit)})`,
            };
          }

          const uniqueAccountIds = new Set(lines.map(l => l.accountId));
          if (uniqueAccountIds.size < 2) {
            return {
              error: "Must use at least 2 different accounts. Use smart tools instead: recordSalesRevenue, recordExpense, etc.",
            };
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description,
            reference: reference ?? undefined,
            sourceType: "manual",
            lines: lines.map(line => ({
              accountId: line.accountId,
              debitAmount: line.debitAmount ? String(line.debitAmount) : undefined,
              creditAmount: line.creditAmount ? String(line.creditAmount) : undefined,
              description: line.description,
            })),
          });

          const result = {
            success: true,
            message: `Journal entry ${entry.entryNumber} created (draft - use postJournalEntry to post)`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              totalDebit: formatCurrency(totalDebit),
              totalCredit: formatCurrency(totalCredit),
              status: entry.status,
            },
          };

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, result.entry, true, totalDebit);

          return result;
        } catch (error) {
          logger.error({ error }, "createJournalEntry failed");
          const errorResult = { error: "Failed to create journal entry", details: String(error) };
          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    postJournalEntry: tool({
      description: "Post a draft journal entry to the ledger. This makes it permanent and updates account balances.",
      inputSchema: z.object({
        entryId: z.string().describe("The journal entry ID to post"),
      }),
      execute: async ({ entryId }) => {
        const toolArgs = { entryId };

        try {
          const entry = await journalEntryRepository.findById(entryId, user.id);
          if (!entry) {
            return { error: "Journal entry not found" };
          }

          // Calculate estimated amount from entry lines
          const estimatedAmount = entry.lines?.reduce((sum, line) => sum + Number(line.debitAmount ?? 0), 0) ?? 0;

          // Check approval before executing
          const approvalCheck = await checkToolApproval(user.id, session?.id, "postJournalEntry", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "journal_entry_post", entryNumber: entry.entryNumber, amount: formatCurrency(estimatedAmount) },
            };
          }

          if (entry.status === "posted") {
            return { error: "Journal entry is already posted" };
          }

          if (entry.status === "reversed") {
            return { error: "Cannot post a reversed journal entry" };
          }

          await journalEntryRepository.post(entryId, user.id);

          const result = {
            success: true,
            message: `Journal entry ${entry.entryNumber} has been posted to the ledger`,
            entry: {
              id: entryId,
              entryNumber: entry.entryNumber,
              status: "posted",
              postedAt: new Date().toLocaleDateString(),
            },
          };

          await logToolAudit(user.id, session?.id, "postJournalEntry", toolArgs, result.entry, true, estimatedAmount);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to post journal entry", details: String(error) };
          await logToolAudit(user.id, session?.id, "postJournalEntry", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    reverseJournalEntry: tool({
      description: "Reverse a posted journal entry. This creates a new entry with opposite debits/credits.",
      inputSchema: z.object({
        entryId: z.string().describe("The journal entry ID to reverse"),
        reason: z.string().describe("Reason for reversal"),
      }),
      execute: async ({ entryId, reason }) => {
        const toolArgs = { entryId, reason };

        try {
          const entry = await journalEntryRepository.findById(entryId, user.id);
          if (!entry) {
            return { error: "Journal entry not found" };
          }

          // Calculate estimated amount from entry lines
          const estimatedAmount = entry.lines?.reduce((sum, line) => sum + Number(line.debitAmount ?? 0), 0) ?? 0;

          // Check approval before executing (reversals always require approval when enabled)
          const approvalCheck = await checkToolApproval(user.id, session?.id, "reverseJournalEntry", toolArgs, estimatedAmount);
          if (approvalCheck?.requiresApproval) {
            return {
              pending: true,
              approvalId: approvalCheck.approvalId,
              message: approvalCheck.message,
              preview: { type: "journal_entry_reversal", entryNumber: entry.entryNumber, reason, amount: formatCurrency(estimatedAmount) },
            };
          }

          if (entry.status !== "posted") {
            return { error: "Only posted journal entries can be reversed" };
          }

          const reversal = await journalEntryRepository.reverse(entryId, user.id, reason);

          const result = {
            success: true,
            message: `Journal entry ${entry.entryNumber} has been reversed`,
            originalEntry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              newStatus: "reversed",
            },
            reversalEntry: {
              id: reversal.id,
              entryNumber: reversal.entryNumber,
              description: reversal.description,
            },
          };

          await logToolAudit(user.id, session?.id, "reverseJournalEntry", toolArgs, result, true, estimatedAmount);

          return result;
        } catch (error) {
          const errorResult = { error: "Failed to reverse journal entry", details: String(error) };
          await logToolAudit(user.id, session?.id, "reverseJournalEntry", toolArgs, errorResult, false);
          return errorResult;
        }
      },
    }),

    // ==========================================
    // MEMORY & LEARNING TOOLS
    // ==========================================

    rememberPreference: tool({
      description: "Store a user preference or instruction that should be remembered for future interactions. Use this when the user expresses a preference, gives instructions, or provides information that should persist.",
      inputSchema: z.object({
        key: z.string().describe("A short descriptive key for the memory (e.g., 'invoice_prefix', 'preferred_currency')"),
        value: z.string().describe("The value or content to remember"),
        category: z.enum(["preference", "fact", "instruction"]).describe("Type of memory: preference (user likes/dislikes), fact (business info), instruction (how to do things)"),
      }),
      execute: async ({ key, value, category }) => {
        try {
          const memory = await agentMemoryService.storeMemory(user.id, {
            category,
            key,
            value,
            sourceType: "conversation",
            sourceSessionId: session?.id,
            confidence: 0.9,
          });

          return {
            success: true,
            message: `I'll remember that: "${key}" = "${value}"`,
            memoryId: memory?.id,
          };
        } catch (error) {
          return { error: "Failed to store memory", details: String(error) };
        }
      },
    }),

    recallMemories: tool({
      description: "Search and recall stored memories about user preferences, facts, or instructions using semantic similarity. Use this to find relevant context before taking actions - even if the exact words don't match, this will find conceptually related memories.",
      inputSchema: z.object({
        query: z.string().describe("Natural language query to find relevant memories (uses semantic search)"),
      }),
      execute: async ({ query }) => {
        try {
          // Use semantic search for better memory recall
          const memories = await agentMemoryService.searchMemoriesSemantic(user.id, query, {
            threshold: 0.6,  // Lower threshold for broader recall
            limit: 5,
          });

          if (memories.length === 0) {
            return { message: "No relevant memories found", memories: [] };
          }

          return {
            message: `Found ${memories.length} relevant memories`,
            memories: memories.map((m) => ({
              category: m.category,
              key: m.key,
              value: m.value,
              similarity: m.similarity,
            })),
          };
        } catch (error) {
          return { error: "Failed to recall memories", details: String(error) };
        }
      },
    }),

    updateUserContext: tool({
      description: "Update business context like company name, default currency, invoice prefix. Use when user provides business configuration info.",
      inputSchema: z.object({
        companyName: z.string().optional().describe("Company/business name"),
        defaultCurrency: z.string().optional().describe("Default currency code (e.g., MYR, USD)"),
        invoicePrefix: z.string().optional().describe("Default invoice number prefix"),
        quotationPrefix: z.string().optional().describe("Default quotation number prefix"),
        fiscalYearEnd: z.string().optional().describe("Fiscal year end date (MM-DD format)"),
        industry: z.string().optional().describe("Business industry"),
      }),
      execute: async (updates) => {
        try {
          const filtered = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
          );

          if (Object.keys(filtered).length === 0) {
            return { error: "No updates provided" };
          }

          await agentMemoryService.upsertUserContext(user.id, filtered);

          return {
            success: true,
            message: "Business context updated successfully",
            updated: filtered,
          };
        } catch (error) {
          return { error: "Failed to update context", details: String(error) };
        }
      },
    }),

    // ==========================================
    // PLANNING & REASONING TOOLS
    // ==========================================

    thinkStep: tool({
      description: "Use this tool to think through complex problems step by step. Call this BEFORE taking any action to plan your approach. IMPORTANT: After calling this tool, you MUST continue to execute the planned steps - do not stop here.",
      inputSchema: z.object({
        thought: z.string().describe("Your reasoning about the current situation"),
        plan: z.array(z.string()).describe("List of steps you plan to take"),
        uncertainties: z.array(z.string()).optional().describe("Things you're unsure about that might need clarification"),
      }),
      execute: async ({ thought, plan, uncertainties }) => {
        // This is a planning tool - it's used for the AI to externalize its reasoning
        // The AI MUST continue to execute the plan after this tool returns
        return {
          status: "planning_complete",
          message: "Planning complete. NOW EXECUTE the first step in your plan by calling the appropriate tool. Do NOT stop here - continue with the actual data retrieval or action.",
          reasoning: thought,
          plannedSteps: plan,
          uncertainties: uncertainties ?? [],
          nextAction: plan[0] ?? "No action planned",
          instruction: "IMPORTANT: Call the next tool now to execute your plan. Do not respond to the user until you have actual data.",
        };
      },
    }),

    validateAction: tool({
      description: "Validate an action before executing it. Use this before write operations to double-check the action is correct.",
      inputSchema: z.object({
        action: z.string().describe("The action you're about to take"),
        target: z.string().describe("What you're acting on (e.g., invoice ID, customer name)"),
        expectedOutcome: z.string().describe("What you expect to happen"),
        risks: z.array(z.string()).optional().describe("Potential risks or issues"),
      }),
      execute: async ({ action, target, expectedOutcome, risks }) => {
        return {
          validated: true,
          action,
          target,
          expectedOutcome,
          risks: risks ?? [],
          proceed: true,
        };
      },
    }),

    // ============================================
    // MIGRATION & SETUP TOOLS
    // ============================================

    getMigrationStatus: tool({
      description: "Get the current migration/setup wizard status. Use this to understand where the user is in the migration process.",
      inputSchema: z.object({}),
      execute: async () => {
        const sessions = await migrationSessionRepository.findByUser(user.id);
        const activeSession = sessions.find(s => s.status !== "completed" && s.status !== "failed");

        if (!activeSession) {
          return {
            hasActiveSession: false,
            message: "No active migration session. User can start the setup wizard at /setup to begin.",
            completedSessions: sessions.filter(s => s.status === "completed").length,
          };
        }

        return {
          hasActiveSession: true,
          sessionId: activeSession.id,
          status: activeSession.status,
          currentStep: activeSession.currentStep,
          completedSteps: activeSession.completedSteps,
          sourceSystem: activeSession.sourceSystem,
          conversionDate: activeSession.conversionDate,
          isBalanced: activeSession.isBalanced,
          totalDebits: activeSession.totalDebits,
          totalCredits: activeSession.totalCredits,
        };
      },
    }),

    getOpeningBalances: tool({
      description: "Get the opening balances for a migration session. Shows the trial balance entries.",
      inputSchema: z.object({
        sessionId: z.string().uuid().describe("The migration session ID"),
      }),
      execute: async ({ sessionId }) => {
        const balances = await openingBalanceRepository.findBySession(sessionId, user.id);
        const totals = await openingBalanceRepository.calculateTotals(sessionId, user.id);
        const validation = await openingBalanceRepository.getValidationSummary(sessionId, user.id);

        const totalDebits = parseFloat(totals.totalDebits);
        const totalCredits = parseFloat(totals.totalCredits);
        const difference = Math.abs(totalDebits - totalCredits);
        const isBalanced = difference < 0.01;

        const entriesWithAccounts = balances.filter(b => !!b.accountId).length;
        const entriesWithoutAccounts = balances.length - entriesWithAccounts;

        return {
          entries: balances.slice(0, 20).map(b => ({
            accountCode: b.accountCode,
            accountName: b.accountName,
            accountType: b.accountType,
            debit: b.debitAmount,
            credit: b.creditAmount,
            isMapped: !!b.accountId,
          })),
          totalEntries: balances.length,
          summary: {
            totalDebits: totals.totalDebits,
            totalCredits: totals.totalCredits,
            isBalanced,
            difference: difference.toFixed(2),
            entriesWithAccounts,
            entriesWithoutAccounts,
            validationStatus: validation,
          },
        };
      },
    }),

    suggestAccountMapping: tool({
      description: "Suggest which chart of accounts entry an imported account should map to. Use this to help users with account mapping.",
      inputSchema: z.object({
        accountCode: z.string().describe("The imported account code"),
        accountName: z.string().describe("The imported account name"),
        accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]).describe("The account type"),
      }),
      execute: async ({ accountCode, accountName, accountType }) => {
        // Get existing accounts of the same type
        const existingAccounts = await accountRepository.findAll(user.id);
        const matchingAccounts = existingAccounts.filter(a =>
          a.accountType?.toLowerCase() === accountType.toLowerCase()
        );

        // Simple fuzzy matching based on name similarity
        const suggestions = matchingAccounts
          .map(account => {
            const nameLower = accountName.toLowerCase();
            const existingLower = account.name.toLowerCase();

            // Calculate simple similarity score
            let score = 0;
            if (existingLower.includes(nameLower) || nameLower.includes(existingLower)) {
              score = 80;
            } else {
              // Check for common words
              const importedWords = nameLower.split(/\s+/);
              const existingWords = existingLower.split(/\s+/);
              const commonWords = importedWords.filter((w: string) => existingWords.some((ew: string) => ew.includes(w) || w.includes(ew)));
              score = (commonWords.length / Math.max(importedWords.length, 1)) * 60;
            }

            // Boost if account codes are similar
            if (account.code.startsWith(accountCode.slice(0, 2))) {
              score += 15;
            }

            return {
              accountId: account.id,
              accountCode: account.code,
              accountName: account.name,
              confidence: Math.min(Math.round(score), 100),
            };
          })
          .filter(s => s.confidence > 20)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);

        return {
          importedAccount: { code: accountCode, name: accountName, type: accountType },
          suggestions,
          recommendation: suggestions[0] ? {
            action: suggestions[0].confidence >= 70 ? "auto_map" : "review",
            suggestedAccount: suggestions[0],
            reason: suggestions[0].confidence >= 70
              ? `High confidence match: "${suggestions[0].accountName}"`
              : "Manual review recommended - no high confidence match found",
          } : {
            action: "create_new",
            reason: "No matching account found. Consider creating a new account.",
          },
        };
      },
    }),

    validateMigrationData: tool({
      description: "Validate migration data and identify issues that need to be fixed before applying.",
      inputSchema: z.object({
        sessionId: z.string().uuid().describe("The migration session ID"),
      }),
      execute: async ({ sessionId }) => {
        const session = await migrationSessionRepository.findById(sessionId, user.id);
        if (!session) {
          return { error: "Session not found" };
        }

        const balances = await openingBalanceRepository.findBySession(sessionId, user.id);
        const totals = await openingBalanceRepository.calculateTotals(sessionId, user.id);

        const totalDebits = parseFloat(totals.totalDebits);
        const totalCredits = parseFloat(totals.totalCredits);
        const difference = Math.abs(totalDebits - totalCredits);
        const isBalanced = difference < 0.01;

        const entriesWithAccounts = balances.filter(b => !!b.accountId).length;
        const entriesWithoutAccounts = balances.length - entriesWithAccounts;

        const issues: Array<{ severity: "error" | "warning" | "info"; message: string; fix?: string }> = [];

        // Check trial balance
        if (!isBalanced) {
          issues.push({
            severity: "error",
            message: `Trial balance is not balanced. Difference: ${formatCurrency(difference)}`,
            fix: "Review and adjust debit/credit amounts until they balance.",
          });
        }

        // Check unmapped accounts
        if (entriesWithoutAccounts > 0) {
          issues.push({
            severity: "warning",
            message: `${entriesWithoutAccounts} accounts are not mapped to chart of accounts.`,
            fix: "Map each imported account to an existing or new chart of accounts entry.",
          });
        }

        // Check for zero balances
        const zeroBalances = balances.filter(b =>
          parseFloat(b.debitAmount) === 0 && parseFloat(b.creditAmount) === 0
        );
        if (zeroBalances.length > 0) {
          issues.push({
            severity: "info",
            message: `${zeroBalances.length} accounts have zero balances. These can be removed if not needed.`,
          });
        }

        // Check conversion date
        if (!session.conversionDate) {
          issues.push({
            severity: "error",
            message: "Conversion date is not set.",
            fix: "Set the conversion date in the Dates step of the wizard.",
          });
        }

        return {
          sessionId,
          status: session.status,
          isReady: issues.filter(i => i.severity === "error").length === 0,
          issues,
          summary: {
            totalAccounts: balances.length,
            mappedAccounts: entriesWithAccounts,
            totalDebits: totals.totalDebits,
            totalCredits: totals.totalCredits,
            isBalanced,
          },
        };
      },
    }),

    explainMigrationConcept: tool({
      description: "Explain migration and accounting concepts to help users understand the setup process.",
      inputSchema: z.object({
        concept: z.enum([
          "opening_balance",
          "trial_balance",
          "conversion_date",
          "account_mapping",
          "subledger",
          "payroll_ytd",
          "double_entry",
          "chart_of_accounts",
        ]).describe("The concept to explain"),
      }),
      execute: async ({ concept }) => {
        const explanations: Record<string, { title: string; explanation: string; example?: string }> = {
          opening_balance: {
            title: "Opening Balance",
            explanation: "Opening balances are the account balances at the start of using a new accounting system. They represent the cumulative effect of all past transactions and ensure continuity from your previous system.",
            example: "If your bank account had RM 50,000 at the conversion date, that's your opening balance for the bank account.",
          },
          trial_balance: {
            title: "Trial Balance",
            explanation: "A trial balance is a list of all accounts with their debit and credit balances. The sum of all debits must equal the sum of all credits (double-entry bookkeeping principle). If they don't match, there's an error.",
            example: "Assets (debits) = RM 100,000, Liabilities + Equity (credits) = RM 100,000. Balanced!",
          },
          conversion_date: {
            title: "Conversion Date",
            explanation: "The conversion date is the cut-off date when you switch to the new accounting system. All transactions before this date are summarized as opening balances. New transactions after this date are recorded in the new system.",
            example: "If converting on Jan 1, 2024, all 2023 transactions are summarized as opening balances, and 2024 transactions start fresh.",
          },
          account_mapping: {
            title: "Account Mapping",
            explanation: "Account mapping links your imported accounts to the chart of accounts in the new system. This ensures data is correctly categorized and reports are accurate.",
            example: "Your old 'Office Supplies' account maps to '6210 - Office Expenses' in the new chart of accounts.",
          },
          subledger: {
            title: "Subledger Detail",
            explanation: "Subledgers provide detailed breakdown of control accounts. Accounts Receivable subledger shows individual customer balances, and Accounts Payable shows vendor balances.",
            example: "AR Control: RM 50,000 = Customer A: RM 20,000 + Customer B: RM 30,000",
          },
          payroll_ytd: {
            title: "Payroll Year-to-Date (YTD)",
            explanation: "When migrating mid-year, you need to enter YTD payroll figures for accurate statutory calculations. This includes gross salary, EPF, SOCSO, EIS, and PCB already paid.",
            example: "If an employee earned RM 30,000 Jan-Jun, their PCB calculation for Jul onwards needs to know this YTD amount.",
          },
          double_entry: {
            title: "Double-Entry Bookkeeping",
            explanation: "Every transaction affects at least two accounts - a debit and a credit of equal amounts. Assets and expenses increase with debits; liabilities, equity, and revenue increase with credits.",
            example: "Buying supplies (RM 100): Debit 'Office Supplies' RM 100, Credit 'Cash' RM 100.",
          },
          chart_of_accounts: {
            title: "Chart of Accounts",
            explanation: "The chart of accounts is a categorized list of all accounts used to record transactions. It's organized by type: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), Expenses (5-6xxx).",
            example: "1010 - Cash, 2010 - Accounts Payable, 4010 - Sales Revenue, 6010 - Salaries Expense",
          },
        };

        return explanations[concept] ?? { title: "Unknown Concept", explanation: "I don't have information about this concept." };
      },
    }),

    getMigrationHelp: tool({
      description: "Get contextual help for the migration wizard. Use this when users ask for help or are stuck.",
      inputSchema: z.object({
        currentStep: z.string().optional().describe("The current wizard step the user is on"),
        issue: z.string().optional().describe("Specific issue the user is facing"),
      }),
      execute: async ({ currentStep, issue }) => {
        const stepGuides: Record<string, { title: string; instructions: string[]; tips: string[] }> = {
          welcome: {
            title: "Welcome - Choose Source System",
            instructions: [
              "Select the accounting software you're migrating from",
              "Choose 'Other / Manual' if your system isn't listed or you're starting fresh",
              "This helps us provide relevant import templates and guidance",
            ],
            tips: [
              "Have your previous system's trial balance report ready",
              "Export customer and vendor lists if you want to import them",
            ],
          },
          date: {
            title: "Set Key Dates",
            instructions: [
              "Conversion Date: When you're switching to the new system (usually month/year end)",
              "Financial Year Start: First day of your financial year",
            ],
            tips: [
              "Use month-end dates for cleaner cut-offs",
              "Malaysian tax year runs Jan-Dec, but fiscal year can be different",
            ],
          },
          balances: {
            title: "Opening Balances (Trial Balance)",
            instructions: [
              "Import your trial balance CSV or add entries manually",
              "Each account needs a debit OR credit amount (not both)",
              "Total debits must equal total credits",
              "Map each imported account to your chart of accounts",
            ],
            tips: [
              "Start with your main bank accounts and work outward",
              "Use the 'Import CSV' button to bulk import",
              "The system will suggest account mappings automatically",
            ],
          },
          subledger: {
            title: "Subledger Detail (Optional)",
            instructions: [
              "Add individual customer balances if Accounts Receivable has a balance",
              "Add individual vendor balances if Accounts Payable has a balance",
              "Subledger totals should match the control account balances",
            ],
            tips: [
              "Skip this step if AR/AP are zero or you want to start fresh",
              "You can add this detail later if needed",
            ],
          },
          payroll: {
            title: "Payroll Year-to-Date (Optional)",
            instructions: [
              "Only needed if migrating mid-year",
              "Enter YTD gross salary, EPF, SOCSO, EIS, and PCB for each employee",
              "This ensures accurate statutory calculations going forward",
            ],
            tips: [
              "Skip if starting at the beginning of the year",
              "Get these figures from your previous payroll system or payslips",
            ],
          },
          review: {
            title: "Review & Apply",
            instructions: [
              "Click 'Validate' to check for errors",
              "Fix any errors before applying",
              "Click 'Apply Migration' to create opening journal entries",
            ],
            tips: [
              "Green checkmarks mean validation passed",
              "Yellow warnings are advisory - you can proceed",
              "Red errors must be fixed before applying",
            ],
          },
        };

        const guide = currentStep ? stepGuides[currentStep] : null;

        return {
          currentStep,
          guide,
          commonIssues: [
            { issue: "Trial balance doesn't balance", solution: "Check that you haven't mixed up debits and credits. Assets, expenses = debit. Liabilities, equity, revenue = credit." },
            { issue: "Can't find account to map to", solution: "Create a new account in Chart of Accounts, or map to the closest existing account." },
            { issue: "Import CSV not working", solution: "Ensure your CSV has headers matching our template. Download the template first." },
          ],
          specificHelp: issue ? `For "${issue}", please provide more details about what you're trying to do.` : null,
        };
      },
    }),

    // ============================================
    // CREDIT NOTE OPERATIONS
    // ============================================

    listCreditNotes: tool({
      description: "List credit notes with optional filters. Credit notes are used to reduce amounts owed by customers (e.g., for returns, discounts, pricing errors).",
      inputSchema: z.object({
        limit: z.number().max(50).optional().describe("Number of credit notes to return (default 20, max 50)"),
        status: z.enum(["draft", "issued", "applied", "cancelled"]).optional().describe("Filter by status"),
      }),
      execute: async ({ limit = 20, status }) => {
        return withToolTimeout("listCreditNotes", async () => {
          try {
            const userCreditNotes = await db.query.creditNotes.findMany({
              where: status
                ? and(eq(creditNotes.userId, user.id), eq(creditNotes.status, status))
                : eq(creditNotes.userId, user.id),
              with: {
                customer: true,
                creditNoteFields: {
                  with: {
                    creditNoteDetails: true,
                    items: true,
                  },
                },
              },
              limit,
              orderBy: (creditNotes, { desc }) => [desc(creditNotes.createdAt)],
            });

            return {
              creditNotes: userCreditNotes.map((cn) => {
                const details = cn.creditNoteFields?.creditNoteDetails;
                const items = cn.creditNoteFields?.items ?? [];
                const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
                const currency = details?.currency ?? "MYR";
                return {
                  id: cn.id,
                  serialNumber: `${details?.prefix ?? "CN-"}${details?.serialNumber ?? ""}`,
                  customerName: cn.customer?.name ?? "Unknown",
                  amount: formatCurrency(total, currency),
                  amountRaw: total,
                  status: cn.status,
                  reason: cn.reason,
                  originalInvoiceNumber: details?.originalInvoiceNumber ?? null,
                  date: details?.date ? new Date(details.date).toLocaleDateString() : null,
                  createdAt: new Date(cn.createdAt).toLocaleDateString(),
                };
              }),
              total: userCreditNotes.length,
            };
          } catch (error) {
            logger.error({ error }, "listCreditNotes failed");
            return { error: "Failed to fetch credit notes" };
          }
        });
      },
    }),

    getCreditNoteDetails: tool({
      description: "Get detailed information about a specific credit note by ID.",
      inputSchema: z.object({
        creditNoteId: z.string().describe("The credit note ID to look up"),
      }),
      execute: async ({ creditNoteId }) => {
        try {
          const creditNote = await db.query.creditNotes.findFirst({
            where: and(eq(creditNotes.id, creditNoteId), eq(creditNotes.userId, user.id)),
            with: {
              customer: true,
              invoice: true,
              creditNoteFields: {
                with: {
                  companyDetails: true,
                  clientDetails: true,
                  creditNoteDetails: { with: { billingDetails: true } },
                  items: true,
                  metadata: true,
                },
              },
            },
          });

          if (!creditNote) {
            return { error: "Credit note not found" };
          }

          const fields = creditNote.creditNoteFields;
          const details = fields?.creditNoteDetails;
          const items = fields?.items ?? [];
          const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
          const currency = details?.currency ?? "MYR";

          return {
            id: creditNote.id,
            serialNumber: `${details?.prefix ?? "CN-"}${details?.serialNumber ?? ""}`,
            status: creditNote.status,
            reason: creditNote.reason,
            reasonDescription: creditNote.reasonDescription,
            customerName: creditNote.customer?.name ?? fields?.clientDetails?.name ?? "Unknown",
            customerAddress: fields?.clientDetails?.address ?? "",
            companyName: fields?.companyDetails?.name ?? "",
            originalInvoiceNumber: details?.originalInvoiceNumber ?? null,
            date: details?.date ? new Date(details.date).toLocaleDateString() : null,
            items: items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: formatCurrency(Number(item.unitPrice), currency),
              total: formatCurrency(Number(item.quantity) * Number(item.unitPrice), currency),
            })),
            subtotal: formatCurrency(total, currency),
            total: formatCurrency(total, currency),
            currency,
            notes: fields?.metadata?.notes ?? "",
            terms: fields?.metadata?.terms ?? "",
            issuedAt: creditNote.issuedAt ? new Date(creditNote.issuedAt).toLocaleDateString() : null,
            createdAt: new Date(creditNote.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getCreditNoteDetails failed");
          return { error: "Failed to fetch credit note details" };
        }
      },
    }),

    // ============================================
    // DEBIT NOTE OPERATIONS
    // ============================================

    listDebitNotes: tool({
      description: "List debit notes with optional filters. Debit notes are used to increase amounts owed by customers (e.g., for undercharges, additional services).",
      inputSchema: z.object({
        limit: z.number().max(50).optional().describe("Number of debit notes to return (default 20, max 50)"),
        status: z.enum(["draft", "issued", "applied", "cancelled"]).optional().describe("Filter by status"),
      }),
      execute: async ({ limit = 20, status }) => {
        return withToolTimeout("listDebitNotes", async () => {
          try {
            const userDebitNotes = await db.query.debitNotes.findMany({
              where: status
                ? and(eq(debitNotes.userId, user.id), eq(debitNotes.status, status))
                : eq(debitNotes.userId, user.id),
              with: {
                customer: true,
                debitNoteFields: {
                  with: {
                    debitNoteDetails: true,
                    items: true,
                  },
                },
              },
              limit,
              orderBy: (debitNotes, { desc }) => [desc(debitNotes.createdAt)],
            });

            return {
              debitNotes: userDebitNotes.map((dn) => {
                const details = dn.debitNoteFields?.debitNoteDetails;
                const items = dn.debitNoteFields?.items ?? [];
                const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
                const currency = details?.currency ?? "MYR";
                return {
                  id: dn.id,
                  serialNumber: `${details?.prefix ?? "DN-"}${details?.serialNumber ?? ""}`,
                  customerName: dn.customer?.name ?? "Unknown",
                  amount: formatCurrency(total, currency),
                  amountRaw: total,
                  status: dn.status,
                  reason: dn.reason,
                  originalInvoiceNumber: details?.originalInvoiceNumber ?? null,
                  date: details?.date ? new Date(details.date).toLocaleDateString() : null,
                  createdAt: new Date(dn.createdAt).toLocaleDateString(),
                };
              }),
              total: userDebitNotes.length,
            };
          } catch (error) {
            logger.error({ error }, "listDebitNotes failed");
            return { error: "Failed to fetch debit notes" };
          }
        });
      },
    }),

    getDebitNoteDetails: tool({
      description: "Get detailed information about a specific debit note by ID.",
      inputSchema: z.object({
        debitNoteId: z.string().describe("The debit note ID to look up"),
      }),
      execute: async ({ debitNoteId }) => {
        try {
          const debitNote = await db.query.debitNotes.findFirst({
            where: and(eq(debitNotes.id, debitNoteId), eq(debitNotes.userId, user.id)),
            with: {
              customer: true,
              invoice: true,
              debitNoteFields: {
                with: {
                  companyDetails: true,
                  clientDetails: true,
                  debitNoteDetails: { with: { billingDetails: true } },
                  items: true,
                  metadata: true,
                },
              },
            },
          });

          if (!debitNote) {
            return { error: "Debit note not found" };
          }

          const fields = debitNote.debitNoteFields;
          const details = fields?.debitNoteDetails;
          const items = fields?.items ?? [];
          const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
          const currency = details?.currency ?? "MYR";

          return {
            id: debitNote.id,
            serialNumber: `${details?.prefix ?? "DN-"}${details?.serialNumber ?? ""}`,
            status: debitNote.status,
            reason: debitNote.reason,
            reasonDescription: debitNote.reasonDescription,
            customerName: debitNote.customer?.name ?? fields?.clientDetails?.name ?? "Unknown",
            customerAddress: fields?.clientDetails?.address ?? "",
            companyName: fields?.companyDetails?.name ?? "",
            originalInvoiceNumber: details?.originalInvoiceNumber ?? null,
            date: details?.date ? new Date(details.date).toLocaleDateString() : null,
            items: items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: formatCurrency(Number(item.unitPrice), currency),
              total: formatCurrency(Number(item.quantity) * Number(item.unitPrice), currency),
            })),
            subtotal: formatCurrency(total, currency),
            total: formatCurrency(total, currency),
            currency,
            notes: fields?.metadata?.notes ?? "",
            terms: fields?.metadata?.terms ?? "",
            issuedAt: debitNote.issuedAt ? new Date(debitNote.issuedAt).toLocaleDateString() : null,
            createdAt: new Date(debitNote.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getDebitNoteDetails failed");
          return { error: "Failed to fetch debit note details" };
        }
      },
    }),

    // ============================================
    // QUOTATION DETAILS
    // ============================================

    getQuotationDetails: tool({
      description: "Get detailed information about a specific quotation by ID.",
      inputSchema: z.object({
        quotationId: z.string().describe("The quotation ID to look up"),
      }),
      execute: async ({ quotationId }) => {
        try {
          const quotation = await quotationRepository.findById(quotationId, user.id);
          if (!quotation) {
            return { error: "Quotation not found" };
          }

          const items = quotation.quotationFields?.items ?? [];
          const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
          const currency = quotation.quotationFields?.quotationDetails?.currency ?? "MYR";

          return {
            id: quotation.id,
            serialNumber: `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`,
            status: quotation.status,
            clientName: quotation.quotationFields?.clientDetails?.name ?? "Unknown",
            clientAddress: quotation.quotationFields?.clientDetails?.address ?? "",
            companyName: quotation.quotationFields?.companyDetails?.name ?? "",
            date: quotation.quotationFields?.quotationDetails?.date
              ? new Date(quotation.quotationFields.quotationDetails.date).toLocaleDateString()
              : "",
            validUntil: quotation.quotationFields?.quotationDetails?.validUntil
              ? new Date(quotation.quotationFields.quotationDetails.validUntil).toLocaleDateString()
              : "No expiry",
            items: items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: formatCurrency(Number(item.unitPrice), currency),
              total: formatCurrency(Number(item.quantity) * Number(item.unitPrice), currency),
            })),
            subtotal: formatCurrency(total, currency),
            total: formatCurrency(total, currency),
            currency,
            notes: quotation.quotationFields?.metadata?.notes ?? "",
            terms: quotation.quotationFields?.metadata?.terms ?? "",
            createdAt: new Date(quotation.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getQuotationDetails failed");
          return { error: "Failed to fetch quotation details" };
        }
      },
    }),

    // ============================================
    // BILL DETAILS
    // ============================================

    getBillDetails: tool({
      description: "Get detailed information about a specific bill by ID.",
      inputSchema: z.object({
        billId: z.string().describe("The bill ID to look up"),
      }),
      execute: async ({ billId }) => {
        try {
          const bill = await billRepository.findById(billId, user.id);
          if (!bill) {
            return { error: "Bill not found" };
          }

          return {
            id: bill.id,
            billNumber: bill.billNumber,
            status: bill.status,
            vendorName: bill.vendor?.name ?? "Unknown",
            description: bill.description,
            billDate: new Date(bill.billDate).toLocaleDateString(),
            dueDate: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "No due date",
            subtotal: formatCurrency(Number(bill.subtotal ?? 0), bill.currency),
            taxAmount: formatCurrency(Number(bill.taxAmount ?? 0), bill.currency),
            total: formatCurrency(Number(bill.total ?? 0), bill.currency),
            currency: bill.currency,
            paymentTerms: bill.paymentTerms,
            notes: bill.notes,
            items: bill.items?.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity ?? 1),
              unitPrice: formatCurrency(Number(item.unitPrice ?? 0), bill.currency),
              amount: formatCurrency(Number(item.amount ?? 0), bill.currency),
            })) ?? [],
            paidAt: bill.paidAt ? new Date(bill.paidAt).toLocaleDateString() : null,
            createdAt: new Date(bill.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getBillDetails failed");
          return { error: "Failed to fetch bill details" };
        }
      },
    }),

    // ============================================
    // JOURNAL ENTRY OPERATIONS
    // ============================================

    listJournalEntries: tool({
      description: "List journal entries with optional filters. Use this to view manual entries, posted transactions, or find specific entries.",
      inputSchema: z.object({
        limit: z.number().max(50).optional().describe("Number of entries to return (default 20, max 50)"),
        status: z.enum(["draft", "posted", "reversed"]).optional().describe("Filter by status"),
      }),
      execute: async ({ limit = 20, status }) => {
        return withToolTimeout("listJournalEntries", async () => {
          try {
            const { journalEntries } = await import("@open-bookkeeping/db");
            const entries = await db.query.journalEntries.findMany({
              where: status
                ? and(eq(journalEntries.userId, user.id), eq(journalEntries.status, status))
                : eq(journalEntries.userId, user.id),
              with: { lines: { with: { account: true } } },
              limit,
              orderBy: (je, { desc }) => [desc(je.createdAt)],
            });

            return {
              entries: entries.map((entry) => ({
                id: entry.id,
                entryNumber: entry.entryNumber,
                description: entry.description,
                status: entry.status,
                totalDebit: formatCurrency(Number(entry.totalDebit ?? 0)),
                totalCredit: formatCurrency(Number(entry.totalCredit ?? 0)),
                lineCount: entry.lines?.length ?? 0,
                createdAt: new Date(entry.createdAt).toLocaleDateString(),
              })),
              total: entries.length,
            };
          } catch (error) {
            logger.error({ error }, "listJournalEntries failed");
            return { error: "Failed to fetch journal entries" };
          }
        });
      },
    }),

    getJournalEntryDetails: tool({
      description: "Get detailed information about a specific journal entry including all debit/credit lines.",
      inputSchema: z.object({
        entryId: z.string().describe("The journal entry ID to look up"),
      }),
      execute: async ({ entryId }) => {
        try {
          const { journalEntries } = await import("@open-bookkeeping/db");
          const entry = await db.query.journalEntries.findFirst({
            where: and(eq(journalEntries.id, entryId), eq(journalEntries.userId, user.id)),
            with: { lines: { with: { account: true } } },
          });

          if (!entry) {
            return { error: "Journal entry not found" };
          }

          return {
            id: entry.id,
            entryNumber: entry.entryNumber,
            description: entry.description,
            reference: entry.reference,
            status: entry.status,
            lines: (entry.lines ?? []).map((line) => ({
              accountCode: line.account?.code ?? "",
              accountName: line.account?.name ?? "",
              description: line.description,
              debit: Number(line.debitAmount ?? 0) > 0 ? formatCurrency(Number(line.debitAmount)) : null,
              credit: Number(line.creditAmount ?? 0) > 0 ? formatCurrency(Number(line.creditAmount)) : null,
            })),
            totalDebit: formatCurrency(Number(entry.totalDebit ?? 0)),
            totalCredit: formatCurrency(Number(entry.totalCredit ?? 0)),
            isBalanced: Number(entry.totalDebit ?? 0) === Number(entry.totalCredit ?? 0),
            postedAt: entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : null,
            createdAt: new Date(entry.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getJournalEntryDetails failed");
          return { error: "Failed to fetch journal entry details" };
        }
      },
    }),

    // ============================================
    // CHART OF ACCOUNTS DETAILS
    // ============================================

    getAccountDetails: tool({
      description: "Get detailed information about a specific account from the chart of accounts.",
      inputSchema: z.object({
        accountId: z.string().describe("The account ID to look up"),
      }),
      execute: async ({ accountId }) => {
        try {
          const account = await accountRepository.findById(accountId, user.id);
          if (!account) {
            return { error: "Account not found" };
          }

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
            subType: account.subType,
            description: account.description,
            isActive: account.isActive,
            normalBalance: ["asset", "expense"].includes(account.accountType ?? "") ? "debit" : "credit",
            createdAt: new Date(account.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getAccountDetails failed");
          return { error: "Failed to fetch account details" };
        }
      },
    }),

    // ============================================
    // BANK FEED OPERATIONS (READ)
    // ============================================

    listBankAccounts: tool({
      description: "List all bank accounts connected for bank feeds.",
      inputSchema: z.object({
        limit: z.number().max(20).optional().describe("Number of accounts to return (default 10)"),
      }),
      execute: async ({ limit = 10 }) => {
        return withToolTimeout("listBankAccounts", async () => {
          try {
            const accounts = await db.query.bankAccounts.findMany({
              where: eq(bankAccounts.userId, user.id),
              limit,
              orderBy: (bankAccounts, { desc }) => [desc(bankAccounts.createdAt)],
            });

            return {
              accounts: accounts.map((acc) => ({
                id: acc.id,
                name: acc.accountName,
                bankName: acc.bankName,
                accountNumber: acc.accountNumber ? `****${acc.accountNumber.slice(-4)}` : null,
                currency: acc.currency,
                openingBalance: acc.openingBalance ? formatCurrency(Number(acc.openingBalance), acc.currency) : null,
                isActive: acc.isActive,
              })),
              total: accounts.length,
            };
          } catch (error) {
            logger.error({ error }, "listBankAccounts failed");
            return { error: "Failed to fetch bank accounts" };
          }
        });
      },
    }),

    listBankTransactions: tool({
      description: "List bank transactions with optional filters. Use this to view imported transactions or find unmatched transactions.",
      inputSchema: z.object({
        bankAccountId: z.string().optional().describe("Filter by bank account ID"),
        limit: z.number().max(100).optional().describe("Number of transactions to return (default 50)"),
      }),
      execute: async ({ bankAccountId, limit = 50 }) => {
        return withToolTimeout("listBankTransactions", async () => {
          try {
            const conditions = [eq(bankTransactions.userId, user.id)];
            if (bankAccountId) {
              conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
            }

            const transactions = await db.query.bankTransactions.findMany({
              where: and(...conditions),
              with: { bankAccount: true },
              limit,
              orderBy: (bt, { desc }) => [desc(bt.transactionDate)],
            });

            return {
              transactions: transactions.map((tx) => ({
                id: tx.id,
                date: new Date(tx.transactionDate).toLocaleDateString(),
                description: tx.description,
                amount: formatCurrency(Number(tx.amount), tx.bankAccount?.currency ?? "MYR"),
                amountRaw: Number(tx.amount),
                type: Number(tx.amount) >= 0 ? "credit" : "debit",
                matchStatus: tx.matchStatus,
                bankAccountName: tx.bankAccount?.accountName ?? null,
              })),
              total: transactions.length,
            };
          } catch (error) {
            logger.error({ error }, "listBankTransactions failed");
            return { error: "Failed to fetch bank transactions" };
          }
        });
      },
    }),

    // ============================================
    // BANK FEED OPERATIONS (WRITE/RECONCILIATION)
    // ============================================

    getBankAccountDetails: tool({
      description: "Get detailed information about a specific bank account including balance summary and recent transactions.",
      inputSchema: z.object({
        bankAccountId: z.string().describe("The bank account ID"),
      }),
      execute: async ({ bankAccountId }) => {
        return withToolTimeout("getBankAccountDetails", async () => {
          try {
            const account = await db.query.bankAccounts.findFirst({
              where: and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.userId, user.id)),
            });

            if (!account) {
              return { error: "Bank account not found" };
            }

            // Get transaction summary
            const transactions = await db.query.bankTransactions.findMany({
              where: eq(bankTransactions.bankAccountId, bankAccountId),
            });

            const unmatchedCount = transactions.filter((tx) => tx.matchStatus === "unmatched").length;
            const matchedCount = transactions.filter((tx) => tx.matchStatus === "matched").length;
            const reconciledCount = transactions.filter((tx) => tx.isReconciled).length;

            // Calculate current balance from transactions
            const totalDeposits = transactions
              .filter((tx) => tx.type === "deposit")
              .reduce((sum, tx) => sum + Number(tx.amount), 0);
            const totalWithdrawals = transactions
              .filter((tx) => tx.type === "withdrawal")
              .reduce((sum, tx) => sum + Number(tx.amount), 0);
            const calculatedBalance = Number(account.openingBalance ?? 0) + totalDeposits - totalWithdrawals;

            return {
              account: {
                id: account.id,
                name: account.accountName,
                bankName: account.bankName,
                accountNumber: account.accountNumber ? `****${account.accountNumber.slice(-4)}` : null,
                currency: account.currency,
                openingBalance: formatCurrency(Number(account.openingBalance ?? 0), account.currency),
                currentBalance: formatCurrency(calculatedBalance, account.currency),
                isActive: account.isActive,
              },
              summary: {
                totalTransactions: transactions.length,
                unmatchedCount,
                matchedCount,
                reconciledCount,
                pendingReconciliation: matchedCount - reconciledCount,
              },
            };
          } catch (error) {
            logger.error({ error }, "getBankAccountDetails failed");
            return { error: "Failed to fetch bank account details" };
          }
        });
      },
    }),

    matchBankTransaction: tool({
      description: "Match a bank transaction to an invoice (for deposits) or bill (for withdrawals). This links the payment to the accounting record.",
      inputSchema: z.object({
        transactionId: z.string().describe("The bank transaction ID to match"),
        matchType: z.enum(["invoice", "bill"]).describe("Type of document to match"),
        documentId: z.string().describe("The invoice or bill ID to match to"),
      }),
      execute: async ({ transactionId, matchType, documentId }) => {
        const toolArgs = { transactionId, matchType, documentId };

        try {
          const transaction = await db.query.bankTransactions.findFirst({
            where: and(eq(bankTransactions.id, transactionId), eq(bankTransactions.userId, user.id)),
          });

          if (!transaction) {
            return { error: "Bank transaction not found" };
          }

          if (transaction.matchStatus === "matched") {
            return { error: "Transaction is already matched" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "match_transaction", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Matching transaction requires approval" };
          }

          // Validate the document exists
          if (matchType === "invoice") {
            const invoice = await invoiceRepository.findById(documentId, user.id);
            if (!invoice) {
              return { error: "Invoice not found" };
            }

            await db
              .update(bankTransactions)
              .set({
                matchedInvoiceId: documentId,
                matchStatus: "matched",
                updatedAt: new Date(),
              })
              .where(eq(bankTransactions.id, transactionId));

            await logToolAudit(user.id, session?.id, "match_transaction", toolArgs, { matched: true }, true);

            return {
              status: "success",
              message: `Transaction matched to invoice #${invoice.invoiceNumber}`,
            };
          } else {
            const bill = await db.query.bills.findFirst({
              where: and(eq(bills.id, documentId), eq(bills.userId, user.id)),
            });

            if (!bill) {
              return { error: "Bill not found" };
            }

            await db
              .update(bankTransactions)
              .set({
                matchedBillId: documentId,
                matchStatus: "matched",
                updatedAt: new Date(),
              })
              .where(eq(bankTransactions.id, transactionId));

            await logToolAudit(user.id, session?.id, "match_transaction", toolArgs, { matched: true }, true);

            return {
              status: "success",
              message: `Transaction matched to bill #${bill.billNumber}`,
            };
          }
        } catch (error) {
          logger.error({ error }, "matchBankTransaction failed");
          return { error: "Failed to match transaction" };
        }
      },
    }),

    unmatchBankTransaction: tool({
      description: "Remove the match from a bank transaction. Use this when a transaction was incorrectly matched.",
      inputSchema: z.object({
        transactionId: z.string().describe("The bank transaction ID to unmatch"),
      }),
      execute: async ({ transactionId }) => {
        const toolArgs = { transactionId };

        try {
          const transaction = await db.query.bankTransactions.findFirst({
            where: and(eq(bankTransactions.id, transactionId), eq(bankTransactions.userId, user.id)),
          });

          if (!transaction) {
            return { error: "Bank transaction not found" };
          }

          if (transaction.matchStatus !== "matched") {
            return { error: "Transaction is not matched" };
          }

          if (transaction.isReconciled) {
            return { error: "Cannot unmatch a reconciled transaction" };
          }

          await db
            .update(bankTransactions)
            .set({
              matchedInvoiceId: null,
              matchedBillId: null,
              matchedCustomerId: null,
              matchedVendorId: null,
              matchStatus: "unmatched",
              updatedAt: new Date(),
            })
            .where(eq(bankTransactions.id, transactionId));

          await logToolAudit(user.id, session?.id, "match_transaction", toolArgs, { unmatched: true }, true);

          return { status: "success", message: "Transaction match removed" };
        } catch (error) {
          logger.error({ error }, "unmatchBankTransaction failed");
          return { error: "Failed to unmatch transaction" };
        }
      },
    }),

    reconcileBankTransaction: tool({
      description: "Mark a matched bank transaction as reconciled. This confirms the transaction has been verified against accounting records.",
      inputSchema: z.object({
        transactionId: z.string().describe("The bank transaction ID to reconcile"),
      }),
      execute: async ({ transactionId }) => {
        const toolArgs = { transactionId };

        try {
          const transaction = await db.query.bankTransactions.findFirst({
            where: and(eq(bankTransactions.id, transactionId), eq(bankTransactions.userId, user.id)),
          });

          if (!transaction) {
            return { error: "Bank transaction not found" };
          }

          if (transaction.matchStatus !== "matched") {
            return { error: "Transaction must be matched before reconciling" };
          }

          if (transaction.isReconciled) {
            return { error: "Transaction is already reconciled" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "create_matching_entry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Reconciling transaction requires approval" };
          }

          await db
            .update(bankTransactions)
            .set({
              isReconciled: true,
              reconciledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(bankTransactions.id, transactionId));

          await logToolAudit(user.id, session?.id, "create_matching_entry", toolArgs, { reconciled: true }, true);

          return { status: "success", message: "Transaction reconciled successfully" };
        } catch (error) {
          logger.error({ error }, "reconcileBankTransaction failed");
          return { error: "Failed to reconcile transaction" };
        }
      },
    }),

    // ============================================
    // FIXED ASSET OPERATIONS (READ)
    // ============================================

    listFixedAssets: tool({
      description: "List all fixed assets with their current book values and depreciation status.",
      inputSchema: z.object({
        limit: z.number().max(50).optional().describe("Number of assets to return (default 20)"),
      }),
      execute: async ({ limit = 20 }) => {
        return withToolTimeout("listFixedAssets", async () => {
          try {
            const assets = await db.query.fixedAssets.findMany({
              where: eq(fixedAssets.userId, user.id),
              with: { category: true },
              limit,
              orderBy: (fa, { desc }) => [desc(fa.createdAt)],
            });

            return {
              assets: assets.map((asset) => ({
                id: asset.id,
                name: asset.name,
                assetCode: asset.assetCode,
                category: asset.category?.name ?? "Uncategorized",
                acquisitionDate: asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : null,
                acquisitionCost: formatCurrency(Number(asset.acquisitionCost ?? 0)),
                netBookValue: formatCurrency(Number(asset.netBookValue ?? asset.acquisitionCost ?? 0)),
                accumulatedDepreciation: formatCurrency(Number(asset.accumulatedDepreciation ?? 0)),
                status: asset.status,
                usefulLifeMonths: asset.usefulLifeMonths,
                depreciationMethod: asset.depreciationMethod,
              })),
              total: assets.length,
            };
          } catch (error) {
            logger.error({ error }, "listFixedAssets failed");
            return { error: "Failed to fetch fixed assets" };
          }
        });
      },
    }),

    getFixedAssetDetails: tool({
      description: "Get detailed information about a specific fixed asset including depreciation schedule.",
      inputSchema: z.object({
        assetId: z.string().describe("The fixed asset ID to look up"),
      }),
      execute: async ({ assetId }) => {
        try {
          const asset = await db.query.fixedAssets.findFirst({
            where: and(eq(fixedAssets.id, assetId), eq(fixedAssets.userId, user.id)),
            with: { category: true, vendor: true },
          });

          if (!asset) {
            return { error: "Fixed asset not found" };
          }

          return {
            id: asset.id,
            name: asset.name,
            description: asset.description,
            assetCode: asset.assetCode,
            category: asset.category?.name ?? "Uncategorized",
            location: asset.location,
            acquisitionDate: asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : null,
            acquisitionCost: formatCurrency(Number(asset.acquisitionCost ?? 0)),
            salvageValue: formatCurrency(Number(asset.salvageValue ?? 0)),
            netBookValue: formatCurrency(Number(asset.netBookValue ?? asset.acquisitionCost ?? 0)),
            accumulatedDepreciation: formatCurrency(Number(asset.accumulatedDepreciation ?? 0)),
            usefulLifeMonths: asset.usefulLifeMonths,
            depreciationMethod: asset.depreciationMethod,
            depreciationStartDate: asset.depreciationStartDate ? new Date(asset.depreciationStartDate).toLocaleDateString() : null,
            status: asset.status,
            serialNumber: asset.serialNumber,
            vendor: asset.vendor?.name ?? null,
            createdAt: new Date(asset.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getFixedAssetDetails failed");
          return { error: "Failed to fetch fixed asset details" };
        }
      },
    }),

    listFixedAssetCategories: tool({
      description: "List all fixed asset categories with their default depreciation settings.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const categories = await db.query.fixedAssetCategories.findMany({
            where: eq(fixedAssetCategories.userId, user.id),
            orderBy: (cats, { asc }) => [asc(cats.name)],
          });

          return {
            categories: categories.map((cat) => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              defaultUsefulLifeMonths: cat.defaultUsefulLifeMonths,
              defaultDepreciationMethod: cat.defaultDepreciationMethod,
            })),
            total: categories.length,
          };
        } catch (error) {
          logger.error({ error }, "listFixedAssetCategories failed");
          return { error: "Failed to fetch asset categories" };
        }
      },
    }),

    // ============================================
    // FIXED ASSET OPERATIONS (WRITE)
    // ============================================

    createFixedAsset: tool({
      description: "Create a new fixed asset. Requires asset account, depreciation expense account, and accumulated depreciation account IDs.",
      inputSchema: z.object({
        name: z.string().describe("Asset name"),
        description: z.string().optional().describe("Asset description"),
        categoryId: z.string().optional().describe("Asset category ID"),
        acquisitionDate: z.string().describe("Date acquired (YYYY-MM-DD)"),
        acquisitionCost: z.number().describe("Purchase cost"),
        acquisitionMethod: z.enum(["purchase", "donation", "transfer", "lease_to_own"]).default("purchase"),
        depreciationMethod: z.enum(["straight_line", "declining_balance", "double_declining"]).default("straight_line"),
        usefulLifeMonths: z.number().describe("Useful life in months (e.g., 60 for 5 years)"),
        salvageValue: z.number().default(0).describe("Residual value at end of life"),
        assetAccountId: z.string().describe("Account ID for the asset (asset type)"),
        depreciationExpenseAccountId: z.string().describe("Account ID for depreciation expense"),
        accumulatedDepreciationAccountId: z.string().describe("Account ID for accumulated depreciation"),
        location: z.string().optional().describe("Physical location"),
        serialNumber: z.string().optional().describe("Serial number"),
      }),
      execute: async ({
        name,
        description,
        categoryId,
        acquisitionDate,
        acquisitionCost,
        acquisitionMethod,
        depreciationMethod,
        usefulLifeMonths,
        salvageValue,
        assetAccountId,
        depreciationExpenseAccountId,
        accumulatedDepreciationAccountId,
        location,
        serialNumber,
      }) => {
        const toolArgs = { name, acquisitionDate, acquisitionCost };

        try {
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Creating fixed asset requires approval" };
          }

          // Generate asset code
          const existingCount = await db.query.fixedAssets.findMany({
            where: eq(fixedAssets.userId, user.id),
          });
          const year = new Date().getFullYear();
          const assetCode = `FA-${year}-${String(existingCount.length + 1).padStart(5, "0")}`;

          // Calculate initial net book value
          const netBookValue = acquisitionCost;

          const [asset] = await db
            .insert(fixedAssets)
            .values({
              userId: user.id,
              assetCode,
              name,
              description,
              categoryId: categoryId ?? null,
              acquisitionDate,
              acquisitionCost: String(acquisitionCost),
              acquisitionMethod,
              depreciationMethod,
              usefulLifeMonths,
              salvageValue: String(salvageValue),
              depreciationStartDate: acquisitionDate,
              netBookValue: String(netBookValue),
              assetAccountId,
              depreciationExpenseAccountId,
              accumulatedDepreciationAccountId,
              status: "active",
              location,
              serialNumber,
            })
            .returning();

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { assetId: asset!.id }, true);

          return {
            status: "success",
            assetId: asset!.id,
            assetCode: asset!.assetCode,
            message: `Fixed asset '${name}' created with code ${assetCode}`,
          };
        } catch (error) {
          logger.error({ error }, "createFixedAsset failed");
          return { error: "Failed to create fixed asset" };
        }
      },
    }),

    updateFixedAsset: tool({
      description: "Update an existing fixed asset's information. Cannot change financial details after depreciation starts.",
      inputSchema: z.object({
        assetId: z.string().describe("The fixed asset ID to update"),
        name: z.string().optional().describe("New asset name"),
        description: z.string().optional().describe("New description"),
        location: z.string().optional().describe("Physical location"),
        serialNumber: z.string().optional().describe("Serial number"),
      }),
      execute: async ({ assetId, ...updates }) => {
        const toolArgs = { assetId, ...updates };

        try {
          const asset = await db.query.fixedAssets.findFirst({
            where: and(eq(fixedAssets.id, assetId), eq(fixedAssets.userId, user.id)),
          });

          if (!asset) {
            return { error: "Fixed asset not found" };
          }

          if (asset.status === "disposed") {
            return { error: "Cannot update a disposed asset" };
          }

          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (updates.name) updateData.name = updates.name;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.location !== undefined) updateData.location = updates.location;
          if (updates.serialNumber !== undefined) updateData.serialNumber = updates.serialNumber;

          await db.update(fixedAssets).set(updateData).where(eq(fixedAssets.id, assetId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { success: true }, true);

          return { status: "success", message: `Fixed asset '${asset.name}' updated` };
        } catch (error) {
          logger.error({ error }, "updateFixedAsset failed");
          return { error: "Failed to update fixed asset" };
        }
      },
    }),

    calculateDepreciation: tool({
      description: "Calculate and preview depreciation for a fixed asset for a given year. Does not post to ledger.",
      inputSchema: z.object({
        assetId: z.string().describe("The fixed asset ID"),
        year: z.number().describe("The year to calculate depreciation for"),
      }),
      execute: async ({ assetId, year }) => {
        try {
          const asset = await db.query.fixedAssets.findFirst({
            where: and(eq(fixedAssets.id, assetId), eq(fixedAssets.userId, user.id)),
          });

          if (!asset) {
            return { error: "Fixed asset not found" };
          }

          if (asset.status !== "active") {
            return { error: `Cannot calculate depreciation for asset with status '${asset.status}'` };
          }

          const acquisitionCost = Number(asset.acquisitionCost);
          const salvageValue = Number(asset.salvageValue);
          const accumulatedDep = Number(asset.accumulatedDepreciation);
          const netBookValue = Number(asset.netBookValue);
          const depreciableBase = acquisitionCost - salvageValue;

          let annualDepreciation = 0;

          if (asset.depreciationMethod === "straight_line") {
            // Straight-line: (Cost - Salvage) / Life in years
            const yearsLife = asset.usefulLifeMonths / 12;
            annualDepreciation = depreciableBase / yearsLife;
          } else if (asset.depreciationMethod === "declining_balance") {
            // Declining balance: NBV × (1/Life)
            const rate = 1 / (asset.usefulLifeMonths / 12);
            annualDepreciation = netBookValue * rate;
          } else if (asset.depreciationMethod === "double_declining") {
            // Double declining: NBV × (2/Life)
            const rate = 2 / (asset.usefulLifeMonths / 12);
            annualDepreciation = netBookValue * rate;
          }

          // Don't depreciate below salvage value
          const maxDepreciation = netBookValue - salvageValue;
          annualDepreciation = Math.min(annualDepreciation, maxDepreciation);
          annualDepreciation = Math.max(annualDepreciation, 0);

          const newAccumulatedDep = accumulatedDep + annualDepreciation;
          const newNetBookValue = acquisitionCost - newAccumulatedDep;

          return {
            assetId,
            assetName: asset.name,
            year,
            depreciationMethod: asset.depreciationMethod,
            annualDepreciation: formatCurrency(annualDepreciation, "MYR"),
            currentAccumulatedDepreciation: formatCurrency(accumulatedDep, "MYR"),
            newAccumulatedDepreciation: formatCurrency(newAccumulatedDep, "MYR"),
            currentNetBookValue: formatCurrency(netBookValue, "MYR"),
            newNetBookValue: formatCurrency(newNetBookValue, "MYR"),
            isFullyDepreciated: newNetBookValue <= salvageValue,
          };
        } catch (error) {
          logger.error({ error }, "calculateDepreciation failed");
          return { error: "Failed to calculate depreciation" };
        }
      },
    }),

    disposeFixedAsset: tool({
      description: "Record the disposal of a fixed asset (sale, scrap, donation, or trade-in).",
      inputSchema: z.object({
        assetId: z.string().describe("The fixed asset ID to dispose"),
        disposalDate: z.string().describe("Date of disposal (YYYY-MM-DD)"),
        disposalMethod: z.enum(["sale", "scrapped", "donation", "trade_in"]).describe("How the asset was disposed"),
        proceeds: z.number().default(0).describe("Sale proceeds (0 for scrap/donation)"),
        notes: z.string().optional().describe("Additional notes about disposal"),
      }),
      execute: async ({ assetId, disposalDate, disposalMethod, proceeds, notes }) => {
        const toolArgs = { assetId, disposalDate, disposalMethod, proceeds };

        try {
          const asset = await db.query.fixedAssets.findFirst({
            where: and(eq(fixedAssets.id, assetId), eq(fixedAssets.userId, user.id)),
          });

          if (!asset) {
            return { error: "Fixed asset not found" };
          }

          if (asset.status === "disposed") {
            return { error: "Asset has already been disposed" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Disposing fixed asset requires approval" };
          }

          const netBookValueAtDisposal = Number(asset.netBookValue);
          const gainLoss = proceeds - netBookValueAtDisposal;

          // Import fixedAssetDisposals table
          const { fixedAssetDisposals } = await import("@open-bookkeeping/db");

          // Create disposal record
          const [disposal] = await db
            .insert(fixedAssetDisposals)
            .values({
              fixedAssetId: assetId,
              disposalDate,
              disposalMethod,
              proceeds: String(proceeds),
              netBookValueAtDisposal: String(netBookValueAtDisposal),
              gainLoss: String(gainLoss),
              notes,
            })
            .returning();

          // Update asset status
          await db
            .update(fixedAssets)
            .set({
              status: "disposed",
              updatedAt: new Date(),
            })
            .where(eq(fixedAssets.id, assetId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { disposalId: disposal!.id }, true);

          return {
            status: "success",
            disposalId: disposal!.id,
            message: `Fixed asset '${asset.name}' disposed via ${disposalMethod}`,
            netBookValueAtDisposal: formatCurrency(netBookValueAtDisposal, "MYR"),
            proceeds: formatCurrency(proceeds, "MYR"),
            gainLoss: formatCurrency(gainLoss, "MYR"),
            isGain: gainLoss > 0,
          };
        } catch (error) {
          logger.error({ error }, "disposeFixedAsset failed");
          return { error: "Failed to dispose fixed asset" };
        }
      },
    }),

    // ============================================
    // PAYROLL OPERATIONS (READ)
    // ============================================

    listEmployees: tool({
      description: "List all employees with their basic information and employment status.",
      inputSchema: z.object({
        status: z.enum(["active", "probation", "terminated", "resigned", "retired"]).optional().describe("Filter by employment status"),
        limit: z.number().max(100).optional().describe("Number of employees to return (default 50)"),
      }),
      execute: async ({ status, limit = 50 }) => {
        return withToolTimeout("listEmployees", async () => {
          try {
            const conditions = [eq(employees.userId, user.id)];
            if (status) {
              conditions.push(eq(employees.status, status));
            }

            const employeeList = await db.query.employees.findMany({
              where: and(...conditions),
              limit,
              orderBy: (e, { asc }) => [asc(e.firstName)],
            });

            return {
              employees: employeeList.map((emp) => ({
                id: emp.id,
                employeeCode: emp.employeeCode,
                fullName: [emp.firstName, emp.lastName].filter(Boolean).join(" "),
                email: emp.email,
                phone: emp.phone,
                position: emp.position,
                department: emp.department,
                employmentType: emp.employmentType,
                status: emp.status,
                joinDate: emp.dateJoined ? new Date(emp.dateJoined).toLocaleDateString() : null,
              })),
              total: employeeList.length,
            };
          } catch (error) {
            logger.error({ error }, "listEmployees failed");
            return { error: "Failed to fetch employees" };
          }
        });
      },
    }),

    getEmployeeDetails: tool({
      description: "Get detailed information about a specific employee including statutory info.",
      inputSchema: z.object({
        employeeId: z.string().describe("The employee ID to look up"),
      }),
      execute: async ({ employeeId }) => {
        try {
          const employee = await db.query.employees.findFirst({
            where: and(eq(employees.id, employeeId), eq(employees.userId, user.id)),
          });

          if (!employee) {
            return { error: "Employee not found" };
          }

          return {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullName: [employee.firstName, employee.lastName].filter(Boolean).join(" "),
            email: employee.email,
            phone: employee.phone,
            icNumber: employee.icNumber ? `****${employee.icNumber.slice(-4)}` : null,
            position: employee.position,
            department: employee.department,
            employmentType: employee.employmentType,
            status: employee.status,
            joinDate: employee.dateJoined ? new Date(employee.dateJoined).toLocaleDateString() : null,
            resignationDate: employee.dateResigned ? new Date(employee.dateResigned).toLocaleDateString() : null,
            bankName: employee.bankName,
            bankAccountNumber: employee.bankAccountNumber ? `****${employee.bankAccountNumber.slice(-4)}` : null,
            epfNumber: employee.epfNumber,
            socsoNumber: employee.socsoNumber,
            eisNumber: employee.eisNumber,
            taxNumber: employee.taxNumber,
            epfEmployeeRate: employee.epfEmployeeRate,
            epfEmployerRate: employee.epfEmployerRate,
            maritalStatus: employee.maritalStatus,
            address: employee.address,
            createdAt: new Date(employee.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getEmployeeDetails failed");
          return { error: "Failed to fetch employee details" };
        }
      },
    }),

    listPayrollRuns: tool({
      description: "List payroll runs with their status and totals.",
      inputSchema: z.object({
        status: z.enum(["draft", "approved", "calculating", "pending_review", "finalized", "paid", "cancelled"]).optional().describe("Filter by payroll status"),
        limit: z.number().max(24).optional().describe("Number of payroll runs to return (default 12)"),
      }),
      execute: async ({ status, limit = 12 }) => {
        return withToolTimeout("listPayrollRuns", async () => {
          try {
            const conditions = [eq(payrollRuns.userId, user.id)];
            if (status) {
              conditions.push(eq(payrollRuns.status, status));
            }

            const runs = await db.query.payrollRuns.findMany({
              where: and(...conditions),
              limit,
              orderBy: (pr, { desc }) => [desc(pr.periodEndDate)],
            });

            return {
              payrollRuns: runs.map((run) => ({
                id: run.id,
                name: run.name,
                periodStart: run.periodStartDate ? new Date(run.periodStartDate).toLocaleDateString() : null,
                periodEnd: run.periodEndDate ? new Date(run.periodEndDate).toLocaleDateString() : null,
                status: run.status,
                totalGrossSalary: formatCurrency(Number(run.totalGrossSalary ?? 0)),
                totalNetSalary: formatCurrency(Number(run.totalNetSalary ?? 0)),
                totalEpfEmployee: formatCurrency(Number(run.totalEpfEmployee ?? 0)),
                totalEpfEmployer: formatCurrency(Number(run.totalEpfEmployer ?? 0)),
                totalPcb: formatCurrency(Number(run.totalPcb ?? 0)),
                createdAt: new Date(run.createdAt).toLocaleDateString(),
              })),
              total: runs.length,
            };
          } catch (error) {
            logger.error({ error }, "listPayrollRuns failed");
            return { error: "Failed to fetch payroll runs" };
          }
        });
      },
    }),

    getPaySlipDetails: tool({
      description: "Get detailed pay slip information for a specific pay slip.",
      inputSchema: z.object({
        paySlipId: z.string().describe("The pay slip ID to look up"),
      }),
      execute: async ({ paySlipId }) => {
        try {
          const paySlip = await db.query.paySlips.findFirst({
            where: eq(paySlips.id, paySlipId),
            with: { employee: true, payrollRun: true },
          });

          if (!paySlip) {
            return { error: "Pay slip not found" };
          }

          // Verify ownership through payroll run
          if (paySlip.payrollRun?.userId !== user.id) {
            return { error: "Pay slip not found" };
          }

          return {
            id: paySlip.id,
            employeeName: paySlip.employeeName ?? "Unknown",
            employeeCode: paySlip.employeeCode ?? "",
            periodStart: paySlip.payrollRun?.periodStartDate ? new Date(paySlip.payrollRun.periodStartDate).toLocaleDateString() : null,
            periodEnd: paySlip.payrollRun?.periodEndDate ? new Date(paySlip.payrollRun.periodEndDate).toLocaleDateString() : null,
            basicSalary: formatCurrency(Number(paySlip.baseSalary ?? 0)),
            grossSalary: formatCurrency(Number(paySlip.grossSalary ?? 0)),
            netSalary: formatCurrency(Number(paySlip.netSalary ?? 0)),
            deductions: {
              epfEmployee: formatCurrency(Number(paySlip.epfEmployee ?? 0)),
              socsoEmployee: formatCurrency(Number(paySlip.socsoEmployee ?? 0)),
              eisEmployee: formatCurrency(Number(paySlip.eisEmployee ?? 0)),
              pcb: formatCurrency(Number(paySlip.pcb ?? 0)),
              totalDeductions: formatCurrency(Number(paySlip.totalDeductions ?? 0)),
            },
            employerContributions: {
              epfEmployer: formatCurrency(Number(paySlip.epfEmployer ?? 0)),
              socsoEmployer: formatCurrency(Number(paySlip.socsoEmployer ?? 0)),
              eisEmployer: formatCurrency(Number(paySlip.eisEmployer ?? 0)),
            },
            status: paySlip.status,
          };
        } catch (error) {
          logger.error({ error }, "getPaySlipDetails failed");
          return { error: "Failed to fetch pay slip details" };
        }
      },
    }),

    // ============================================
    // PAYROLL OPERATIONS (WRITE)
    // ============================================

    createEmployee: tool({
      description: "Create a new employee record for payroll. Required fields: first name, date joined.",
      inputSchema: z.object({
        firstName: z.string().describe("Employee first name"),
        lastName: z.string().optional().describe("Employee last name"),
        email: z.string().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        icNumber: z.string().optional().describe("Malaysian IC number"),
        dateJoined: z.string().describe("Date joined (YYYY-MM-DD)"),
        department: z.string().optional().describe("Department"),
        position: z.string().optional().describe("Job position"),
        employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
        bankName: z.string().optional().describe("Bank name for salary"),
        bankAccountNumber: z.string().optional().describe("Bank account number"),
      }),
      execute: async ({
        firstName,
        lastName,
        email,
        phone,
        icNumber,
        dateJoined,
        department,
        position,
        employmentType,
        bankName,
        bankAccountNumber,
      }) => {
        const toolArgs = { firstName, lastName, dateJoined };

        try {
          const approvalCheck = await checkToolApproval(user.id, session?.id, "create_customer", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Creating employee requires approval" };
          }

          // Generate employee code
          const existingCount = await db.query.employees.findMany({
            where: eq(employees.userId, user.id),
          });
          const year = new Date().getFullYear();
          const employeeCode = `EMP-${year}-${String(existingCount.length + 1).padStart(4, "0")}`;

          const [employee] = await db
            .insert(employees)
            .values({
              userId: user.id,
              employeeCode,
              firstName,
              lastName,
              email,
              phone,
              icNumber,
              dateJoined,
              department,
              position,
              employmentType,
              bankName,
              bankAccountNumber,
              status: "active",
            })
            .returning();

          await logToolAudit(user.id, session?.id, "create_customer", toolArgs, { employeeId: employee!.id }, true);

          return {
            status: "success",
            employeeId: employee!.id,
            employeeCode: employee!.employeeCode,
            message: `Employee ${firstName} ${lastName ?? ""} created with code ${employeeCode}`,
          };
        } catch (error) {
          logger.error({ error }, "createEmployee failed");
          return { error: "Failed to create employee" };
        }
      },
    }),

    updateEmployee: tool({
      description: "Update an existing employee's information.",
      inputSchema: z.object({
        employeeId: z.string().describe("The employee ID to update"),
        firstName: z.string().optional().describe("New first name"),
        lastName: z.string().optional().describe("New last name"),
        email: z.string().optional().describe("New email"),
        phone: z.string().optional().describe("New phone number"),
        department: z.string().optional().describe("New department"),
        position: z.string().optional().describe("New position"),
        status: z.enum(["active", "probation", "terminated", "resigned", "retired"]).optional().describe("Employment status"),
        dateResigned: z.string().optional().describe("Resignation date if status is resigned/terminated"),
      }),
      execute: async ({ employeeId, ...updates }) => {
        const toolArgs = { employeeId, ...updates };

        try {
          const employee = await db.query.employees.findFirst({
            where: and(eq(employees.id, employeeId), eq(employees.userId, user.id)),
          });

          if (!employee) {
            return { error: "Employee not found" };
          }

          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (updates.firstName) updateData.firstName = updates.firstName;
          if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
          if (updates.email !== undefined) updateData.email = updates.email;
          if (updates.phone !== undefined) updateData.phone = updates.phone;
          if (updates.department !== undefined) updateData.department = updates.department;
          if (updates.position !== undefined) updateData.position = updates.position;
          if (updates.status) updateData.status = updates.status;
          if (updates.dateResigned) updateData.dateResigned = updates.dateResigned;

          await db.update(employees).set(updateData).where(eq(employees.id, employeeId));

          await logToolAudit(user.id, session?.id, "update_customer", toolArgs, { success: true }, true);

          return { status: "success", message: `Employee ${employee.firstName} updated successfully` };
        } catch (error) {
          logger.error({ error }, "updateEmployee failed");
          return { error: "Failed to update employee" };
        }
      },
    }),

    listSalaryComponents: tool({
      description: "List all salary components (earnings and deductions) configured for payroll.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { salaryComponents } = await import("@open-bookkeeping/db");

          const components = await db.query.salaryComponents.findMany({
            where: eq(salaryComponents.userId, user.id),
            orderBy: (sc, { asc }) => [asc(sc.sortOrder), asc(sc.name)],
          });

          return {
            components: components.map((c) => ({
              id: c.id,
              code: c.code,
              name: c.name,
              type: c.componentType,
              calculationMethod: c.calculationMethod,
              defaultAmount: c.defaultAmount ? formatCurrency(Number(c.defaultAmount)) : null,
              defaultPercentage: c.defaultPercentage ? `${c.defaultPercentage}%` : null,
              isEpfApplicable: c.isEpfApplicable,
              isSocsoApplicable: c.isSocsoApplicable,
              isEisApplicable: c.isEisApplicable,
              isPcbApplicable: c.isPcbApplicable,
              isActive: c.isActive,
            })),
            earnings: components.filter((c) => c.componentType === "earnings").length,
            deductions: components.filter((c) => c.componentType === "deductions").length,
          };
        } catch (error) {
          logger.error({ error }, "listSalaryComponents failed");
          return { error: "Failed to fetch salary components" };
        }
      },
    }),

    createPayrollRun: tool({
      description: "Create a new payroll run for a specific month. This initializes the payroll batch.",
      inputSchema: z.object({
        year: z.number().describe("Payroll year (e.g., 2024)"),
        month: z.number().min(1).max(12).describe("Payroll month (1-12)"),
        payDate: z.string().describe("Payment date (YYYY-MM-DD)"),
        name: z.string().optional().describe("Optional name for the payroll run"),
      }),
      execute: async ({ year, month, payDate, name }) => {
        const toolArgs = { year, month, payDate };

        try {
          const approvalCheck = await checkToolApproval(user.id, session?.id, "create_journal_entry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Creating payroll run requires approval" };
          }

          // Check if payroll run already exists for this period
          const existing = await db.query.payrollRuns.findFirst({
            where: and(
              eq(payrollRuns.userId, user.id),
              eq(payrollRuns.periodYear, year),
              eq(payrollRuns.periodMonth, month)
            ),
          });

          if (existing) {
            return { error: `Payroll run already exists for ${month}/${year}` };
          }

          // Generate run number
          const runNumber = `PR-${year}-${String(month).padStart(2, "0")}`;

          // Calculate period dates
          const periodStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          const periodEndDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

          const [payrollRun] = await db
            .insert(payrollRuns)
            .values({
              userId: user.id,
              runNumber,
              name: name ?? `${getMonthName(month)} ${year} Payroll`,
              periodYear: year,
              periodMonth: month,
              payDate,
              periodStartDate,
              periodEndDate,
              status: "draft",
            })
            .returning();

          await logToolAudit(user.id, session?.id, "create_journal_entry", toolArgs, { payrollRunId: payrollRun!.id }, true);

          return {
            status: "success",
            payrollRunId: payrollRun!.id,
            runNumber: payrollRun!.runNumber,
            message: `Payroll run created for ${getMonthName(month)} ${year}`,
          };
        } catch (error) {
          logger.error({ error }, "createPayrollRun failed");
          return { error: "Failed to create payroll run" };
        }
      },
    }),

    calculateStatutoryDeductions: tool({
      description: "Calculate EPF, SOCSO, EIS, and PCB deductions for a given salary. Useful for estimating employee take-home pay.",
      inputSchema: z.object({
        grossSalary: z.number().describe("Monthly gross salary in MYR"),
        age: z.number().optional().describe("Employee age (affects EPF rates)"),
        nationality: z.enum(["malaysian", "permanent_resident", "foreign"]).default("malaysian"),
      }),
      execute: async ({ grossSalary, age = 30, nationality }) => {
        try {
          // EPF rates (simplified - actual rates are table-based)
          // Below 60: 11% employee, 12%/13% employer
          // 60 and above: Different rates
          const epfEmployeeRate = age >= 60 ? 0.055 : 0.11;
          const epfEmployerRate = age >= 60 ? 0.065 : (grossSalary > 5000 ? 0.12 : 0.13);

          // SOCSO rates (simplified)
          // First Category: Employment Injury & Invalidity
          const socsoEmployeeRate = 0.005; // 0.5%
          const socsoEmployerRate = 0.0175; // 1.75%

          // EIS rates
          const eisEmployeeRate = 0.002; // 0.2%
          const eisEmployerRate = 0.002; // 0.2%

          // Calculate contributions
          const epfEmployee = Math.round(grossSalary * epfEmployeeRate * 100) / 100;
          const epfEmployer = Math.round(grossSalary * epfEmployerRate * 100) / 100;

          // SOCSO is capped at RM5,000 wage
          const socsoWage = Math.min(grossSalary, 5000);
          const socsoEmployee = Math.round(socsoWage * socsoEmployeeRate * 100) / 100;
          const socsoEmployer = Math.round(socsoWage * socsoEmployerRate * 100) / 100;

          // EIS is capped at RM5,000 wage
          const eisWage = Math.min(grossSalary, 5000);
          const eisEmployee = Math.round(eisWage * eisEmployeeRate * 100) / 100;
          const eisEmployer = Math.round(eisWage * eisEmployerRate * 100) / 100;

          // PCB estimate (very simplified - actual calculation is complex)
          // This is just a rough estimate based on annual income
          const annualIncome = grossSalary * 12;
          const annualEpf = epfEmployee * 12;
          const taxableIncome = annualIncome - annualEpf - 9000; // Basic relief
          let annualTax = 0;

          if (taxableIncome > 0) {
            // Simplified Malaysian tax brackets (2024)
            if (taxableIncome <= 5000) annualTax = 0;
            else if (taxableIncome <= 20000) annualTax = (taxableIncome - 5000) * 0.01;
            else if (taxableIncome <= 35000) annualTax = 150 + (taxableIncome - 20000) * 0.03;
            else if (taxableIncome <= 50000) annualTax = 600 + (taxableIncome - 35000) * 0.06;
            else if (taxableIncome <= 70000) annualTax = 1500 + (taxableIncome - 50000) * 0.11;
            else if (taxableIncome <= 100000) annualTax = 3700 + (taxableIncome - 70000) * 0.19;
            else annualTax = 9400 + (taxableIncome - 100000) * 0.25;
          }

          const pcb = Math.round((annualTax / 12) * 100) / 100;

          const totalEmployeeDeductions = epfEmployee + socsoEmployee + eisEmployee + pcb;
          const totalEmployerContributions = epfEmployer + socsoEmployer + eisEmployer;
          const netSalary = grossSalary - totalEmployeeDeductions;

          return {
            grossSalary: formatCurrency(grossSalary),
            deductions: {
              epf: { employee: formatCurrency(epfEmployee), employer: formatCurrency(epfEmployer), rate: `${epfEmployeeRate * 100}%` },
              socso: { employee: formatCurrency(socsoEmployee), employer: formatCurrency(socsoEmployer) },
              eis: { employee: formatCurrency(eisEmployee), employer: formatCurrency(eisEmployer) },
              pcb: formatCurrency(pcb),
              totalEmployeeDeductions: formatCurrency(totalEmployeeDeductions),
              totalEmployerContributions: formatCurrency(totalEmployerContributions),
            },
            netSalary: formatCurrency(netSalary),
            note: "PCB is an estimate. Actual PCB depends on tax relief claims and other factors.",
          };
        } catch (error) {
          logger.error({ error }, "calculateStatutoryDeductions failed");
          return { error: "Failed to calculate statutory deductions" };
        }
      },
    }),

    // ============================================
    // VENDOR DETAILS
    // ============================================

    getVendorDetails: tool({
      description: "Get detailed information about a specific vendor.",
      inputSchema: z.object({
        vendorId: z.string().describe("The vendor ID to look up"),
      }),
      execute: async ({ vendorId }) => {
        try {
          const vendor = await vendorRepository.findById(vendorId, user.id);
          if (!vendor) {
            return { error: "Vendor not found" };
          }

          return {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone,
            address: vendor.address,
            registrationNumber: vendor.registrationNumber,
            taxId: vendor.taxId,
            bankName: vendor.bankName,
            bankAccountNumber: vendor.bankAccountNumber ? `****${vendor.bankAccountNumber.slice(-4)}` : null,
            paymentTermsDays: vendor.paymentTermsDays,
            createdAt: new Date(vendor.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getVendorDetails failed");
          return { error: "Failed to fetch vendor details" };
        }
      },
    }),

    getVendorBills: tool({
      description: "Get all bills for a specific vendor.",
      inputSchema: z.object({
        vendorId: z.string().describe("The vendor ID"),
        unpaidOnly: z.boolean().optional().describe("Return only unpaid bills (defaults to false)"),
      }),
      execute: async ({ vendorId, unpaidOnly = false }) => {
        try {
          const vendor = await vendorRepository.findById(vendorId, user.id);
          if (!vendor) {
            return { error: "Vendor not found" };
          }

          const bills = await billRepository.findMany(user.id, {
            vendorId,
            status: unpaidOnly ? "pending" : undefined,
          });

          return {
            vendor: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
            },
            bills: bills.map((bill) => ({
              id: bill.id,
              billNumber: bill.billNumber,
              amount: formatCurrency(Number(bill.total ?? 0), bill.currency),
              status: bill.status,
              dueDate: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "No due date",
            })),
            totalBills: bills.length,
            totalUnpaid: bills.filter((b) => b.status !== "paid").length,
          };
        } catch (error) {
          logger.error({ error }, "getVendorBills failed");
          return { error: "Failed to fetch vendor bills" };
        }
      },
    }),

    // ============================================
    // CUSTOMER DETAILS
    // ============================================

    getCustomerDetails: tool({
      description: "Get detailed information about a specific customer.",
      inputSchema: z.object({
        customerId: z.string().describe("The customer ID to look up"),
      }),
      execute: async ({ customerId }) => {
        try {
          const customer = await customerRepository.findById(customerId, user.id);
          if (!customer) {
            return { error: "Customer not found" };
          }

          // Get customer invoice count
          const invoices = await invoiceRepository.findByCustomer(customerId, user.id);
          const unpaidCount = invoices.filter((i) => i.status === "pending").length;

          return {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            metadata: customer.metadata,
            stats: {
              totalInvoices: invoices.length,
              unpaidInvoices: unpaidCount,
            },
            createdAt: new Date(customer.createdAt).toLocaleDateString(),
          };
        } catch (error) {
          logger.error({ error }, "getCustomerDetails failed");
          return { error: "Failed to fetch customer details" };
        }
      },
    }),

    // ============================================
    // PHASE 2: CRUD OPERATIONS
    // ============================================

    // Credit Note Operations
    createCreditNoteFromInvoice: tool({
      description: "Create a credit note from an existing invoice. Use this when a customer returns goods or needs a refund/adjustment.",
      inputSchema: z.object({
        invoiceId: z.string().describe("The invoice ID to create credit note from"),
        reason: z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]).describe("Reason for the credit note"),
        reasonDescription: z.string().optional().describe("Additional description for the reason"),
      }),
      execute: async ({ invoiceId, reason, reasonDescription }) => {
        const toolArgs = { invoiceId, reason, reasonDescription };

        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          // Use "create_invoice" action type for now (compatible with existing enum)
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return {
              status: "approval_required",
              message: `Creating credit note for invoice #${invoice.invoiceNumber} requires approval`,
            };
          }

          const [creditNote] = await db
            .insert(creditNotes)
            .values({
              userId: user.id,
              invoiceId,
              customerId: invoice.customerId,
              type: "server",
              status: "draft",
              reason,
              reasonDescription,
            })
            .returning();

          await logToolAudit(user.id, session?.id, "createInvoice", toolArgs, { creditNoteId: creditNote!.id }, true);

          return {
            status: "success",
            creditNoteId: creditNote!.id,
            message: `Credit note created from invoice #${invoice.invoiceNumber}. Status: draft.`,
          };
        } catch (error) {
          logger.error({ error }, "createCreditNoteFromInvoice failed");
          return { error: "Failed to create credit note" };
        }
      },
    }),

    updateCreditNoteStatus: tool({
      description: "Update the status of a credit note. Valid statuses: draft, issued, applied, cancelled.",
      inputSchema: z.object({
        creditNoteId: z.string().describe("The credit note ID"),
        status: z.enum(["draft", "issued", "applied", "cancelled"]).describe("New status for the credit note"),
      }),
      execute: async ({ creditNoteId, status }) => {
        const toolArgs = { creditNoteId, status };

        try {
          const creditNote = await db.query.creditNotes.findFirst({
            where: and(eq(creditNotes.id, creditNoteId), eq(creditNotes.userId, user.id)),
          });

          if (!creditNote) {
            return { error: "Credit note not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating credit note status requires approval" };
          }

          await db
            .update(creditNotes)
            .set({
              status,
              issuedAt: status === "issued" ? new Date() : creditNote.issuedAt,
              updatedAt: new Date(),
            })
            .where(eq(creditNotes.id, creditNoteId));

          await logToolAudit(user.id, session?.id, "updateInvoice", toolArgs, { success: true }, true);

          return { status: "success", message: `Credit note status updated to '${status}'` };
        } catch (error) {
          logger.error({ error }, "updateCreditNoteStatus failed");
          return { error: "Failed to update credit note status" };
        }
      },
    }),

    voidCreditNote: tool({
      description: "Cancel/void a credit note. Only draft credit notes can be voided.",
      inputSchema: z.object({
        creditNoteId: z.string().describe("The credit note ID to void"),
      }),
      execute: async ({ creditNoteId }) => {
        const toolArgs = { creditNoteId };

        try {
          const creditNote = await db.query.creditNotes.findFirst({
            where: and(eq(creditNotes.id, creditNoteId), eq(creditNotes.userId, user.id)),
          });

          if (!creditNote) {
            return { error: "Credit note not found" };
          }

          if (creditNote.status !== "draft") {
            return { error: "Only draft credit notes can be voided. Use updateCreditNoteStatus to cancel issued notes." };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "voidInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Voiding credit note requires approval" };
          }

          await db.delete(creditNotes).where(eq(creditNotes.id, creditNoteId));

          await logToolAudit(user.id, session?.id, "voidInvoice", toolArgs, { success: true }, true);

          return { status: "success", message: "Credit note has been deleted" };
        } catch (error) {
          logger.error({ error }, "voidCreditNote failed");
          return { error: "Failed to void credit note" };
        }
      },
    }),

    // Debit Note Operations
    createDebitNoteFromInvoice: tool({
      description: "Create a debit note to increase the amount owed by a customer (e.g., for pricing adjustments).",
      inputSchema: z.object({
        invoiceId: z.string().describe("The invoice ID to create debit note from"),
        reason: z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]).describe("Reason for the debit note"),
        reasonDescription: z.string().optional().describe("Additional description for the reason"),
      }),
      execute: async ({ invoiceId, reason, reasonDescription }) => {
        const toolArgs = { invoiceId, reason, reasonDescription };

        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return {
              status: "approval_required",
              message: `Creating debit note for invoice #${invoice.invoiceNumber} requires approval`,
            };
          }

          const [debitNote] = await db
            .insert(debitNotes)
            .values({
              userId: user.id,
              invoiceId,
              customerId: invoice.customerId,
              type: "server",
              status: "draft",
              reason,
              reasonDescription,
            })
            .returning();

          await logToolAudit(user.id, session?.id, "createInvoice", toolArgs, { debitNoteId: debitNote!.id }, true);

          return {
            status: "success",
            debitNoteId: debitNote!.id,
            message: `Debit note created from invoice #${invoice.invoiceNumber}. Status: draft.`,
          };
        } catch (error) {
          logger.error({ error }, "createDebitNoteFromInvoice failed");
          return { error: "Failed to create debit note" };
        }
      },
    }),

    updateDebitNoteStatus: tool({
      description: "Update the status of a debit note. Valid statuses: draft, issued, applied, cancelled.",
      inputSchema: z.object({
        debitNoteId: z.string().describe("The debit note ID"),
        status: z.enum(["draft", "issued", "applied", "cancelled"]).describe("New status for the debit note"),
      }),
      execute: async ({ debitNoteId, status }) => {
        const toolArgs = { debitNoteId, status };

        try {
          const debitNote = await db.query.debitNotes.findFirst({
            where: and(eq(debitNotes.id, debitNoteId), eq(debitNotes.userId, user.id)),
          });

          if (!debitNote) {
            return { error: "Debit note not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating debit note status requires approval" };
          }

          await db
            .update(debitNotes)
            .set({
              status,
              issuedAt: status === "issued" ? new Date() : debitNote.issuedAt,
              updatedAt: new Date(),
            })
            .where(eq(debitNotes.id, debitNoteId));

          await logToolAudit(user.id, session?.id, "updateInvoice", toolArgs, { success: true }, true);

          return { status: "success", message: `Debit note status updated to '${status}'` };
        } catch (error) {
          logger.error({ error }, "updateDebitNoteStatus failed");
          return { error: "Failed to update debit note status" };
        }
      },
    }),

    voidDebitNote: tool({
      description: "Delete a draft debit note.",
      inputSchema: z.object({
        debitNoteId: z.string().describe("The debit note ID to void"),
      }),
      execute: async ({ debitNoteId }) => {
        const toolArgs = { debitNoteId };

        try {
          const debitNote = await db.query.debitNotes.findFirst({
            where: and(eq(debitNotes.id, debitNoteId), eq(debitNotes.userId, user.id)),
          });

          if (!debitNote) {
            return { error: "Debit note not found" };
          }

          if (debitNote.status !== "draft") {
            return { error: "Only draft debit notes can be voided" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "voidInvoice", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Voiding debit note requires approval" };
          }

          await db.delete(debitNotes).where(eq(debitNotes.id, debitNoteId));

          await logToolAudit(user.id, session?.id, "voidInvoice", toolArgs, { success: true }, true);

          return { status: "success", message: "Debit note has been deleted" };
        } catch (error) {
          logger.error({ error }, "voidDebitNote failed");
          return { error: "Failed to void debit note" };
        }
      },
    }),

    // Customer Update
    updateCustomer: tool({
      description: "Update customer information.",
      inputSchema: z.object({
        customerId: z.string().describe("The customer ID to update"),
        name: z.string().optional().describe("New customer name"),
        email: z.string().email().optional().describe("New email address"),
        phone: z.string().optional().describe("New phone number"),
        address: z.string().optional().describe("New address"),
      }),
      execute: async ({ customerId, ...updates }) => {
        const toolArgs = { customerId, ...updates };

        try {
          const customer = await customerRepository.findById(customerId, user.id);
          if (!customer) {
            return { error: "Customer not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateCustomer", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating customer requires approval" };
          }

          const { customers } = await import("@open-bookkeeping/db");
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (updates.name) updateData.name = updates.name;
          if (updates.email) updateData.email = updates.email;
          if (updates.phone) updateData.phone = updates.phone;
          if (updates.address) updateData.address = updates.address;

          await db.update(customers).set(updateData).where(eq(customers.id, customerId));

          await logToolAudit(user.id, session?.id, "updateCustomer", toolArgs, { success: true }, true);

          return { status: "success", message: `Customer '${customer.name}' has been updated` };
        } catch (error) {
          logger.error({ error }, "updateCustomer failed");
          return { error: "Failed to update customer" };
        }
      },
    }),

    // Vendor Update
    updateVendor: tool({
      description: "Update vendor information.",
      inputSchema: z.object({
        vendorId: z.string().describe("The vendor ID to update"),
        name: z.string().optional().describe("New vendor name"),
        email: z.string().email().optional().describe("New email address"),
        phone: z.string().optional().describe("New phone number"),
        address: z.string().optional().describe("New address"),
        paymentTermsDays: z.number().optional().describe("Payment terms in days"),
      }),
      execute: async ({ vendorId, ...updates }) => {
        const toolArgs = { vendorId, ...updates };

        try {
          const vendor = await vendorRepository.findById(vendorId, user.id);
          if (!vendor) {
            return { error: "Vendor not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateVendor", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating vendor requires approval" };
          }

          const { vendors } = await import("@open-bookkeeping/db");
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (updates.name) updateData.name = updates.name;
          if (updates.email) updateData.email = updates.email;
          if (updates.phone) updateData.phone = updates.phone;
          if (updates.address) updateData.address = updates.address;
          if (updates.paymentTermsDays !== undefined) updateData.paymentTermsDays = updates.paymentTermsDays;

          await db.update(vendors).set(updateData).where(eq(vendors.id, vendorId));

          await logToolAudit(user.id, session?.id, "updateVendor", toolArgs, { success: true }, true);

          return { status: "success", message: `Vendor '${vendor.name}' has been updated` };
        } catch (error) {
          logger.error({ error }, "updateVendor failed");
          return { error: "Failed to update vendor" };
        }
      },
    }),

    // Chart of Accounts Operations
    createAccount: tool({
      description: "Create a new account in the chart of accounts.",
      inputSchema: z.object({
        code: z.string().describe("Account code (e.g., '1100', '4000')"),
        name: z.string().describe("Account name (e.g., 'Cash in Bank', 'Sales Revenue')"),
        accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]).describe("Type of account"),
        description: z.string().optional().describe("Account description"),
        isActive: z.boolean().default(true).describe("Whether the account is active"),
      }),
      execute: async ({ code, name, accountType, description, isActive }) => {
        const toolArgs = { code, name, accountType, description, isActive };

        try {
          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Creating account requires approval" };
          }

          const { accounts } = await import("@open-bookkeeping/db");

          // Check if account code already exists
          const existing = await db.query.accounts.findFirst({
            where: and(eq(accounts.userId, user.id), eq(accounts.code, code)),
          });

          if (existing) {
            return { error: `Account with code '${code}' already exists` };
          }

          // Derive normal balance from account type
          // Assets & Expenses: normally debit
          // Liabilities, Equity & Revenue: normally credit
          const normalBalance = (accountType === "asset" || accountType === "expense") ? "debit" : "credit";

          const [account] = await db
            .insert(accounts)
            .values({
              userId: user.id,
              code,
              name,
              accountType,
              normalBalance,
              description,
              isActive,
            })
            .returning();

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { accountId: account!.id }, true);

          return {
            status: "success",
            accountId: account!.id,
            message: `Account '${name}' (${code}) created successfully`,
          };
        } catch (error) {
          logger.error({ error }, "createAccount failed");
          return { error: "Failed to create account" };
        }
      },
    }),

    updateAccount: tool({
      description: "Update an existing account in the chart of accounts.",
      inputSchema: z.object({
        accountId: z.string().describe("The account ID to update"),
        name: z.string().optional().describe("New account name"),
        description: z.string().optional().describe("New description"),
        isActive: z.boolean().optional().describe("Active status"),
      }),
      execute: async ({ accountId, ...updates }) => {
        const toolArgs = { accountId, ...updates };

        try {
          const { accounts } = await import("@open-bookkeeping/db");

          const account = await db.query.accounts.findFirst({
            where: and(eq(accounts.id, accountId), eq(accounts.userId, user.id)),
          });

          if (!account) {
            return { error: "Account not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating account requires approval" };
          }

          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (updates.name) updateData.name = updates.name;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

          await db.update(accounts).set(updateData).where(eq(accounts.id, accountId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { success: true }, true);

          return { status: "success", message: `Account '${account.name}' has been updated` };
        } catch (error) {
          logger.error({ error }, "updateAccount failed");
          return { error: "Failed to update account" };
        }
      },
    }),

    deleteAccount: tool({
      description: "Delete an account from the chart of accounts. Only accounts with no transactions can be deleted.",
      inputSchema: z.object({
        accountId: z.string().describe("The account ID to delete"),
      }),
      execute: async ({ accountId }) => {
        const toolArgs = { accountId };

        try {
          const { accounts, journalEntryLines } = await import("@open-bookkeeping/db");

          const account = await db.query.accounts.findFirst({
            where: and(eq(accounts.id, accountId), eq(accounts.userId, user.id)),
          });

          if (!account) {
            return { error: "Account not found" };
          }

          // Check if account has any transactions
          const hasTransactions = await db.query.journalEntryLines.findFirst({
            where: eq(journalEntryLines.accountId, accountId),
          });

          if (hasTransactions) {
            return { error: "Cannot delete account with existing transactions. Deactivate it instead using updateAccount." };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "reverseJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Deleting account requires approval" };
          }

          await db.delete(accounts).where(eq(accounts.id, accountId));

          await logToolAudit(user.id, session?.id, "reverseJournalEntry", toolArgs, { success: true }, true);

          return { status: "success", message: `Account '${account.name}' has been deleted` };
        } catch (error) {
          logger.error({ error }, "deleteAccount failed");
          return { error: "Failed to delete account" };
        }
      },
    }),

    // Update Bill
    updateBill: tool({
      description: "Update bill information (notes, due date, payment terms).",
      inputSchema: z.object({
        billId: z.string().describe("The bill ID to update"),
        notes: z.string().optional().describe("New notes for the bill"),
        dueDate: z.string().optional().describe("New due date (ISO date string)"),
        paymentTerms: z.string().optional().describe("Payment terms"),
      }),
      execute: async ({ billId, notes, dueDate, paymentTerms }) => {
        const toolArgs = { billId, notes, dueDate, paymentTerms };

        try {
          const { bills } = await import("@open-bookkeeping/db");

          const bill = await db.query.bills.findFirst({
            where: and(eq(bills.id, billId), eq(bills.userId, user.id)),
          });

          if (!bill) {
            return { error: "Bill not found" };
          }

          if (bill.status === "paid") {
            return { error: "Cannot update a paid bill" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateBill", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating bill requires approval" };
          }

          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (notes !== undefined) updateData.notes = notes;
          if (dueDate) updateData.dueDate = new Date(dueDate);
          if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;

          await db.update(bills).set(updateData).where(eq(bills.id, billId));

          await logToolAudit(user.id, session?.id, "updateBill", toolArgs, { success: true }, true);

          return { status: "success", message: `Bill #${bill.billNumber} has been updated` };
        } catch (error) {
          logger.error({ error }, "updateBill failed");
          return { error: "Failed to update bill" };
        }
      },
    }),

    // ============================================
    // ADDITIONAL PAYROLL OPERATIONS
    // ============================================

    getPayrollRunDetails: tool({
      description: "Get detailed information about a specific payroll run including all pay slips.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID"),
      }),
      execute: async ({ payrollRunId }) => {
        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
            with: {
              paySlips: {
                with: {
                  employee: true,
                  items: true,
                },
              },
            },
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          const summary = {
            totalEmployees: payrollRun.paySlips?.length || 0,
            totalGrossSalary: payrollRun.totalGrossSalary,
            totalDeductions: payrollRun.totalDeductions,
            totalNetSalary: payrollRun.totalNetSalary,
            totalEmployerContributions: (
              Number(payrollRun.totalEpfEmployer || 0) +
              Number(payrollRun.totalSocsoEmployer || 0) +
              Number(payrollRun.totalEisEmployer || 0)
            ).toFixed(2),
          };

          return {
            id: payrollRun.id,
            name: payrollRun.name,
            periodYear: payrollRun.periodYear,
            periodMonth: payrollRun.periodMonth,
            status: payrollRun.status,
            payDate: payrollRun.payDate,
            summary,
            paySlips: payrollRun.paySlips?.map((slip) => ({
              id: slip.id,
              employeeName: `${slip.employee?.firstName || ""} ${slip.employee?.lastName || ""}`.trim(),
              employeeCode: slip.employee?.employeeCode,
              grossSalary: slip.grossSalary,
              totalDeductions: slip.totalDeductions,
              netSalary: slip.netSalary,
              status: slip.status,
            })),
          };
        } catch (error) {
          logger.error({ error }, "getPayrollRunDetails failed");
          return { error: "Failed to get payroll run details" };
        }
      },
    }),

    calculatePayrollRun: tool({
      description: "Calculate all pay slips for a payroll run. This must be done before approving.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID to calculate"),
      }),
      execute: async ({ payrollRunId }) => {
        const toolArgs = { payrollRunId };

        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          if (payrollRun.status !== "draft") {
            return { error: `Cannot calculate payroll in ${payrollRun.status} status` };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Calculating payroll requires approval" };
          }

          // Import and call the calculation service
          const { calculatePayroll } = await import("../services/payroll/payroll-calculation.service");
          const result = await calculatePayroll({
            userId: user.id,
            payrollRunId,
            periodYear: payrollRun.periodYear,
            periodMonth: payrollRun.periodMonth,
            runNumber: payrollRun.runNumber,
          });

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, result, true);

          return {
            status: "success",
            message: `Payroll calculated for ${result.totalEmployees || 0} employees`,
            summary: {
              totalGrossSalary: formatCurrency(Number(result.totalGrossSalary || 0)),
              totalDeductions: formatCurrency(Number(result.totalDeductions || 0)),
              totalNetSalary: formatCurrency(Number(result.totalNetSalary || 0)),
            },
          };
        } catch (error) {
          logger.error({ error }, "calculatePayrollRun failed");
          return { error: "Failed to calculate payroll" };
        }
      },
    }),

    approvePayrollRun: tool({
      description: "Approve a calculated payroll run for finalization.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID to approve"),
      }),
      execute: async ({ payrollRunId }) => {
        const toolArgs = { payrollRunId };

        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          if (payrollRun.status !== "pending_review") {
            return { error: `Payroll must be in 'pending_review' status to approve. Current: ${payrollRun.status}` };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Approving payroll requires approval" };
          }

          await db.update(payrollRuns).set({
            status: "approved",
            approvedAt: new Date(),
            approvedBy: user.id,
            updatedAt: new Date(),
          }).where(eq(payrollRuns.id, payrollRunId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { approved: true }, true);

          return { status: "success", message: `Payroll run for ${getMonthName(payrollRun.periodMonth)} ${payrollRun.periodYear} has been approved` };
        } catch (error) {
          logger.error({ error }, "approvePayrollRun failed");
          return { error: "Failed to approve payroll run" };
        }
      },
    }),

    finalizePayrollRun: tool({
      description: "Finalize an approved payroll run. This creates the accounting entries.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID to finalize"),
      }),
      execute: async ({ payrollRunId }) => {
        const toolArgs = { payrollRunId };

        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          if (payrollRun.status !== "approved") {
            return { error: `Payroll must be approved before finalizing. Current: ${payrollRun.status}` };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Finalizing payroll requires approval" };
          }

          // Create accrual journal entry
          const { createPayrollAccrualEntry } = await import("../services/payroll/payroll-journal.service");
          await createPayrollAccrualEntry(user.id, payrollRun);

          await db.update(payrollRuns).set({
            status: "finalized",
            finalizedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(payrollRuns.id, payrollRunId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { finalized: true }, true);

          return { status: "success", message: `Payroll run finalized with journal entries created` };
        } catch (error) {
          logger.error({ error }, "finalizePayrollRun failed");
          return { error: "Failed to finalize payroll run" };
        }
      },
    }),

    markPayrollPaid: tool({
      description: "Mark a finalized payroll run as paid.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID to mark as paid"),
        paymentDate: z.string().optional().describe("Payment date (YYYY-MM-DD), defaults to today"),
      }),
      execute: async ({ payrollRunId, paymentDate }) => {
        const toolArgs = { payrollRunId, paymentDate };

        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          if (payrollRun.status !== "finalized") {
            return { error: `Payroll must be finalized before marking as paid. Current: ${payrollRun.status}` };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Marking payroll paid requires approval" };
          }

          // Create payment journal entry
          const actualPaymentDate = paymentDate || new Date().toISOString().split("T")[0];
          const { createPayrollPaymentEntry } = await import("../services/payroll/payroll-journal.service");
          await createPayrollPaymentEntry(user.id, payrollRun, actualPaymentDate);

          // Update payroll run and all pay slips to paid
          await db.update(payrollRuns).set({
            status: "paid",
            paidAt: new Date(actualPaymentDate),
            updatedAt: new Date(),
          }).where(eq(payrollRuns.id, payrollRunId));

          await db.update(paySlips).set({
            status: "paid",
            updatedAt: new Date(),
          }).where(eq(paySlips.payrollRunId, payrollRunId));

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, { paid: true }, true);

          return { status: "success", message: `Payroll marked as paid. Total: ${formatCurrency(Number(payrollRun.totalNetSalary || 0))}` };
        } catch (error) {
          logger.error({ error }, "markPayrollPaid failed");
          return { error: "Failed to mark payroll as paid" };
        }
      },
    }),

    terminateEmployee: tool({
      description: "Terminate an employee (set status to terminated with resignation date).",
      inputSchema: z.object({
        employeeId: z.string().describe("The employee ID"),
        terminationDate: z.string().describe("Termination date (YYYY-MM-DD)"),
        reason: z.string().optional().describe("Reason for termination"),
      }),
      execute: async ({ employeeId, terminationDate, reason }) => {
        const toolArgs = { employeeId, terminationDate, reason };

        try {
          const employee = await db.query.employees.findFirst({
            where: and(eq(employees.id, employeeId), eq(employees.userId, user.id)),
          });

          if (!employee) {
            return { error: "Employee not found" };
          }

          if (employee.status === "terminated" || employee.status === "resigned") {
            return { error: "Employee is already terminated or resigned" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateVendor", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Terminating employee requires approval" };
          }

          await db.update(employees).set({
            status: "terminated",
            dateResigned: terminationDate,
            updatedAt: new Date(),
          }).where(eq(employees.id, employeeId));

          await logToolAudit(user.id, session?.id, "updateVendor", toolArgs, { terminated: true }, true);

          return { status: "success", message: `Employee ${employee.firstName} ${employee.lastName || ""} has been terminated effective ${terminationDate}` };
        } catch (error) {
          logger.error({ error }, "terminateEmployee failed");
          return { error: "Failed to terminate employee" };
        }
      },
    }),

    updateEmployeeSalary: tool({
      description: "Update an employee's base salary.",
      inputSchema: z.object({
        employeeId: z.string().describe("The employee ID"),
        newSalary: z.number().describe("New monthly base salary"),
        effectiveDate: z.string().describe("Effective date (YYYY-MM-DD)"),
      }),
      execute: async ({ employeeId, newSalary, effectiveDate }) => {
        const toolArgs = { employeeId, newSalary, effectiveDate };

        try {
          const employee = await db.query.employees.findFirst({
            where: and(eq(employees.id, employeeId), eq(employees.userId, user.id)),
          });

          if (!employee) {
            return { error: "Employee not found" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateVendor", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Updating salary requires approval" };
          }

          // End the current salary record (set effectiveTo to day before new effective date)
          const effectiveFromDate = new Date(effectiveDate);
          const effectiveToDate = new Date(effectiveFromDate);
          effectiveToDate.setDate(effectiveToDate.getDate() - 1);

          // End current salary if exists
          await db.update(employeeSalaries).set({
            effectiveTo: effectiveToDate.toISOString().split("T")[0],
            updatedAt: new Date(),
          }).where(
            and(
              eq(employeeSalaries.employeeId, employeeId),
              isNull(employeeSalaries.effectiveTo)
            )
          );

          // Create new salary record
          await db.insert(employeeSalaries).values({
            employeeId,
            effectiveFrom: effectiveDate,
            effectiveTo: null,
            baseSalary: String(newSalary),
            currency: "MYR",
            payFrequency: "monthly",
          });

          await logToolAudit(user.id, session?.id, "updateVendor", toolArgs, { updated: true }, true);

          return {
            status: "success",
            message: `Salary updated to ${formatCurrency(newSalary)} effective ${effectiveDate}`,
            employee: `${employee.firstName} ${employee.lastName || ""}`.trim(),
          };
        } catch (error) {
          logger.error({ error }, "updateEmployeeSalary failed");
          return { error: "Failed to update salary" };
        }
      },
    }),

    getPaySlipsForRun: tool({
      description: "Get all pay slips for a specific payroll run.",
      inputSchema: z.object({
        payrollRunId: z.string().describe("The payroll run ID"),
      }),
      execute: async ({ payrollRunId }) => {
        try {
          const payrollRun = await db.query.payrollRuns.findFirst({
            where: and(eq(payrollRuns.id, payrollRunId), eq(payrollRuns.userId, user.id)),
          });

          if (!payrollRun) {
            return { error: "Payroll run not found" };
          }

          const slips = await db.query.paySlips.findMany({
            where: eq(paySlips.payrollRunId, payrollRunId),
            with: {
              employee: true,
              items: true,
            },
            orderBy: (s, { asc }) => [asc(s.createdAt)],
          });

          return {
            payrollRun: {
              id: payrollRun.id,
              period: `${getMonthName(payrollRun.periodMonth)} ${payrollRun.periodYear}`,
              status: payrollRun.status,
            },
            paySlips: slips.map((slip) => ({
              id: slip.id,
              employee: `${slip.employee?.firstName || ""} ${slip.employee?.lastName || ""}`.trim(),
              employeeCode: slip.employee?.employeeCode,
              grossSalary: formatCurrency(Number(slip.grossSalary || 0)),
              totalDeductions: formatCurrency(Number(slip.totalDeductions || 0)),
              netSalary: formatCurrency(Number(slip.netSalary || 0)),
              status: slip.status,
              items: slip.items?.map((item) => ({
                name: item.componentName,
                type: item.componentType,
                amount: formatCurrency(Number(item.amount || 0)),
              })),
            })),
            totalCount: slips.length,
          };
        } catch (error) {
          logger.error({ error }, "getPaySlipsForRun failed");
          return { error: "Failed to get pay slips" };
        }
      },
    }),

    // ============================================
    // ADDITIONAL FIXED ASSET OPERATIONS
    // ============================================

    runAssetDepreciation: tool({
      description: "Run depreciation for a fixed asset. Creates depreciation journal entry.",
      inputSchema: z.object({
        assetId: z.string().describe("The fixed asset ID"),
        depreciationDate: z.string().optional().describe("Depreciation date (YYYY-MM-DD), defaults to today"),
      }),
      execute: async ({ assetId, depreciationDate }) => {
        const toolArgs = { assetId, depreciationDate };

        try {
          const asset = await db.query.fixedAssets.findFirst({
            where: and(eq(fixedAssets.id, assetId), eq(fixedAssets.userId, user.id)),
          });

          if (!asset) {
            return { error: "Fixed asset not found" };
          }

          if (asset.status !== "active") {
            return { error: `Cannot depreciate asset in ${asset.status} status` };
          }

          if (Number(asset.netBookValue || 0) <= Number(asset.salvageValue || 0)) {
            return { error: "Asset is fully depreciated" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "createJournalEntry", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Running depreciation requires approval" };
          }

          // Calculate depreciation (straight-line method)
          const acquisitionCost = Number(asset.acquisitionCost || 0);
          const salvageValue = Number(asset.salvageValue || 0);
          const usefulLifeMonths = asset.usefulLifeMonths || 60;
          const depreciableAmount = acquisitionCost - salvageValue;
          const monthlyDepreciation = depreciableAmount / usefulLifeMonths;

          const currentAccumulated = Number(asset.accumulatedDepreciation || 0);
          const currentNBV = Number(asset.netBookValue || 0);

          // Ensure we don't depreciate below salvage value
          const maxDepreciation = currentNBV - salvageValue;
          const actualDepreciation = Math.min(monthlyDepreciation, maxDepreciation);

          if (actualDepreciation <= 0) {
            return { error: "Asset is fully depreciated" };
          }

          const newAccumulated = currentAccumulated + actualDepreciation;
          const newNetBookValue = acquisitionCost - newAccumulated;
          const depDate = depreciationDate || new Date().toISOString().split("T")[0];
          const depYear = new Date(depDate).getFullYear();

          // Insert depreciation record
          await db.insert(fixedAssetDepreciations).values({
            fixedAssetId: assetId,
            year: depYear,
            periodStart: depDate,
            periodEnd: depDate,
            depreciationAmount: actualDepreciation.toFixed(2),
            accumulatedDepreciation: newAccumulated.toFixed(2),
            netBookValue: newNetBookValue.toFixed(2),
            status: "posted",
            postedAt: new Date(),
          });

          // Update the asset
          await db.update(fixedAssets).set({
            accumulatedDepreciation: newAccumulated.toFixed(2),
            netBookValue: newNetBookValue.toFixed(2),
            lastDepreciationDate: depDate,
            updatedAt: new Date(),
          }).where(eq(fixedAssets.id, assetId));

          const result = {
            depreciationAmount: actualDepreciation.toFixed(2),
            newNetBookValue: newNetBookValue.toFixed(2),
          };

          await logToolAudit(user.id, session?.id, "createJournalEntry", toolArgs, result, true);

          return {
            status: "success",
            message: `Depreciation recorded for ${asset.name}`,
            depreciationAmount: formatCurrency(actualDepreciation),
            newNetBookValue: formatCurrency(newNetBookValue),
          };
        } catch (error) {
          logger.error({ error }, "runAssetDepreciation failed");
          return { error: "Failed to run depreciation" };
        }
      },
    }),

    getPendingAssetDepreciations: tool({
      description: "Get list of assets that have pending depreciation entries to process.",
      inputSchema: z.object({
        asOfDate: z.string().optional().describe("Check pending as of date (YYYY-MM-DD), defaults to today"),
      }),
      execute: async ({ asOfDate }) => {
        try {
          const checkDate = asOfDate ? new Date(asOfDate) : new Date();

          const activeAssets = await db.query.fixedAssets.findMany({
            where: and(
              eq(fixedAssets.userId, user.id),
              eq(fixedAssets.status, "active"),
              isNull(fixedAssets.deletedAt)
            ),
          });

          const pendingDepreciations = [];

          for (const asset of activeAssets) {
            const netBookValue = Number(asset.netBookValue || 0);
            const salvageValue = Number(asset.salvageValue || 0);

            if (netBookValue > salvageValue) {
              // Calculate if depreciation is due
              const lastDepDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : new Date(asset.depreciationStartDate || asset.acquisitionDate);
              const monthsSinceLast = Math.floor((checkDate.getTime() - lastDepDate.getTime()) / (30 * 24 * 60 * 60 * 1000));

              if (monthsSinceLast >= 1) {
                // Calculate monthly depreciation
                const acquisitionCost = Number(asset.acquisitionCost || 0);
                const usefulLifeMonths = asset.usefulLifeMonths || 60;
                const monthlyDepreciation = (acquisitionCost - salvageValue) / usefulLifeMonths;

                pendingDepreciations.push({
                  assetId: asset.id,
                  assetCode: asset.assetCode,
                  assetName: asset.name,
                  currentNetBookValue: formatCurrency(netBookValue),
                  estimatedDepreciation: formatCurrency(monthlyDepreciation),
                  monthsPending: monthsSinceLast,
                  lastDepreciationDate: lastDepDate.toISOString().split("T")[0],
                });
              }
            }
          }

          return {
            asOfDate: checkDate.toISOString().split("T")[0],
            pendingCount: pendingDepreciations.length,
            assets: pendingDepreciations,
          };
        } catch (error) {
          logger.error({ error }, "getPendingAssetDepreciations failed");
          return { error: "Failed to get pending depreciations" };
        }
      },
    }),

    // ============================================
    // ADDITIONAL BILL/QUOTATION OPERATIONS
    // ============================================

    deleteQuotation: tool({
      description: "Delete a quotation (soft delete). Only draft quotations can be deleted.",
      inputSchema: z.object({
        quotationId: z.string().describe("The quotation ID to delete"),
      }),
      execute: async ({ quotationId }) => {
        const toolArgs = { quotationId };

        try {
          const { quotations } = await import("@open-bookkeeping/db");

          const quotation = await db.query.quotations.findFirst({
            where: and(eq(quotations.id, quotationId), eq(quotations.userId, user.id)),
            with: {
              quotationFields: {
                with: {
                  quotationDetails: true,
                },
              },
            },
          });

          if (!quotation) {
            return { error: "Quotation not found" };
          }

          if (quotation.status !== "draft") {
            return { error: `Cannot delete quotation in ${quotation.status} status. Only draft quotations can be deleted.` };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateQuotation", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Deleting quotation requires approval" };
          }

          await db.update(quotations).set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(quotations.id, quotationId));

          await logToolAudit(user.id, session?.id, "updateQuotation", toolArgs, { deleted: true }, true);

          const quotationNumber = `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`;
          return { status: "success", message: `Quotation #${quotationNumber || quotationId} has been deleted` };
        } catch (error) {
          logger.error({ error }, "deleteQuotation failed");
          return { error: "Failed to delete quotation" };
        }
      },
    }),

    deleteBill: tool({
      description: "Delete a bill (soft delete). Only draft or pending bills can be deleted.",
      inputSchema: z.object({
        billId: z.string().describe("The bill ID to delete"),
      }),
      execute: async ({ billId }) => {
        const toolArgs = { billId };

        try {
          const bill = await db.query.bills.findFirst({
            where: and(eq(bills.id, billId), eq(bills.userId, user.id)),
          });

          if (!bill) {
            return { error: "Bill not found" };
          }

          if (bill.status === "paid") {
            return { error: "Cannot delete a paid bill" };
          }

          const approvalCheck = await checkToolApproval(user.id, session?.id, "updateBill", toolArgs);
          if (approvalCheck && approvalCheck.requiresApproval) {
            return { status: "approval_required", message: "Deleting bill requires approval" };
          }

          await db.update(bills).set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(bills.id, billId));

          await logToolAudit(user.id, session?.id, "updateBill", toolArgs, { deleted: true }, true);

          return { status: "success", message: `Bill #${bill.billNumber} has been deleted` };
        } catch (error) {
          logger.error({ error }, "deleteBill failed");
          return { error: "Failed to delete bill" };
        }
      },
    }),

    getBillAgingReport: tool({
      description: "Get accounts payable aging report showing outstanding bills by age.",
      inputSchema: z.object({
        asOfDate: z.string().optional().describe("Report as of date (YYYY-MM-DD), defaults to today"),
      }),
      execute: async ({ asOfDate }) => {
        try {
          const reportDate = asOfDate ? new Date(asOfDate) : new Date();

          const unpaidBills = await db.query.bills.findMany({
            where: and(
              eq(bills.userId, user.id),
              or(eq(bills.status, "pending"), eq(bills.status, "overdue")),
              isNull(bills.deletedAt)
            ),
            with: {
              vendor: true,
            },
          });

          const aging = {
            current: { count: 0, total: 0, bills: [] as { billNumber: string; vendor: string; amount: number; dueDate: string }[] },
            days1to30: { count: 0, total: 0, bills: [] as { billNumber: string; vendor: string; amount: number; dueDate: string }[] },
            days31to60: { count: 0, total: 0, bills: [] as { billNumber: string; vendor: string; amount: number; dueDate: string }[] },
            days61to90: { count: 0, total: 0, bills: [] as { billNumber: string; vendor: string; amount: number; dueDate: string }[] },
            over90: { count: 0, total: 0, bills: [] as { billNumber: string; vendor: string; amount: number; dueDate: string }[] },
          };

          for (const bill of unpaidBills) {
            const dueDate = bill.dueDate ? new Date(bill.dueDate) : new Date(bill.billDate);
            const daysOverdue = Math.floor((reportDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
            const amount = Number(bill.total || 0);

            const billInfo = {
              billNumber: bill.billNumber,
              vendor: bill.vendor?.name || "Unknown",
              amount,
              dueDate: dueDate.toISOString().split("T")[0],
            };

            if (daysOverdue <= 0) {
              aging.current.count++;
              aging.current.total += amount;
              aging.current.bills.push(billInfo);
            } else if (daysOverdue <= 30) {
              aging.days1to30.count++;
              aging.days1to30.total += amount;
              aging.days1to30.bills.push(billInfo);
            } else if (daysOverdue <= 60) {
              aging.days31to60.count++;
              aging.days31to60.total += amount;
              aging.days31to60.bills.push(billInfo);
            } else if (daysOverdue <= 90) {
              aging.days61to90.count++;
              aging.days61to90.total += amount;
              aging.days61to90.bills.push(billInfo);
            } else {
              aging.over90.count++;
              aging.over90.total += amount;
              aging.over90.bills.push(billInfo);
            }
          }

          const grandTotal = aging.current.total + aging.days1to30.total + aging.days31to60.total + aging.days61to90.total + aging.over90.total;

          return {
            asOfDate: reportDate.toISOString().split("T")[0],
            summary: {
              current: { count: aging.current.count, total: formatCurrency(aging.current.total) },
              "1-30 days": { count: aging.days1to30.count, total: formatCurrency(aging.days1to30.total) },
              "31-60 days": { count: aging.days31to60.count, total: formatCurrency(aging.days31to60.total) },
              "61-90 days": { count: aging.days61to90.count, total: formatCurrency(aging.days61to90.total) },
              "Over 90 days": { count: aging.over90.count, total: formatCurrency(aging.over90.total) },
              grandTotal: formatCurrency(grandTotal),
            },
            totalBills: unpaidBills.length,
          };
        } catch (error) {
          logger.error({ error }, "getBillAgingReport failed");
          return { error: "Failed to generate bill aging report" };
        }
      },
    }),
  };

  // Build the enhanced system prompt - OPTIMIZED for token efficiency
  const systemPrompt = `You are an intelligent bookkeeping assistant (MFRS-compliant).

USER: ${user.name || user.email} | DATE: ${new Date().toISOString().split("T")[0]} | SESSION: ${session?.id ?? "transient"}
${memoryContext ? `\nCONTEXT:\n${memoryContext}\n` : ""}
=====================================
ACCOUNTING TOOL SELECTION (CRITICAL)
=====================================
For accounting entries, ALWAYS use smart tools - they handle double-entry automatically:

| User Says                          | Use Tool              |
|------------------------------------|----------------------|
| "record sale", "revenue", "sold"   | recordSalesRevenue   |
| "expense", "paid for", "bought"    | recordExpense        |
| "customer paid", "received"        | recordPaymentReceived|
| "paid vendor", "paid bill"         | recordPaymentMade    |
| "post invoice to books"            | postInvoiceToLedger  |

These tools AUTO-POST and handle correct DR/CR. Only use createJournalEntry for unusual transactions.

=====================================
EXECUTION RULES
=====================================
1. Call tools → Get data → Respond with results
2. Never fabricate numbers - always use tool data
3. Simple queries: call tool directly, no thinkStep needed
4. Use thinkStep only for multi-step complex workflows

=====================================
TOOL CATEGORIES
=====================================
READ: getDashboardStats, listInvoices, listCustomers, listVendors, listBills, listQuotations, getTrialBalance, getProfitAndLoss, getBalanceSheet, listAccounts

ACCOUNTING (smart): recordSalesRevenue, recordExpense, recordPaymentReceived, recordPaymentMade, postInvoiceToLedger

CREATE: createInvoice, createBill, createCustomer, createVendor, createJournalEntry

UPDATE: markInvoiceAsPaid, markBillAsPaid, updateInvoiceStatus, postJournalEntry

MEMORY: rememberPreference, recallMemories, updateUserContext

DOCUMENTS: listVaultDocuments, processDocuments, getDocumentDetails, queryDocumentCabinet, createEntriesFromDocument

MIGRATION: getMigrationStatus, getOpeningBalances, suggestAccountMapping, validateMigrationData, explainMigrationConcept, getMigrationHelp

=====================================
DOCUMENT PROCESSING WORKFLOW
=====================================
When user uploads or mentions documents:
1. Use listVaultDocuments to see available documents
2. Use processDocuments with document IDs to extract data
3. ALWAYS ask user what to do after processing:
   - "Would you like me to: a) Create bills for all, b) Show summary first, c) Go through each?"
4. Use createEntriesFromDocument to create bills
5. Only offer to explain accounting implications ON DEMAND or for amounts >RM 10,000

SUMMARY TABLE FORMAT (for multiple documents):
| # | Vendor | Type | Date | Amount | Status |

Be concise. Use proper accounting format. Verify data before acting.`;

  logger.info({ userId: user.id, messageCount: messages.length }, "Starting streamText with multi-step tool calling");

  // Limit message history to prevent exceeding OpenAI token limits (30k TPM)
  const limitedMessages = limitMessageHistory(messages, 8);
  logger.debug({ original: messages.length, limited: limitedMessages.length }, "Message history limited");

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: convertToModelMessages(limitedMessages),
    tools,
    // AI SDK v5: Use stopWhen instead of maxSteps for multi-step tool calling
    // Default is stepCountIs(1) which stops after first tool call
    // This allows the AI to: call tool → get result → continue (call more tools or generate text)
    stopWhen: stepCountIs(10),
    onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
      logger.info({
        stepText: text?.substring(0, 200) ?? "(no text)",
        toolCallsCount: toolCalls?.length ?? 0,
        toolResultsCount: toolResults?.length ?? 0,
        hasText: !!text,
        usage,
      }, "=== AI STEP FINISHED ===");

      // Track token usage after each step
      if (usage) {
        const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
        if (totalTokens > 0) {
          agentSafetyService.recordUsage(user.id, {
            action: "analyze_data", // Generic action for chat
            tokens: totalTokens,
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
          }).catch((err) => logger.error({ err }, "Failed to record token usage"));
        }
      }
    },
  });

  logger.debug({ userId: user.id, sessionId: session?.id }, "AI chat request processed");

  // Save user message to session if we have one
  if (session && messages.length > 0) {
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === "user") {
      // Extract text content from the message
      const textContent = lastUserMessage.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? "";

      agentMemoryService.saveMessage(session.id, {
        role: "user",
        content: textContent,
      }).catch((err) => logger.error({ err }, "Failed to save user message"));

      // Update session title from first message
      if (messages.length === 1 && textContent) {
        const title = textContent.slice(0, 100);
        agentMemoryService.updateSessionTitle(session.id, title).catch((err) =>
          logger.error({ err }, "Failed to update session title")
        );
      }
    }
  }

  // Create response with sessionId header
  const response = result.toUIMessageStreamResponse();
  response.headers.set("X-Session-Id", session?.id ?? "");
  return response;
});

/**
 * Extract invoice data from document content
 */
aiRoutes.post("/extract/invoice", async (c) => {
  const authHeader = c.req.header("Authorization");
  const user = await authenticateRequest(authHeader);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { content } = await c.req.json();

  if (!content) {
    return c.json({ error: "Content is required" }, 400);
  }

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractedInvoiceSchema,
    prompt: `Extract invoice data from the following document content.
Be precise with numbers, dates, and currency values.
If a field is not clearly present in the document, make a reasonable inference or omit optional fields.

Document content:
${content}`,
  });

  return c.json(result.object);
});

/**
 * Extract receipt data from document content
 */
aiRoutes.post("/extract/receipt", async (c) => {
  const authHeader = c.req.header("Authorization");
  const user = await authenticateRequest(authHeader);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { content } = await c.req.json();

  if (!content) {
    return c.json({ error: "Content is required" }, 400);
  }

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractedReceiptSchema,
    prompt: `Extract receipt data from the following document content.
Be precise with numbers and dates.
Parse the items list carefully.

Document content:
${content}`,
  });

  return c.json(result.object);
});

/**
 * Extract bank statement data from document content
 */
aiRoutes.post("/extract/bank-statement", async (c) => {
  const authHeader = c.req.header("Authorization");
  const user = await authenticateRequest(authHeader);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { content } = await c.req.json();

  if (!content) {
    return c.json({ error: "Content is required" }, 400);
  }

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractedBankStatementSchema,
    prompt: `Extract bank statement data from the following document content.
Parse all transactions carefully, noting whether each is a credit or debit.
Ensure dates are in YYYY-MM-DD format.

Document content:
${content}`,
  });

  return c.json(result.object);
});

export { aiRoutes };
