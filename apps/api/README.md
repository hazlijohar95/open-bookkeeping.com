# @open-bookkeeping/api

tRPC API backend for Open Bookkeeping.

---

## Overview

This package provides the API layer for Open Bookkeeping. Built with Hono and tRPC, it delivers type-safe endpoints with automatic TypeScript inference, Zod validation, and Supabase authentication.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Hono 4** | Lightweight, fast HTTP framework |
| **tRPC 11** | End-to-end type-safe API |
| **Drizzle ORM** | Type-safe database queries |
| **Zod** | Runtime validation |
| **Supabase Auth** | Authentication and authorization |
| **Pino** | Structured logging |

---

## Project Structure

```
src/
├── index.ts              # Server entry point
│
├── routes/
│   ├── ai.ts             # AI chat endpoint with ReAct framework
│   └── v1/               # Public REST API (Hono)
│
├── services/             # Business logic services
│   ├── approval.service.ts       # Approval workflow management
│   ├── agent-audit.service.ts    # Agent action audit logging
│   ├── agent-safety.service.ts   # Safety controls & quotas
│   ├── agent-memory.service.ts   # Session & long-term memory
│   └── workflow-engine.service.ts # Multi-step workflow execution
│
└── trpc/
    ├── trpc.ts           # tRPC initialization and procedures
    ├── context.ts        # Request context (auth, database)
    ├── router.ts         # Main router combining all services
    │
    └── services/         # Business logic routers
        ├── invoice.ts    # Invoice CRUD operations
        ├── quotation.ts  # Quotation management
        ├── creditNote.ts # Credit note operations
        ├── debitNote.ts  # Debit note operations
        ├── bill.ts       # Bill management
        ├── customer.ts   # Customer management
        ├── vendor.ts     # Vendor management
        ├── account.ts    # Chart of accounts
        ├── journalEntry.ts # Journal entries
        ├── agent.ts      # AI agent operations
        ├── settings.ts   # User settings
        ├── dashboard.ts  # Dashboard statistics
        ├── statements.ts # Statement generation
        └── vault.ts      # Document vault
```

---

## Architecture

### Request Flow

```
HTTP Request
    ↓
Hono Server (index.ts)
    ↓
tRPC Adapter
    ↓
Context Creation (auth validation)
    ↓
Middleware (auth check for protected routes)
    ↓
Service Router (business logic)
    ↓
Repository (database access)
    ↓
Response
```

### Context

The tRPC context provides authentication and database access to all procedures:

```typescript
// src/trpc/context.ts
import { db } from '@open-bookkeeping/db';
import { createClient } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
}

export interface Context {
  user: User | null;
  db: typeof db;
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  // Extract and validate JWT from Authorization header
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, db };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, db };
  }

  return {
    user: { id: user.id, email: user.email! },
    db,
  };
}
```

### Procedures

Two procedure types control access:

```typescript
// src/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

// Public - no authentication required
export const publicProcedure = t.procedure;

// Protected - requires valid user session
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now guaranteed to be non-null
    },
  });
});

export const router = t.router;
```

---

## API Reference

### Invoice Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `invoice.list` | Query | List all invoices for the current user |
| `invoice.get` | Query | Get a single invoice by ID |
| `invoice.insert` | Mutation | Create a new invoice |
| `invoice.update` | Mutation | Update an existing invoice |
| `invoice.delete` | Mutation | Delete an invoice |
| `invoice.updateStatus` | Mutation | Change invoice status |

**Example: List Invoices**

```typescript
// Input schema
const listInput = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  status: z.enum(['draft', 'pending', 'paid', 'overdue', 'cancelled']).optional(),
});

// Implementation
export const invoiceRouter = router({
  list: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      return invoiceRepository.list(ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
        status: input.status,
      });
    }),
});
```

**Example: Create Invoice**

