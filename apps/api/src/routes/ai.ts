import { Hono } from "hono";
import { streamText, generateObject, convertToModelMessages, UIMessage, tool } from "ai";
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
} from "@open-bookkeeping/db";
import { aggregationService } from "../services/aggregation.service";
import {
  extractedInvoiceSchema,
  extractedReceiptSchema,
  extractedBankStatementSchema,
} from "../schemas/extraction";
import { authenticateRequest } from "../lib/auth-helpers";
import { createLogger } from "@open-bookkeeping/shared";

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

// Helper to format currency
function formatCurrency(amount: number, currency: string = "MYR"): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
  }).format(amount);
}

// Helper to calculate invoice total
function calculateInvoiceTotal(items: Array<{ quantity: number | string; unitPrice: number | string }>) {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
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
 */
aiRoutes.post("/chat", async (c) => {
  const authHeader = c.req.header("Authorization");
  const user = await authenticateRequest(authHeader);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { messages }: { messages: UIMessage[] } = await c.req.json();

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
                serialNumber: `${inv.prefix || ""}${inv.serialNumber || "N/A"}`,
                clientName: inv.clientName || "Unknown",
                amount: formatCurrency(inv.amount, inv.currency || "MYR"),
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

          const items = invoice.invoiceFields?.items || [];
          const total = calculateInvoiceTotal(items);
          const currency = invoice.invoiceFields?.invoiceDetails?.currency || "MYR";

          return {
            id: invoice.id,
            serialNumber: `${invoice.invoiceFields?.invoiceDetails?.prefix || ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber || ""}`,
            status: invoice.status,
            clientName: invoice.invoiceFields?.clientDetails?.name || "Unknown",
            clientAddress: invoice.invoiceFields?.clientDetails?.address || "",
            companyName: invoice.invoiceFields?.companyDetails?.name || "",
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
            notes: invoice.invoiceFields?.metadata?.notes || "",
            terms: invoice.invoiceFields?.metadata?.terms || "",
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
              email: c.email || "No email",
              phone: c.phone || "No phone",
              address: c.address || "No address",
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
              email: c.email || "No email",
              phone: c.phone || "No phone",
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
              const items = inv.invoiceFields?.items || [];
              const total = calculateInvoiceTotal(items);
              const currency = inv.invoiceFields?.invoiceDetails?.currency || "MYR";
              return {
                id: inv.id,
                serialNumber: `${inv.invoiceFields?.invoiceDetails?.prefix || ""}${inv.invoiceFields?.invoiceDetails?.serialNumber || ""}`,
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
              const items = q.quotationFields?.items || [];
              const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
              const currency = q.quotationFields?.quotationDetails?.currency || "MYR";
              return {
                id: q.id,
                serialNumber: `${q.quotationFields?.quotationDetails?.prefix || ""}${q.quotationFields?.quotationDetails?.serialNumber || ""}`,
                clientName: q.quotationFields?.clientDetails?.name || "Unknown",
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
      description: "Get the status of accounting periods (open, closed, or locked). Use this to check if a period is available for posting transactions.",
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
            email: email || null,
            phone: phone || null,
            address: address || null,
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
            email: email || null,
            phone: phone || null,
            address: address || null,
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

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix || ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber || ""}`;

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

          const quotationNumber = `${quotation.quotationFields?.quotationDetails?.prefix || ""}${quotation.quotationFields?.quotationDetails?.serialNumber || ""}`;

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

          const serialNumber = `${invoice.invoiceFields?.invoiceDetails?.prefix || ""}${invoice.invoiceFields?.invoiceDetails?.serialNumber || ""}`;

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

          const serialNumber = `${quotation.quotationFields?.quotationDetails?.prefix || ""}${quotation.quotationFields?.quotationDetails?.serialNumber || ""}`;

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
              email: v.email || "No email",
              phone: v.phone || "No phone",
              address: v.address || "No address",
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
              vendorName: b.vendor?.name || "Unknown vendor",
              amount: formatCurrency(Number(b.total || 0), b.currency),
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

          const totalUnpaid = bills.reduce((sum, b) => sum + Number(b.total || 0), 0);

          return {
            bills: bills.map(b => ({
              id: b.id,
              billNumber: b.billNumber,
              vendorName: b.vendor?.name || "Unknown vendor",
              amount: formatCurrency(Number(b.total || 0), b.currency),
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
            customerId: customerId || undefined,
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
              notes: notes || undefined,
              terms: terms || undefined,
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
              dueDate: dueDate || null,
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
            vendorId: vendorId || null,
            billNumber,
            description: description || null,
            currency,
            billDate: new Date(billDate),
            dueDate: dueDate ? new Date(dueDate) : null,
            status: "pending",
            notes: notes || null,
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
              dueDate: dueDate || null,
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

    createJournalEntry: tool({
      description: "Create a manual journal entry with debit and credit lines. Debits must equal credits. Use listAccounts first to get valid account IDs.",
      inputSchema: z.object({
        entryDate: z.string().describe("Journal entry date (YYYY-MM-DD format)"),
        description: z.string().describe("Description of the journal entry"),
        reference: z.string().optional().describe("Optional reference number"),
        lines: z.array(z.object({
          accountId: z.string().describe("Account ID (use listAccounts to get valid IDs)"),
          debitAmount: z.number().optional().describe("Debit amount (leave empty for credit)"),
          creditAmount: z.number().optional().describe("Credit amount (leave empty for debit)"),
          description: z.string().optional().describe("Line description"),
        })).min(2).describe("Journal entry lines (at least 2 required - one debit, one credit)"),
      }),
      execute: async ({ entryDate, description, reference, lines }) => {
        try {
          // Validate debits equal credits
          let totalDebit = 0;
          let totalCredit = 0;

          for (const line of lines) {
            totalDebit += line.debitAmount || 0;
            totalCredit += line.creditAmount || 0;
          }

          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return {
              error: `Debits (${formatCurrency(totalDebit)}) must equal credits (${formatCurrency(totalCredit)})`,
              totalDebit,
              totalCredit,
            };
          }

          const entry = await journalEntryRepository.create({
            userId: user.id,
            entryDate,
            description,
            reference: reference || undefined,
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
            message: `Journal entry ${entry.entryNumber} created successfully`,
            entry: {
              id: entry.id,
              entryNumber: entry.entryNumber,
              entryDate,
              description,
              totalDebit: formatCurrency(totalDebit),
              totalCredit: formatCurrency(totalCredit),
              lineCount: lines.length,
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
  };

  const result = streamText({
    model: openai("gpt-4o"),
    system: `You are an intelligent bookkeeping assistant for Open-Bookkeeping, a comprehensive invoicing and financial management platform.

CURRENT USER: ${user.name || user.email}
CURRENT DATE: ${new Date().toLocaleDateString()}

YOUR CAPABILITIES:
You are an AGENTIC assistant that can both READ data AND TAKE ACTIONS on behalf of the user.

READ OPERATIONS:
- Access to real-time business data through tools
- Query invoices, customers, vendors, quotations, bills
- Generate full financial reports: Trial Balance, Profit & Loss, Balance Sheet
- Search and analyze ledger transactions
- Check accounting period status

ACTION OPERATIONS:
- Create new customers and vendors
- Create invoices with line items
- Create bills (accounts payable) with line items
- Create journal entries with debit/credit lines
- Mark invoices as paid
- Update invoice and quotation statuses
- Convert quotations to invoices
- Mark bills as paid
- Post and reverse journal entries

GUIDELINES:
1. Always use the available tools to fetch real data - never make up numbers
2. When asked to perform actions (create, update, mark as paid), use the appropriate action tool
3. For multi-step workflows, chain tools together (e.g., find invoice → mark as paid → confirm)
4. Be concise but informative in your responses
5. Proactively offer insights when you notice patterns (e.g., overdue invoices, unpaid bills)
6. Confirm successful actions and show the result to the user
7. When presenting financial data, use proper accounting format
8. Always verify data exists before taking action on it

AVAILABLE TOOLS:

Data Access:
- Dashboard stats, invoice lists, customer lists, vendor lists
- Invoice details, customer invoice history, aging reports
- Quotation lists, bill lists, unpaid bills
- Trial Balance, P&L Statement, Balance Sheet
- Ledger transaction search, accounting period status

Actions:
- createCustomer, createVendor - Add new entities
- createInvoice - Create full invoice with items
- createBill - Create bill (accounts payable) with items
- createJournalEntry - Create manual journal entry
- postJournalEntry, reverseJournalEntry - Journal entry management
- markInvoiceAsPaid, markBillAsPaid - Payment tracking
- updateInvoiceStatus, updateQuotationStatus - Status management
- convertQuotationToInvoice - Quotation conversion
- listAccounts - Get chart of accounts for journal entries

MULTI-STEP WORKFLOW EXAMPLES:
1. "Add customer John and show all customers" → createCustomer → listCustomers
2. "Mark invoice INV-001 as paid" → getInvoiceDetails (to find ID) → markInvoiceAsPaid
3. "Convert the latest quotation" → listQuotations → convertQuotationToInvoice
4. "What bills need payment and mark the first one paid" → getUnpaidBills → markBillAsPaid

When the user asks about their business or wants to perform actions, use the appropriate tools proactively.

IMPORTANT: Be efficient with tool calls. Avoid redundant queries.`,
    messages: convertToModelMessages(messages),
    tools,
  });

  logger.debug({ userId: user.id }, "AI chat request processed");
  return result.toUIMessageStreamResponse();
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
    model: openai.chat("gpt-4o"),
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
    model: openai.chat("gpt-4o"),
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
    model: openai.chat("gpt-4o"),
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
