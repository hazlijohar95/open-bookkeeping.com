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
import { documentProcessorService } from "../services/document-processor.service";
import { db, vaultDocuments, vaultProcessingJobs } from "@open-bookkeeping/db";
import { eq, and, desc, ilike, or, gte, lte, sql } from "drizzle-orm";

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
        try {
          const customer = await customerRepository.create({
            userId: user.id,
            name,
            email: email ?? null,
            phone: phone ?? null,
            address: address ?? null,
          });

          return {
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
        } catch (error) {
          return { error: "Failed to create customer", details: String(error) };
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
        try {
          const vendor = await vendorRepository.create({
            userId: user.id,
            name,
            email: email ?? null,
            phone: phone ?? null,
            address: address ?? null,
          });

          return {
            success: true,
            message: `Vendor "${name}" created successfully`,
            vendor: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
            },
          };
        } catch (error) {
          return { error: "Failed to create vendor", details: String(error) };
        }
      },
    }),

    markInvoiceAsPaid: tool({
      description: "Mark an invoice as paid. Use this when the user confirms payment has been received for an invoice.",
      inputSchema: z.object({
        invoiceId: z.string().describe("The ID of the invoice to mark as paid"),
      }),
      execute: async ({ invoiceId }) => {
        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          if (invoice.status === "success") {
            return { error: "Invoice is already marked as paid" };
          }

          const updated = await invoiceRepository.updateStatus(invoiceId, user.id, "success");
          if (!updated) {
            return { error: "Failed to update invoice status" };
          }

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`;

          return {
            success: true,
            message: `Invoice ${serialNumber} has been marked as paid`,
            invoice: {
              id: updated.id,
              serialNumber,
              status: updated.status,
              paidAt: updated.paidAt ? new Date(updated.paidAt).toLocaleDateString() : null,
            },
          };
        } catch (error) {
          return { error: "Failed to mark invoice as paid", details: String(error) };
        }
      },
    }),

    convertQuotationToInvoice: tool({
      description: "Convert an accepted quotation into an invoice. Use this when the user wants to convert a quote to an invoice after it's been accepted.",
      inputSchema: z.object({
        quotationId: z.string().describe("The ID of the quotation to convert"),
      }),
      execute: async ({ quotationId }) => {
        try {
          const quotation = await quotationRepository.findById(quotationId, user.id);
          if (!quotation) {
            return { error: "Quotation not found" };
          }

          if (quotation.status === "converted") {
            return { error: "This quotation has already been converted to an invoice" };
          }

          const result = await quotationRepository.convertToInvoice(quotationId, user.id);

          // Handle error case from repository
          if ('error' in result) {
            return { error: result.error };
          }

          const quotationNumber = `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`;

          return {
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
        } catch (error) {
          return { error: "Failed to convert quotation", details: String(error) };
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
        try {
          const invoice = await invoiceRepository.findById(invoiceId, user.id);
          if (!invoice) {
            return { error: "Invoice not found" };
          }

          const updated = await invoiceRepository.updateStatus(invoiceId, user.id, status);
          if (!updated) {
            return { error: "Failed to update invoice status" };
          }

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix ?? ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber ?? ""}`;

          return {
            success: true,
            message: `Invoice ${serialNumber} status updated to "${status}"`,
            invoice: {
              id: updated.id,
              serialNumber,
              previousStatus: invoice.status,
              newStatus: updated.status,
            },
          };
        } catch (error) {
          return { error: "Failed to update invoice status", details: String(error) };
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
        try {
          const quotation = await quotationRepository.findById(quotationId, user.id);
          if (!quotation) {
            return { error: "Quotation not found" };
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
            return { error: updated.error };
          }

          const serialNumber = `${quotation.quotationFields?.quotationDetails?.prefix ?? ""}${quotation.quotationFields?.quotationDetails?.serialNumber ?? ""}`;

          return {
            success: true,
            message: `Quotation ${serialNumber} status updated to "${status}"`,
            quotation: {
              id: updated.id,
              serialNumber,
              previousStatus: quotation.status,
              newStatus: updated.status,
            },
          };
        } catch (error) {
          return { error: "Failed to update quotation status", details: String(error) };
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
        try {
          const bill = await billRepository.findById(billId, user.id);
          if (!bill) {
            return { error: "Bill not found" };
          }

          if (bill.status === "paid") {
            return { error: "Bill is already marked as paid" };
          }

          const updated = await billRepository.updateStatus(billId, user.id, "paid");
          if (!updated) {
            return { error: "Failed to update bill status" };
          }

          return {
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
        } catch (error) {
          return { error: "Failed to mark bill as paid", details: String(error) };
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
        try {
          // Validate customer if provided
          if (customerId) {
            const customer = await customerRepository.findById(customerId, user.id);
            if (!customer) {
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

          const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

          return {
            success: true,
            message: `Invoice ${prefix}${serialNumber} created successfully for ${clientName}`,
            invoice: {
              id: invoice.invoiceId,
              serialNumber: `${prefix}${serialNumber}`,
              clientName,
              amount: formatCurrency(total, currency),
              amountRaw: total,
              currency,
              date,
              dueDate: dueDate ?? null,
              itemCount: items.length,
              status: "pending",
            },
          };
        } catch (error) {
          logger.error({ error }, "createInvoice failed");
          return { error: "Failed to create invoice", details: String(error) };
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
        try {
          // Validate vendor if provided
          let vendorName: string | null = null;
          if (vendorId) {
            const vendor = await vendorRepository.findById(vendorId, user.id);
            if (!vendor) {
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

          const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

          return {
            success: true,
            message: `Bill ${billNumber} created successfully${vendorName ? ` from ${vendorName}` : ""}`,
            bill: {
              id: bill!.id,
              billNumber,
              vendorName,
              amount: formatCurrency(total, currency),
              amountRaw: total,
              currency,
              billDate,
              dueDate: dueDate ?? null,
              itemCount: items.length,
              status: "pending",
            },
          };
        } catch (error) {
          logger.error({ error }, "createBill failed");
          return { error: "Failed to create bill", details: String(error) };
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
        try {
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
            return {
              error: "Could not find required accounts. Please ensure Chart of Accounts has Cash/Bank/AR and Sales Revenue accounts.",
              suggestion: "Use listAccounts to see available accounts, then use createJournalEntry for custom entries.",
            };
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

          return {
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
        } catch (error) {
          logger.error({ error }, "recordSalesRevenue failed");
          return { error: "Failed to record sales revenue", details: String(error) };
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
        try {
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
            return {
              error: "Could not find required accounts.",
              suggestion: "Use listAccounts to see available accounts.",
            };
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

          return {
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
        } catch (error) {
          logger.error({ error }, "recordExpense failed");
          return { error: "Failed to record expense", details: String(error) };
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
        try {
          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          const cashOrBank = depositTo === "cash"
            ? accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"))
            : accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));

          const ar = accounts.find(a => a.code === "1200" || a.name.toLowerCase().includes("accounts receivable"));

          if (!cashOrBank || !ar) {
            return { error: "Could not find Cash/Bank or Accounts Receivable accounts." };
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

          return {
            success: true,
            message: `Payment received: ${formatCurrency(amount)} from ${customerName}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };
        } catch (error) {
          logger.error({ error }, "recordPaymentReceived failed");
          return { error: "Failed to record payment", details: String(error) };
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
        try {
          const accounts = await accountRepository.findAll(user.id, { isHeader: false });

          const ap = accounts.find(a => a.code === "2100" || a.name.toLowerCase().includes("accounts payable"));
          const cashOrBank = paidFrom === "cash"
            ? accounts.find(a => a.code === "1100" || a.name.toLowerCase().includes("cash"))
            : accounts.find(a => a.code === "1110" || a.name.toLowerCase().includes("bank"));

          if (!ap || !cashOrBank) {
            return { error: "Could not find Accounts Payable or Cash/Bank accounts." };
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

          return {
            success: true,
            message: `Payment made: ${formatCurrency(amount)} to ${vendorName}`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              amount: formatCurrency(amount),
              status: "posted",
            },
          };
        } catch (error) {
          logger.error({ error }, "recordPaymentMade failed");
          return { error: "Failed to record payment", details: String(error) };
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

          const accounts = await accountRepository.findAll(user.id, { isHeader: false });
          const ar = accounts.find(a => a.code === "1200" || a.name.toLowerCase().includes("accounts receivable"));
          const revenue = accounts.find(a =>
            a.code === "4100" || a.code === "4000" ||
            (a.accountType === "revenue" && a.name.toLowerCase().includes("sales"))
          );

          if (!ar || !revenue) {
            return { error: "Could not find AR or Sales Revenue accounts in Chart of Accounts." };
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

          return {
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
        } catch (error) {
          logger.error({ error }, "postInvoiceToLedger failed");
          return { error: "Failed to post invoice to ledger", details: String(error) };
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
        try {
          let totalDebit = 0;
          let totalCredit = 0;

          for (const line of lines) {
            totalDebit += line.debitAmount ?? 0;
            totalCredit += line.creditAmount ?? 0;
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

          return {
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
        } catch (error) {
          logger.error({ error }, "createJournalEntry failed");
          return { error: "Failed to create journal entry", details: String(error) };
        }
      },
    }),

    postJournalEntry: tool({
      description: "Post a draft journal entry to the ledger. This makes it permanent and updates account balances.",
      inputSchema: z.object({
        entryId: z.string().describe("The journal entry ID to post"),
      }),
      execute: async ({ entryId }) => {
        try {
          const entry = await journalEntryRepository.findById(entryId, user.id);
          if (!entry) {
            return { error: "Journal entry not found" };
          }

          if (entry.status === "posted") {
            return { error: "Journal entry is already posted" };
          }

          if (entry.status === "reversed") {
            return { error: "Cannot post a reversed journal entry" };
          }

          await journalEntryRepository.post(entryId, user.id);

          return {
            success: true,
            message: `Journal entry ${entry.entryNumber} has been posted to the ledger`,
            entry: {
              id: entryId,
              entryNumber: entry.entryNumber,
              status: "posted",
              postedAt: new Date().toLocaleDateString(),
            },
          };
        } catch (error) {
          return { error: "Failed to post journal entry", details: String(error) };
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
        try {
          const entry = await journalEntryRepository.findById(entryId, user.id);
          if (!entry) {
            return { error: "Journal entry not found" };
          }

          if (entry.status !== "posted") {
            return { error: "Only posted journal entries can be reversed" };
          }

          const reversal = await journalEntryRepository.reverse(entryId, user.id, reason);

          return {
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
        } catch (error) {
          return { error: "Failed to reverse journal entry", details: String(error) };
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
      description: "Search and recall stored memories about user preferences, facts, or instructions. Use this to find relevant context before taking actions.",
      inputSchema: z.object({
        query: z.string().describe("Search term to find relevant memories"),
      }),
      execute: async ({ query }) => {
        try {
          const memories = await agentMemoryService.searchMemories(user.id, query, 5);

          if (memories.length === 0) {
            return { message: "No relevant memories found", memories: [] };
          }

          return {
            message: `Found ${memories.length} relevant memories`,
            memories: memories.map((m) => ({
              category: m.category,
              key: m.key,
              value: m.value,
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