```typescript
// Input schema (from @/zod-schemas/invoice)
const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  status: z.enum(['draft', 'pending', 'paid', 'overdue', 'cancelled']),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().min(0).max(100).optional(),
  })),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  invoiceDetails: invoiceDetailsSchema,
});

// Implementation
insert: protectedProcedure
  .input(createInvoiceSchema)
  .mutation(async ({ ctx, input }) => {
    const invoice = await invoiceRepository.insert(ctx.user.id, input);

    logger.info({ invoiceId: invoice.id }, 'Invoice created');

    return { success: true, data: invoice };
  }),
```

---

### Quotation Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `quotation.list` | Query | List all quotations |
| `quotation.get` | Query | Get quotation by ID |
| `quotation.insert` | Mutation | Create a new quotation |
| `quotation.update` | Mutation | Update a quotation |
| `quotation.delete` | Mutation | Delete a quotation |
| `quotation.convertToInvoice` | Mutation | Convert quotation to invoice |

---

### Credit Note Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `creditNote.list` | Query | List all credit notes |
| `creditNote.get` | Query | Get credit note by ID |
| `creditNote.insert` | Mutation | Create a credit note |
| `creditNote.update` | Mutation | Update a credit note |
| `creditNote.delete` | Mutation | Delete a credit note |

---

### Debit Note Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `debitNote.list` | Query | List all debit notes |
| `debitNote.get` | Query | Get debit note by ID |
| `debitNote.insert` | Mutation | Create a debit note |
| `debitNote.update` | Mutation | Update a debit note |
| `debitNote.delete` | Mutation | Delete a debit note |

---

### Customer Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `customer.list` | Query | List all customers |
| `customer.get` | Query | Get customer by ID |
| `customer.insert` | Mutation | Create a new customer |
| `customer.update` | Mutation | Update a customer |
| `customer.delete` | Mutation | Delete a customer |

---

### Vendor Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `vendor.list` | Query | List all vendors |
| `vendor.get` | Query | Get vendor by ID |
| `vendor.insert` | Mutation | Create a new vendor |
| `vendor.update` | Mutation | Update a vendor |
| `vendor.delete` | Mutation | Delete a vendor |

---

### Settings Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `settings.get` | Query | Get user settings |
| `settings.update` | Mutation | Update user settings |

---

### Dashboard Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `dashboard.stats` | Query | Get dashboard statistics |

**Response Shape:**

```typescript
interface DashboardStats {
  totalInvoices: number;
  totalRevenue: string;      // Decimal string
  pendingAmount: string;     // Decimal string
  overdueAmount: string;     // Decimal string
  recentInvoices: Invoice[];
  recentQuotations: Quotation[];
}
```

---

### Statements Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `statements.generate` | Query | Generate customer statement |

**Input:**

```typescript
const generateInput = z.object({
  customerId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});
```

---

### Vault Router

| Procedure | Type | Description |
|-----------|------|-------------|
| `vault.list` | Query | List vault documents |
| `vault.upload` | Mutation | Upload a document |
| `vault.delete` | Mutation | Delete a document |

---

## Error Handling

All errors use tRPC's standardized error codes:

```typescript
import { TRPCError } from '@trpc/server';

// Not found
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Invoice not found',
});

// Unauthorized
throw new TRPCError({
  code: 'UNAUTHORIZED',
  message: 'You must be logged in',
});

// Forbidden
throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'You do not have permission to access this resource',
});

// Bad request
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Invalid invoice number format',
});

// Internal error
throw new TRPCError({
  code: 'INTERNAL_SERVER_ERROR',
  message: 'An unexpected error occurred',
});
```

### Error Codes Reference

| Code | HTTP Status | Use Case |
|------|-------------|----------|
| `BAD_REQUEST` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Not logged in |
| `FORBIDDEN` | 403 | No permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Logging

The API uses Pino for structured logging:

```typescript
import { createLogger } from '@open-bookkeeping/shared';

const logger = createLogger('invoice-service');

// Info level
logger.info({ invoiceId }, 'Invoice created successfully');

// Error level with error object
logger.error({ err: error, invoiceId }, 'Failed to create invoice');

// Debug level
logger.debug({ input }, 'Processing invoice creation');
```

