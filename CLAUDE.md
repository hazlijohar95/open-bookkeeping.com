# Open Bookkeeping

<div align="center">

**Full-stack open-source bookkeeping and invoicing platform for Malaysian businesses**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.0-orange)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [Features](#-features) | Platform capabilities |
| [AI Agent](#-ai-agent) | Intelligent automation |
| [API Reference](#-api-reference) | REST & tRPC endpoints |
| [Development](#-development) | Setup & commands |
| [Architecture](#-architecture) | System design |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI, Jotai |
| **Backend** | Hono, tRPC 11, Node.js, AI SDK |
| **Database** | PostgreSQL (Supabase), Drizzle ORM |
| **Auth** | Supabase Auth + API Keys |
| **Queue** | BullMQ + Redis |
| **PDF** | @react-pdf/renderer |

---

## Features

### Core Accounting

```
+-------------------+-------------------+-------------------+
|      SALES        |    PURCHASES      |    ACCOUNTING     |
+-------------------+-------------------+-------------------+
| * Invoices        | * Bills           | * Chart of        |
| * Quotations      | * Vendors         |   Accounts        |
| * Credit Notes    | * Bill Payments   | * Journal Entries |
| * Debit Notes     |                   | * Fixed Assets    |
| * Statements      |                   | * Trial Balance   |
+-------------------+-------------------+-------------------+
```

### Financial Reports

| Report | Description |
|--------|-------------|
| **Profit & Loss** | Revenue, expenses, and net income |
| **Balance Sheet** | Assets, liabilities, and equity |
| **Trial Balance** | Account balances verification |
| **SST Reports** | Malaysian tax compliance |
| **Aging Report** | Outstanding receivables by age |

### Integrations

| Integration | Status | Description |
|------------|--------|-------------|
| MyInvois e-Invoice | Production | LHDN e-invoice submission |
| Bank Feeds | Active | Transaction import & matching |
| Document Vault | Active | Receipt & document storage |
| Webhooks | Active | Real-time event notifications |

---

## AI Agent

### Overview

The AI Agent is an intelligent assistant that can analyze data, create documents, and automate accounting tasks with full audit trails and approval workflows.

```
+--------------------------------------------------------------+
|                        AI AGENT                              |
+--------------------------------------------------------------+
|                                                              |
|   +---------+    +----------+    +---------+                 |
|   |  Chat   |--->|  Tools   |--->| Actions |                 |
|   |Interface|    |  (20+)   |    |         |                 |
|   +---------+    +----------+    +----+----+                 |
|                                       |                      |
|                       +---------------+---------------+      |
|                       |               |               |      |
|                       v               v               v      |
|                 +---------+    +----------+   +---------+    |
|                 |Approval |    |  Audit   |   | Safety  |    |
|                 | Queue   |    |  Logs    |   |Controls |    |
|                 +---------+    +----------+   +---------+    |
|                                                              |
+--------------------------------------------------------------+
```

### Available Tools

#### Read Operations

| Tool | Description |
|------|-------------|
| `getDashboardStats` | Revenue, expenses, profit metrics |
| `listInvoices` | Query invoices with filters |
| `getInvoiceDetails` | Full invoice with line items |
| `getAgingReport` | Receivables aging analysis |
| `listCustomers` | Customer directory |
| `searchCustomers` | Find customers by name/email |
| `getCustomerInvoices` | Customer invoice history |
| `listQuotations` | Active quotations |
| `listBills` | Payables listing |
| `getBillDetails` | Full bill information |
| `listVendors` | Vendor directory |
| `getAccountBalance` | Account balances |
| `getTrialBalance` | Trial balance report |
| `getProfitLoss` | P&L statement |
| `getBalanceSheet` | Balance sheet report |
| `listAccounts` | Chart of accounts |

#### Write Operations

| Tool | Description | Approval |
|------|-------------|----------|
| `createInvoice` | Generate new invoice | Threshold |
| `createBill` | Record new bill | Threshold |
| `createJournalEntry` | Manual journal entry | Threshold |
| `postJournalEntry` | Post to ledger | Required |
| `reverseJournalEntry` | Reverse posted entry | Required |

### Approval Workflow

```
  User Request          AI Processes           Check Thresholds
       |                     |                       |
       v                     v                       v
  +---------+         +-----------+          +--------------+
  |  Chat   |-------->|  Execute  |--------->|   Amount >   |
  | Message |         |   Tool    |          |  Threshold?  |
  +---------+         +-----------+          +------+-------+
                                                    |
                           +------------------------+--------+
                           |                                 |
                           v                                 v
                    +-------------+                  +-------------+
                    |   Queue     |                  |   Auto      |
                    |  Approval   |                  |  Approve    |
                    +------+------+                  +------+------+
                           |                                |
                           v                                |
                    +-------------+                         |
                    |   Review    |                         |
                    |  & Decide   |                         |
                    +------+------+                         |
                           |                                |
                           v                                v
                    +-----------------------------------------+
                    |              Execute Action             |
                    |              + Audit Log                |
                    +-----------------------------------------+
```

### Safety Controls

| Control | Description |
|---------|-------------|
| **Emergency Stop** | Instantly halt all AI actions |
| **Daily Quotas** | Limit actions per day (invoices, bills, etc.) |
| **Amount Limits** | Maximum single transaction amount |
| **Token Limits** | Daily API token usage cap |
| **Rate Limits** | Actions per minute throttling |

### Configuration Options

```typescript
// Approval Settings
{
  requireApproval: boolean,        // Global approval toggle
  invoiceThreshold: string | null, // MYR amount for invoices
  billThreshold: string | null,    // MYR amount for bills
  journalEntryThreshold: string | null,
  autoApproveReadOnly: boolean,    // Skip approval for reads
  autoApproveRecurring: boolean,   // Auto-approve scheduled
  approvalTimeoutHours: string,    // Expiry for pending
}

// Quota Settings
{
  dailyInvoiceLimit: number,       // Max invoices per day
  dailyBillLimit: number,
  dailyJournalEntryLimit: number,
  dailyTokenLimit: number,         // AI token budget
  maxSingleInvoiceAmount: string,  // Per-invoice cap
  maxDailyTotalAmount: string,     // Total daily cap
}
```

---

## API Reference

### API Architecture

```
+-------------------------------------------------------------+
|                      API Gateway                            |
|                    (Hono Server)                            |
+-------------------------------------------------------------+
|                           |                                 |
|    +----------------------+----------------------+          |
|    |                      |                      |          |
|    v                      v                      v          |
| +----------+        +----------+          +----------+      |
| |  tRPC    |        |  REST    |          |   AI     |      |
| | /trpc/*  |        | /api/v1  |          | /api/ai  |      |
| +----+-----+        +----+-----+          +----+-----+      |
|      |                   |                      |           |
|      v                   v                      v           |
| +----------+        +----------+          +----------+      |
| | Supabase |        | API Key  |          | Bearer   |      |
| |  Auth    |        |  Auth    |          |  Token   |      |
| +----------+        +----------+          +----------+      |
|                                                             |
+-------------------------------------------------------------+
```

### Internal API (tRPC)

**Base Path:** `/trpc/*`
**Auth:** Supabase Bearer Token
**Used By:** Web app, Mobile app

#### Available Routers

| Router | Description |
|--------|-------------|
| `invoice` | Invoice CRUD, send, mark paid |
| `quotation` | Quotation management |
| `creditNote` | Credit note operations |
| `debitNote` | Debit note operations |
| `bill` | Bill management |
| `customer` | Customer CRUD |
| `vendor` | Vendor CRUD |
| `account` | Chart of accounts |
| `journalEntry` | Journal entries |
| `bankFeed` | Bank transaction import |
| `dashboard` | Analytics & stats |
| `settings` | User preferences |
| `agent` | AI agent operations |
| `apiKey` | API key management |
| `webhook` | Webhook configuration |
| `fixedAsset` | Asset management |

### Public REST API

**Base Path:** `/api/v1/*`
**Auth:** API Key (`Authorization: Bearer ob_live_xxx`)
**Docs:** `/api/docs` (Swagger UI)

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| | **Invoices** | |
| `GET` | `/api/v1/invoices` | List invoices |
| `POST` | `/api/v1/invoices` | Create invoice |
| `GET` | `/api/v1/invoices/:id` | Get invoice |
| `PATCH` | `/api/v1/invoices/:id` | Update invoice |
| `DELETE` | `/api/v1/invoices/:id` | Delete invoice |
| `POST` | `/api/v1/invoices/:id/send` | Send invoice |
| `POST` | `/api/v1/invoices/:id/paid` | Mark as paid |
| `POST` | `/api/v1/invoices/:id/void` | Void invoice |
| | **Customers** | |
| `GET` | `/api/v1/customers` | List customers |
| `POST` | `/api/v1/customers` | Create customer |
| `GET` | `/api/v1/customers/:id` | Get customer |
| `PATCH` | `/api/v1/customers/:id` | Update customer |
| `DELETE` | `/api/v1/customers/:id` | Delete customer |
| | **Vendors** | |
| `GET` | `/api/v1/vendors` | List vendors |
| `POST` | `/api/v1/vendors` | Create vendor |
| `GET` | `/api/v1/vendors/:id` | Get vendor |
| `PATCH` | `/api/v1/vendors/:id` | Update vendor |
| `DELETE` | `/api/v1/vendors/:id` | Delete vendor |
| | **Quotations** | |
| `GET` | `/api/v1/quotations` | List quotations |
| `POST` | `/api/v1/quotations` | Create quotation |
| `POST` | `/api/v1/quotations/:id/convert` | Convert to invoice |
| | **Bills** | |
| `GET` | `/api/v1/bills` | List bills |
| `POST` | `/api/v1/bills` | Create bill |
| `POST` | `/api/v1/bills/:id/paid` | Mark as paid |
| | **Accounts** | |
| `GET` | `/api/v1/accounts` | Chart of accounts |
| | **Webhooks** | |
| `GET` | `/api/v1/webhooks` | List webhooks |
| `POST` | `/api/v1/webhooks` | Create webhook |
| `DELETE` | `/api/v1/webhooks/:id` | Delete webhook |

### Webhook Events

```
Invoice Events          Customer Events         Bill Events
+------------------+    +------------------+    +------------------+
| invoice.created  |    | customer.created |    | bill.created     |
| invoice.updated  |    | customer.updated |    | bill.updated     |
| invoice.deleted  |    | customer.deleted |    | bill.deleted     |
| invoice.sent     |    +------------------+    | bill.paid        |
| invoice.paid     |                            +------------------+
| invoice.voided   |    Vendor Events
+------------------+    +------------------+    Quotation Events
                        | vendor.created   |    +------------------+
                        | vendor.updated   |    | quotation.created|
                        | vendor.deleted   |    | quotation.updated|
                        +------------------+    | quotation.deleted|
                                                | quotation.accepted|
                                                +------------------+
```

### SDK Usage

```typescript
import { OpenBookkeeping } from '@open-bookkeeping/sdk';

// Initialize client
const client = new OpenBookkeeping({
  apiKey: 'ob_live_xxxxx',
  baseUrl: 'https://api.open-bookkeeping.com', // optional
});

// List invoices
const { data: invoices } = await client.invoices.list({
  status: 'unpaid',
  limit: 10,
});

// Create customer
const customer = await client.customers.create({
  name: 'Acme Corporation',
  email: 'billing@acme.com',
  phone: '+60123456789',
});

// Create invoice
const invoice = await client.invoices.create({
  customerId: customer.id,
  items: [
    { description: 'Consulting', quantity: 10, rate: 500 }
  ],
  dueDate: '2024-02-15',
});

// Send invoice
await client.invoices.send(invoice.id);

// Verify webhook signature
import { constructWebhookEvent } from '@open-bookkeeping/sdk/webhooks';

const event = await constructWebhookEvent(
  payload,
  signature,
  timestamp,
  webhookSecret
);
```

---

## Architecture

### Project Structure

```
invoicely-v2/
|
+-- apps/
|   |
|   +-- web/                    # React Frontend (port 5173)
|   |   +-- src/
|   |       +-- api/            # React Query hooks (21 modules)
|   |       +-- assets/         # Icons, images
|   |       +-- components/
|   |       |   +-- agent/      # AI Agent UI components
|   |       |   +-- ui/         # Base UI (Radix)
|   |       |   +-- pdf/        # PDF templates
|   |       |   +-- [feature]/  # Feature components
|   |       +-- constants/      # Links, sidebar config
|   |       +-- global/
|   |       |   +-- atoms/      # Jotai state atoms
|   |       |   +-- indexdb/    # Offline storage
|   |       +-- providers/      # React context providers
|   |       +-- routes/         # Page components
|   |       +-- zod-schemas/    # Validation schemas
|   |
|   +-- api/                    # Hono Backend (port 3001)
|       +-- src/
|           +-- routes/
|           |   +-- ai.ts       # AI chat endpoint
|           |   +-- v1/         # Public REST API
|           |   +-- [feature]/  # Feature routes
|           +-- trpc/
|           |   +-- router.ts   # Root router
|           |   +-- services/   # tRPC procedures
|           +-- services/       # Business logic
|           |   +-- approval.service.ts
|           |   +-- agent-audit.service.ts
|           |   +-- agent-safety.service.ts
|           |   +-- workflow-engine.service.ts
|           +-- middleware/     # Auth, rate limiting
|           +-- workers/        # Background jobs
|           +-- lib/            # Utilities
|
+-- packages/
|   |
|   +-- db/                     # Database Package
|   |   +-- src/
|   |   |   +-- schema/         # Drizzle schemas (20 files)
|   |   |   +-- repositories/   # Data access layer
|   |   +-- migrations/         # SQL migrations
|   |
|   +-- sdk/                    # Public TypeScript SDK
|   |   +-- src/
|   |       +-- client.ts       # API client
|   |       +-- resources/      # Resource endpoints
|   |       +-- webhooks.ts     # Webhook utilities
|   |
|   +-- shared/                 # Shared utilities
|       +-- src/
|           +-- logger.ts
|           +-- types.ts
|
+-- .env.example                # Environment template
+-- CLAUDE.md                   # This file
+-- package.json                # Workspace root
```

### Data Flow

```
+-------------+    +-------------+    +-------------+
|   Browser   |--->|   Hono      |--->|  PostgreSQL |
|   (React)   |    |   Server    |    |  (Supabase) |
+-------------+    +------+------+    +-------------+
                          |
                          |
         +----------------+----------------+
         |                |                |
         v                v                v
   +----------+    +----------+    +----------+
   |   Redis  |    |  BullMQ  |    | Supabase |
   |  Cache   |    |  Queue   |    |  Storage |
   +----------+    +----------+    +----------+
```

---

## Development

### Prerequisites

- Node.js 20+
- Yarn 4+ (Corepack)
- PostgreSQL 15+ (or Supabase)
- Redis (for queues)

### Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start all services (web + api) |
| `yarn dev:web` | Frontend only (port 5173) |
| `yarn dev:api` | Backend only (port 3001) |
| `yarn build` | Production build |
| `yarn check-types` | TypeScript validation |
| `yarn lint` | ESLint check |
| `yarn test:e2e` | Playwright tests |

### Database Commands

| Command | Description |
|---------|-------------|
| `yarn db:generate` | Generate migration from schema |
| `yarn db:migrate` | Apply migrations |
| `yarn db:push` | Direct schema sync (slow) |
| `yarn db:studio` | Open Drizzle Studio |

> **Note:** Always use `yarn db:generate` then `yarn db:migrate` instead of `yarn db:push`. The push command pulls the entire remote schema which is slow with Supabase.

### Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
DATABASE_URL=postgresql://...

# Redis (for rate limiting, queues)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# AI (for agent features)
OPENAI_API_KEY=sk-xxx
# or
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## Key Patterns

### Form Validation

```typescript
// Zod schema in apps/web/src/zod-schemas/
const invoiceSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(lineItemSchema).min(1),
  dueDate: z.string().datetime(),
});

// Form with React Hook Form
const form = useForm({
  resolver: zodResolver(invoiceSchema),
});
```

### tRPC Service Pattern

```typescript
// apps/api/src/trpc/services/invoice.ts
export const invoiceRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(['draft', 'sent', 'paid']).optional() }))
    .query(async ({ ctx, input }) => {
      return invoiceRepository.findMany({
        userId: ctx.user.id,
        status: input.status,
      });
    }),

  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // Business logic here
    }),
});
```

### State Management

```typescript
// Jotai for UI state (apps/web/src/global/atoms/)
export const sidebarOpenAtom = atom(true);

// React Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['invoices', filters],
  queryFn: () => api.invoices.list(filters),
});
```

### PDF Generation

```typescript
// apps/web/src/components/pdf/
import { Document, Page, Text, View } from '@react-pdf/renderer';

export function InvoicePDF({ invoice }) {
  return (
    <Document>
      <Page size="A4">
        <View>{/* Invoice content */}</View>
      </Page>
    </Document>
  );
}
```

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `organizations` | Business entities |
| `invoices` | Sales invoices |
| `invoice_items` | Invoice line items |
| `quotations` | Price quotations |
| `credit_notes` | Credit adjustments |
| `debit_notes` | Debit adjustments |
| `bills` | Purchase bills |
| `customers` | Customer records |
| `vendors` | Vendor records |
| `accounts` | Chart of accounts |
| `journal_entries` | Accounting entries |
| `journal_entry_lines` | Entry line items |
| `bank_feeds` | Bank transactions |
| `fixed_assets` | Asset register |

### AI Agent Tables

| Table | Description |
|-------|-------------|
| `agent_approval_settings` | User approval preferences |
| `agent_pending_approvals` | Actions awaiting approval |
| `agent_audit_logs` | Action history with reasoning |
| `agent_quotas` | Usage limits and safety settings |
| `agent_usage` | Daily usage tracking |
| `agent_workflows` | Multi-step workflow definitions |
| `agent_workflow_steps` | Workflow step configurations |
| `agent_sessions` | Chat session tracking |

---

## Support

| Resource | Link |
|----------|------|
| GitHub Issues | [Report a bug](https://github.com/hazlijohar95/open-bookkeeping.com/issues) |
| Documentation | This file |
| API Docs | `/api/docs` (when running) |

---

<div align="center">

**Built with care for Malaysian businesses**

MIT License

</div>
