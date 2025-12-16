/**
 * Data Flow tRPC Router
 * Provides real-time data flow visualization and educational content
 * for the Data Flow Explorer feature
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { dataFlowService } from "../../services/data-flow.service";

// ============================================
// INPUT SCHEMAS
// ============================================

const eventFiltersSchema = z.object({
  sources: z.array(z.enum(["agent", "user", "admin"])).optional(),
  resourceTypes: z.array(z.string()).optional(),
  actionTypes: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  lastMinutes: z.number().min(1).max(1440).optional(), // Max 24 hours
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const eventSourceSchema = z.enum(["agent", "user", "admin"]);

// ============================================
// ROUTER
// ============================================

export const dataFlowRouter = router({
  /**
   * Get unified events from all audit sources
   * Supports filtering, pagination, and real-time updates
   */
  getEvents: protectedProcedure
    .input(eventFiltersSchema.optional())
    .query(async ({ ctx, input }) => {
      const result = await dataFlowService.getEvents(ctx.user.id, input ?? {});
      return {
        events: result.events,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        lastUpdate: new Date(),
      };
    }),

  /**
   * Get flow statistics for Sankey diagram visualization
   */
  getFlowStats: protectedProcedure
    .input(eventFiltersSchema.optional())
    .query(async ({ ctx, input }) => {
      const flowStats = await dataFlowService.getFlowStats(ctx.user.id, input ?? {});
      return {
        flowStats,
        lastUpdate: new Date(),
      };
    }),

  /**
   * Get a single event by ID
   */
  getEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string().uuid(),
        source: eventSourceSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return dataFlowService.getEventById(ctx.user.id, input.eventId, input.source);
    }),

  /**
   * Get available filter options
   */
  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    return dataFlowService.getFilterOptions(ctx.user.id);
  }),

  /**
   * Get real-time summary statistics
   * Lightweight endpoint for header stats
   */
  getRealtimeSummary: protectedProcedure.query(async ({ ctx }) => {
    return dataFlowService.getRealtimeSummary(ctx.user.id);
  }),

  /**
   * Get educational content for a resource type
   */
  getResourceTypeInfo: protectedProcedure
    .input(z.string())
    .query(({ input: resourceType }) => {
      // Import from constants (shared with frontend)
      const entityEducation: Record<string, {
        displayName: string;
        description: string;
        whatItDoes: string;
        dataFlow: string;
        relatedReports: string[];
      }> = {
        invoice: {
          displayName: "Invoice",
          description: "Sales invoice sent to customers for goods/services",
          whatItDoes: "Records sales transactions and amounts owed by customers",
          dataFlow: "Customer → Invoice → Line Items → Ledger (when posted) → Accounts Receivable",
          relatedReports: ["Sales Report", "Aging Report", "Trial Balance", "Profit & Loss"],
        },
        quotation: {
          displayName: "Quotation",
          description: "Price quote that can be converted to invoice when accepted",
          whatItDoes: "Provides pricing estimates to customers before creating invoices",
          dataFlow: "Customer → Quotation → Line Items → (Accepted) → Invoice",
          relatedReports: ["Quotation Report", "Conversion Rate Report"],
        },
        bill: {
          displayName: "Bill",
          description: "Purchase bill from vendors for expenses/inventory",
          whatItDoes: "Records purchases and amounts owed to vendors",
          dataFlow: "Vendor → Bill → Line Items → Ledger (when posted) → Accounts Payable",
          relatedReports: ["Purchase Report", "AP Aging", "Trial Balance", "Profit & Loss"],
        },
        customer: {
          displayName: "Customer",
          description: "Business or individual who purchases from you",
          whatItDoes: "Stores customer details for invoicing and relationship tracking",
          dataFlow: "Customer → Invoices → Payments → Statements",
          relatedReports: ["Customer List", "Sales by Customer", "Aging Report"],
        },
        vendor: {
          displayName: "Vendor",
          description: "Supplier or service provider you purchase from",
          whatItDoes: "Stores vendor details for bill processing and expense tracking",
          dataFlow: "Vendor → Bills → Payments → Vendor Statement",
          relatedReports: ["Vendor List", "Purchases by Vendor", "AP Report"],
        },
        journal_entry: {
          displayName: "Journal Entry",
          description: "Manual accounting entry with debits and credits",
          whatItDoes: "Records adjustments and transactions directly to the ledger",
          dataFlow: "Journal Entry → Debit/Credit Lines → Ledger → Trial Balance",
          relatedReports: ["Journal Report", "Trial Balance", "General Ledger"],
        },
        account: {
          displayName: "Account",
          description: "Chart of accounts entry for categorizing transactions",
          whatItDoes: "Defines categories for organizing financial transactions",
          dataFlow: "Account → Transaction Lines → Ledger Balance → Reports",
          relatedReports: ["Chart of Accounts", "Account Transactions", "Trial Balance"],
        },
        auth: {
          displayName: "Authentication",
          description: "User login, logout, and security events",
          whatItDoes: "Tracks user access for security and compliance",
          dataFlow: "User → Login/Logout → Session → Audit Log",
          relatedReports: ["Login History", "Security Events"],
        },
        settings: {
          displayName: "Settings",
          description: "User and organization configuration changes",
          whatItDoes: "Records when users modify their preferences or settings",
          dataFlow: "User → Settings Change → Configuration Update",
          relatedReports: ["Settings Audit", "Profile Changes"],
        },
        security: {
          displayName: "Security Event",
          description: "Security-related activities and alerts",
          whatItDoes: "Tracks suspicious activities and security events",
          dataFlow: "Activity → Risk Assessment → Alert/Log",
          relatedReports: ["Security Audit", "Risk Report"],
        },
      };

      return entityEducation[resourceType] ?? {
        displayName: resourceType.charAt(0).toUpperCase() + resourceType.slice(1).replace(/_/g, " "),
        description: `${resourceType} related events`,
        whatItDoes: `Handles ${resourceType} operations`,
        dataFlow: `${resourceType} → Processing → Storage`,
        relatedReports: [],
      };
    }),

  /**
   * Get educational content for an action type
   */
  getActionTypeInfo: protectedProcedure
    .input(z.string())
    .query(({ input: actionType }) => {
      const actionEducation: Record<string, {
        name: string;
        description: string;
        dataImpact: string[];
        financialEffect?: string;
        relatedTables: string[];
        accountingEntry?: {
          debits: string[];
          credits: string[];
        };
      }> = {
        create_invoice: {
          name: "Create Invoice",
          description: "Creates a new sales invoice for a customer",
          dataImpact: [
            "New row in invoices table",
            "Line items stored in invoice_items",
            "When posted: Journal entry created",
          ],
          financialEffect: "Increases Accounts Receivable (Asset) and Revenue",
          relatedTables: ["invoices", "invoice_items", "customers", "journal_entries"],
          accountingEntry: {
            debits: ["Accounts Receivable (1200)"],
            credits: ["Sales Revenue (4000)", "SST Payable (2100) if applicable"],
          },
        },
        update_invoice: {
          name: "Update Invoice",
          description: "Modifies an existing invoice",
          dataImpact: [
            "Invoice record updated",
            "Line items may be added/removed/modified",
            "If posted: May require reversal and re-posting",
          ],
          financialEffect: "May change receivable amount and revenue",
          relatedTables: ["invoices", "invoice_items"],
        },
        delete_invoice: {
          name: "Delete Invoice",
          description: "Removes an invoice from the system",
          dataImpact: [
            "Invoice marked as deleted (soft delete)",
            "Line items cascade deleted",
            "Cannot delete if posted",
          ],
          relatedTables: ["invoices", "invoice_items"],
        },
        create_bill: {
          name: "Create Bill",
          description: "Records a new purchase bill from a vendor",
          dataImpact: [
            "New row in bills table",
            "Line items stored in bill_items",
            "When posted: Journal entry created",
          ],
          financialEffect: "Increases Accounts Payable (Liability) and Expense/Asset",
          relatedTables: ["bills", "bill_items", "vendors", "journal_entries"],
          accountingEntry: {
            debits: ["Expense Account (varies)", "or Inventory (1400)"],
            credits: ["Accounts Payable (2000)"],
          },
        },
        create_journal_entry: {
          name: "Create Journal Entry",
          description: "Creates a manual accounting entry",
          dataImpact: [
            "New journal entry record",
            "Debit and credit lines created",
            "When posted: Ledger balances updated",
          ],
          financialEffect: "Directly affects account balances when posted",
          relatedTables: ["journal_entries", "journal_entry_lines", "accounts"],
          accountingEntry: {
            debits: ["Account(s) specified in entry"],
            credits: ["Account(s) specified in entry"],
          },
        },
        post_journal_entry: {
          name: "Post Journal Entry",
          description: "Posts entry to the general ledger",
          dataImpact: [
            "Entry status changes to 'posted'",
            "Ledger balances updated",
            "Account running balances recalculated",
          ],
          financialEffect: "Permanent change to account balances",
          relatedTables: ["journal_entries", "ledger"],
        },
        login: {
          name: "Login",
          description: "User authentication to the system",
          dataImpact: ["Session created", "Login event logged"],
          relatedTables: ["sessions", "user_audit_logs"],
        },
        settings_update: {
          name: "Settings Update",
          description: "User or organization settings modification",
          dataImpact: ["Settings record updated", "Previous state logged"],
          relatedTables: ["user_settings", "organization_settings", "user_audit_logs"],
        },
      };

      const formattedAction = actionType
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      return actionEducation[actionType] ?? {
        name: formattedAction,
        description: `Performs ${formattedAction.toLowerCase()} operation`,
        dataImpact: ["Records are created or modified"],
        relatedTables: [],
      };
    }),

  /**
   * Get entity relationships for the entity explorer graph
   */
  getEntityRelationships: protectedProcedure.query(() => {
    return {
      entities: [
        // Sales
        {
          id: "customer",
          displayName: "Customer",
          category: "contacts",
          relations: [
            { target: "invoice", type: "has_many", label: "creates" },
            { target: "quotation", type: "has_many", label: "creates" },
            { target: "credit_note", type: "has_many", label: "creates" },
          ],
        },
        {
          id: "invoice",
          displayName: "Invoice",
          category: "sales",
          relations: [
            { target: "customer", type: "belongs_to", label: "for" },
            { target: "invoice_item", type: "has_many", label: "contains" },
            { target: "journal_entry", type: "creates", label: "posts to" },
            { target: "payment", type: "has_many", label: "receives" },
          ],
        },
        {
          id: "quotation",
          displayName: "Quotation",
          category: "sales",
          relations: [
            { target: "customer", type: "belongs_to", label: "for" },
            { target: "invoice", type: "creates", label: "converts to" },
          ],
        },
        // Purchases
        {
          id: "vendor",
          displayName: "Vendor",
          category: "contacts",
          relations: [
            { target: "bill", type: "has_many", label: "creates" },
          ],
        },
        {
          id: "bill",
          displayName: "Bill",
          category: "purchases",
          relations: [
            { target: "vendor", type: "belongs_to", label: "from" },
            { target: "bill_item", type: "has_many", label: "contains" },
            { target: "journal_entry", type: "creates", label: "posts to" },
          ],
        },
        // Accounting
        {
          id: "journal_entry",
          displayName: "Journal Entry",
          category: "accounting",
          relations: [
            { target: "account", type: "references", label: "affects" },
            { target: "ledger", type: "creates", label: "posts to" },
          ],
        },
        {
          id: "account",
          displayName: "Account",
          category: "accounting",
          relations: [
            { target: "journal_entry", type: "has_many", label: "in" },
            { target: "ledger", type: "has_one", label: "balance" },
          ],
        },
        {
          id: "ledger",
          displayName: "Ledger",
          category: "accounting",
          relations: [
            { target: "account", type: "belongs_to", label: "for" },
          ],
        },
      ],
      categories: {
        contacts: { name: "Contacts", color: "#3b82f6" },
        sales: { name: "Sales", color: "#10b981" },
        purchases: { name: "Purchases", color: "#f59e0b" },
        accounting: { name: "Accounting", color: "#8b5cf6" },
      },
    };
  }),
});

export type DataFlowRouter = typeof dataFlowRouter;