**Log Output:**

```json
{
  "level": 30,
  "time": 1701388800000,
  "name": "invoice-service",
  "invoiceId": "550e8400-e29b-41d4-a716-446655440000",
  "msg": "Invoice created successfully"
}
```

---

## Development

### Running Locally

```bash
# From monorepo root
yarn dev:api

# From this directory
yarn dev
```

The server runs at `http://localhost:3001`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server with hot reload |
| `yarn build` | Build for production |
| `yarn start` | Run production build |
| `yarn check-types` | TypeScript type checking |

### Testing Endpoints

Use the tRPC panel or curl:

```bash
# Health check (if implemented)
curl http://localhost:3001/health

# tRPC endpoint (requires proper client)
# Use the frontend or a tRPC client for testing
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `PORT` | No | Server port (default: 3001) |
| `LOG_LEVEL` | No | Logging level (default: info) |

---

## Build Output

Production builds use esbuild:

```
dist/
└── index.js    # Single bundled file
```

**Build characteristics:**

- Single file output for easy deployment
- Tree-shaken and minified
- Source maps for debugging
- Node.js target

---

## Adding New Endpoints

### Step 1: Define the Schema

Create or update a Zod schema in `apps/web/src/zod-schemas/`:

```typescript
// apps/web/src/zod-schemas/newFeature.ts
import { z } from 'zod';

export const createNewFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export type CreateNewFeatureInput = z.infer<typeof createNewFeatureSchema>;
```

### Step 2: Create the Service Router

Add a new file in `src/trpc/services/`:

```typescript
// src/trpc/services/newFeature.ts
import { router, protectedProcedure } from '../trpc';
import { createNewFeatureSchema } from '@/zod-schemas/newFeature';
import { newFeatureRepository } from '@open-bookkeeping/db';

export const newFeatureRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return newFeatureRepository.list(ctx.user.id);
  }),

  insert: protectedProcedure
    .input(createNewFeatureSchema)
    .mutation(async ({ ctx, input }) => {
      return newFeatureRepository.insert(ctx.user.id, input);
    }),
});
```

### Step 3: Add to Main Router

Update `src/trpc/router.ts`:

```typescript
import { newFeatureRouter } from './services/newFeature';

export const appRouter = router({
  // ... existing routers
  newFeature: newFeatureRouter,
});
```

### Step 4: Export Types

The types are automatically inferred. The frontend can use them via:

```typescript
import type { AppRouter } from '@open-bookkeeping/api';
```

---

## AI Agent API

The AI Agent is powered by the `/api/ai/chat` endpoint, implementing a ReAct (Reasoning + Acting) framework with memory systems.

### Endpoint

```
POST /api/ai/chat
Content-Type: application/json
Authorization: Bearer <supabase_token>
X-Session-Id: <optional_session_id>
```

### Request Body

```typescript
{
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}
```

### Response

The endpoint streams responses using AI SDK format with tool invocations included inline.

### Session Management

Sessions are automatically created and managed. The server returns `X-Session-Id` header which should be sent with subsequent requests to maintain conversation context.

### Agent Services

| Service | Description |
|---------|-------------|
| `agent-memory.service.ts` | Session persistence and long-term memory storage |
| `approval.service.ts` | Approval workflow for high-value actions |
| `agent-audit.service.ts` | Audit logging for all agent actions |
| `agent-safety.service.ts` | Rate limiting, quotas, and emergency stop |

### Available Tools

The agent has access to 29+ tools for reading and writing accounting data. See the main CLAUDE.md for the full list.

---

## Further Reading

- [tRPC Documentation](https://trpc.io/)
- [Hono Documentation](https://hono.dev/)
- [Zod Documentation](https://zod.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [AI SDK Documentation](https://ai-sdk.dev/)
