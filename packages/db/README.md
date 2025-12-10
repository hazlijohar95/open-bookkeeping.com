# @open-bookkeeping/db

Database schema, migrations, and data access layer for Open Bookkeeping.

---

## Overview

This package defines the PostgreSQL database schema using Drizzle ORM. It provides type-safe table definitions, relations, and repository patterns for data access across the application.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Drizzle ORM** | TypeScript-first SQL query builder and ORM |
| **Drizzle Kit** | Migration generation and database tooling |
| **PostgreSQL** | Primary database (via Supabase) |
| **Zod** | Runtime type validation |

---

## Project Structure

```
src/
├── index.ts              # Package exports
├── db.ts                 # Database connection
│
├── schema/               # Table definitions
│   ├── index.ts          # Schema exports
│   ├── users.ts          # User accounts
│   ├── invoices.ts       # Invoice records
│   ├── quotations.ts     # Quotation records
│   ├── creditNotes.ts    # Credit note records
│   ├── debitNotes.ts     # Debit note records
│   ├── customers.ts      # Customer records
│   ├── vendors.ts        # Vendor records
│   ├── userSettings.ts   # User preferences
│   └── vaultDocuments.ts # Document storage
│
├── repositories/         # Data access layer
│   ├── invoice.ts
│   ├── quotation.ts
│   ├── creditNote.ts
│   ├── debitNote.ts
│   ├── customer.ts
│   ├── vendor.ts
│   └── settings.ts
│
└── types/                # Type exports
    └── index.ts

drizzle/                  # Generated migrations
├── 0000_initial.sql
├── 0001_add_vault.sql
└── meta/
```

---

## Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ created_at      │
└────────┬────────┘
         │
         │ 1:N
         │
    ┌────┴────┬──────────┬──────────┬──────────┐
    │         │          │          │          │
    ▼         ▼          ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│invoices │ │quotation│ │credit_  │ │debit_   │ │customers│
│         │ │s        │ │notes    │ │notes    │ │         │
├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤
│ id (PK) │ │ id (PK) │ │ id (PK) │ │ id (PK) │ │ id (PK) │
│ user_id │ │ user_id │ │ user_id │ │ user_id │ │ user_id │
│ number  │ │ number  │ │ number  │ │ number  │ │ name    │
│ status  │ │ status  │ │ items   │ │ items   │ │ email   │
│ items   │ │ items   │ │ ...     │ │ ...     │ │ ...     │
│ ...     │ │ ...     │ └─────────┘ └─────────┘ └─────────┘
└─────────┘ └─────────┘

Additional tables: vendors, user_settings, vault_documents
```

---

## Schema Definitions

### Users

```typescript
// src/schema/users.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Invoices

```typescript
// src/schema/invoices.ts
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const invoiceStatusEnum = ['draft', 'pending', 'paid', 'overdue', 'cancelled'] as const;

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull(),
  status: text('status', { enum: invoiceStatusEnum }).notNull().default('draft'),

  // JSONB columns for flexible data
  items: jsonb('items').$type<InvoiceItem[]>().notNull(),
  companyDetails: jsonb('company_details').$type<CompanyDetails>().notNull(),
  clientDetails: jsonb('client_details').$type<ClientDetails>().notNull(),
  invoiceDetails: jsonb('invoice_details').$type<InvoiceDetails>().notNull(),
  metadata: jsonb('metadata').$type<InvoiceMetadata>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Customers

```typescript
// src/schema/customers.ts
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address').$type<Address>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### User Settings

```typescript
// src/schema/userSettings.ts
import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  companyDetails: jsonb('company_details').$type<CompanyDetails>(),
  invoiceDefaults: jsonb('invoice_defaults').$type<InvoiceDefaults>(),
  preferences: jsonb('preferences').$type<UserPreferences>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## JSONB Type Definitions

```typescript
// Types used in JSONB columns

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;  // Decimal as string for precision
  taxRate?: number;
  amount: string;     // Calculated: quantity * unitPrice
}

interface CompanyDetails {
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  logo?: string;      // Base64 encoded
  taxId?: string;
}

interface ClientDetails {
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
}

interface InvoiceDetails {
  issueDate: string;
  dueDate: string;
  currency: string;
  notes?: string;
  terms?: string;
  subtotal: string;
  taxTotal: string;
  total: string;
}

interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
```

---

## Repository Pattern

Repositories provide a clean data access layer with type-safe queries.

### Invoice Repository

```typescript
// src/repositories/invoice.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { invoices, type Invoice, type NewInvoice } from '../schema';

export const invoiceRepository = {
  /**
   * List invoices for a user with optional filtering
   */
  async list(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    }
  ): Promise<Invoice[]> {
    let query = db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));

    if (options?.status) {
      query = query.where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.status, options.status)
        )
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  },

  /**
   * Get a single invoice by ID (with ownership check)
   */
  async get(id: string, userId: string): Promise<Invoice | undefined> {
    const results = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);

    return results[0];
  },

  /**
   * Create a new invoice
   */
  async insert(userId: string, data: NewInvoice): Promise<Invoice> {
    const results = await db
      .insert(invoices)
      .values({
        ...data,
        userId,
      })
      .returning();

    return results[0];
  },

  /**
   * Update an existing invoice
   */
  async update(
    id: string,
    userId: string,
    data: Partial<NewInvoice>
  ): Promise<Invoice | undefined> {
    const results = await db
      .update(invoices)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();

    return results[0];
  },

  /**
   * Delete an invoice
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

    return result.rowCount > 0;
  },

  /**
   * Update invoice status
   */
  async updateStatus(
    id: string,
    userId: string,
    status: Invoice['status']
  ): Promise<Invoice | undefined> {
    return this.update(id, userId, { status });
  },
};
```

---

## Database Connection

```typescript
// src/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string from environment
const connectionString = process.env.DATABASE_URL!;

// Create postgres client
const client = postgres(connectionString, {
  max: 10,              // Max connections
  idle_timeout: 20,     // Idle timeout in seconds
  connect_timeout: 10,  // Connection timeout
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });
```

---

## Type Exports

The package exports types for use across the monorepo:

```typescript
// src/types/index.ts
import { invoices, quotations, customers, vendors } from '../schema';

// Infer select types (what you get from queries)
export type Invoice = typeof invoices.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;

// Infer insert types (what you use for inserts)
export type NewInvoice = typeof invoices.$inferInsert;
export type NewQuotation = typeof quotations.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewVendor = typeof vendors.$inferInsert;

// Re-export enums
export { invoiceStatusEnum } from '../schema/invoices';
```

**Usage in other packages:**

```typescript
import { Invoice, NewInvoice, invoiceRepository } from '@open-bookkeeping/db';

// Type-safe operations
const invoice: Invoice = await invoiceRepository.get(id, userId);
const newInvoice: NewInvoice = { ... };
```

---

## Migrations

### Development Workflow

```bash
# Push schema changes directly (development only)
yarn db:push

# Open Drizzle Studio (visual database browser)
yarn db:studio
```

### Production Workflow

```bash
# Generate migration from schema changes
yarn db:generate

# Review generated SQL in drizzle/ directory

# Apply migrations
yarn db:migrate
```

### Migration Files

Generated migrations are stored in `drizzle/`:

```sql
-- drizzle/0000_initial.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invoice_number" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "items" jsonb NOT NULL,
  "company_details" jsonb NOT NULL,
  "client_details" jsonb NOT NULL,
  "invoice_details" jsonb NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

---

## Drizzle Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

---

## Query Examples

### Basic Queries

```typescript
import { db, invoices, customers } from '@open-bookkeeping/db';
import { eq, and, gt, desc, sql } from 'drizzle-orm';

// Select all invoices for a user
const userInvoices = await db
  .select()
  .from(invoices)
  .where(eq(invoices.userId, userId));

// Select with conditions
const pendingInvoices = await db
  .select()
  .from(invoices)
  .where(
    and(
      eq(invoices.userId, userId),
      eq(invoices.status, 'pending')
    )
  )
  .orderBy(desc(invoices.createdAt));

// Select specific columns
const invoiceSummary = await db
  .select({
    id: invoices.id,
    number: invoices.invoiceNumber,
    status: invoices.status,
  })
  .from(invoices)
  .where(eq(invoices.userId, userId));
```

### Joins

```typescript
// Note: Current schema uses JSONB for client details
// This example shows the pattern if using separate tables

import { invoices, customers } from '@open-bookkeeping/db';

const invoicesWithCustomers = await db
  .select({
    invoice: invoices,
    customer: customers,
  })
  .from(invoices)
  .leftJoin(customers, eq(invoices.customerId, customers.id))
  .where(eq(invoices.userId, userId));
```

### Aggregations

```typescript
import { sql, count, sum } from 'drizzle-orm';

// Count invoices by status
const statusCounts = await db
  .select({
    status: invoices.status,
    count: count(),
  })
  .from(invoices)
  .where(eq(invoices.userId, userId))
  .groupBy(invoices.status);

// Calculate totals (using JSONB extraction)
const totals = await db
  .select({
    totalInvoices: count(),
    // Extract total from JSONB
    totalAmount: sql<string>`SUM((invoice_details->>'total')::numeric)`,
  })
  .from(invoices)
  .where(eq(invoices.userId, userId));
```

### Transactions

```typescript
import { db, invoices, customers } from '@open-bookkeeping/db';

// Transactional operations
await db.transaction(async (tx) => {
  // Create customer
  const [customer] = await tx
    .insert(customers)
    .values({ userId, name: 'New Customer' })
    .returning();

  // Create invoice for customer
  await tx.insert(invoices).values({
    userId,
    invoiceNumber: 'INV-001',
    clientDetails: { name: customer.name },
    // ... other fields
  });
});
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

**Connection String Format:**

```
postgresql://user:password@host:port/database?sslmode=require
```

For Supabase:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `yarn db:push` | Push schema to database (dev) |
| `yarn db:generate` | Generate migration files |
| `yarn db:migrate` | Run pending migrations |
| `yarn db:studio` | Open Drizzle Studio |
| `yarn check-types` | TypeScript type checking |

---

## Best Practices

### Always Use User ID Filtering

```typescript
// GOOD: Always filter by userId for multi-tenant safety
await db.select().from(invoices).where(eq(invoices.userId, userId));

// BAD: No user filtering (security risk)
await db.select().from(invoices).where(eq(invoices.id, id));
```

### Use Transactions for Multi-Table Operations

```typescript
// GOOD: Use transaction for related operations
await db.transaction(async (tx) => {
  await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await tx.delete(invoices).where(eq(invoices.id, id));
});

// BAD: Separate queries (inconsistent state possible)
await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
await db.delete(invoices).where(eq(invoices.id, id));
```

### Handle JSONB Types Properly

```typescript
// Define types for JSONB columns
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

// Use type assertion in schema
items: jsonb('items').$type<InvoiceItem[]>().notNull(),
```

---

## Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit Reference](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [Supabase Database](https://supabase.com/docs/guides/database)
