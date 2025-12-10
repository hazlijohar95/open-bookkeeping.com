# @open-bookkeeping/shared

Shared utilities, types, and configurations for Open Bookkeeping.

---

## Overview

This package contains shared code used across the Open Bookkeeping monorepo. It provides a centralized location for logging utilities, common types, validation helpers, and other cross-cutting concerns.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Pino** | Fast, low-overhead structured logging |
| **TypeScript** | Type definitions and utilities |
| **Zod** | Runtime validation helpers |

---

## Project Structure

```
src/
├── index.ts           # Package exports
├── logger.ts          # Pino logger configuration
├── types/             # Shared type definitions
│   ├── index.ts
│   ├── common.ts      # Common types (Result, Option, etc.)
│   └── currency.ts    # Currency types and codes
└── utils/             # Utility functions
    ├── index.ts
    ├── currency.ts    # Currency formatting
    ├── date.ts        # Date formatting
    └── validation.ts  # Validation helpers
```

---

## Logger

The package provides a pre-configured Pino logger for consistent logging across all services.

### Creating a Logger

```typescript
import { createLogger } from '@open-bookkeeping/shared';

// Create a named logger for your service
const logger = createLogger('invoice-service');

// Use standard log levels
logger.trace('Detailed trace information');
logger.debug('Debugging information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');
logger.fatal('Fatal error - service shutting down');
```

### Logging with Context

Always include relevant context as the first argument:

```typescript
// With context object
logger.info({ invoiceId: '123', userId: '456' }, 'Invoice created');

// With error object (use 'err' key for proper serialization)
try {
  await processInvoice(id);
} catch (error) {
  logger.error({ err: error, invoiceId: id }, 'Failed to process invoice');
}

// With timing information
const startTime = Date.now();
await heavyOperation();
logger.info({ durationMs: Date.now() - startTime }, 'Operation completed');
```

### Logger Configuration

```typescript
// src/logger.ts
import pino, { Logger } from 'pino';

interface LoggerOptions {
  level?: string;
  pretty?: boolean;
}

export function createLogger(name: string, options?: LoggerOptions): Logger {
  const level = options?.level ?? process.env.LOG_LEVEL ?? 'info';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const usePretty = options?.pretty ?? isDevelopment;

  return pino({
    name,
    level,
    ...(usePretty && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
}
```

### Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| `trace` | 10 | Very detailed debugging |
| `debug` | 20 | Debugging information |
| `info` | 30 | General operational info |
| `warn` | 40 | Warning conditions |
| `error` | 50 | Error conditions |
| `fatal` | 60 | Fatal errors, service crash |

### Output Formats

**Development (pretty-printed):**

```
[2024-12-01 10:30:00] INFO (invoice-service): Invoice created
    invoiceId: "550e8400-e29b-41d4-a716-446655440000"
    userId: "user_123"
```

**Production (JSON):**

```json
{
  "level": 30,
  "time": 1701427800000,
  "name": "invoice-service",
  "invoiceId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "msg": "Invoice created"
}
```

---

## Type Definitions

### Common Types

```typescript
// src/types/common.ts

/**
 * Represents a successful or failed operation result
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Represents a value that may or may not exist
 */
export type Option<T> = T | null | undefined;

/**
 * Makes specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Makes specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extracts the resolved type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Standard API response shape
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Currency Types

```typescript
// src/types/currency.ts

export interface Currency {
  code: string;      // ISO 4217 code (e.g., "USD")
  symbol: string;    // Currency symbol (e.g., "$")
  name: string;      // Full name (e.g., "US Dollar")
  decimals: number;  // Decimal places (usually 2)
}

export const CURRENCIES: Record<string, Currency> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '\u20ac', name: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '\u00a3', name: 'British Pound', decimals: 2 },
  JPY: { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen', decimals: 0 },
  // ... 150+ currencies
};

export type CurrencyCode = keyof typeof CURRENCIES;
```

---

## Utility Functions

### Currency Utilities

```typescript
// src/utils/currency.ts

import Decimal from 'decimal.js';
import { CURRENCIES, type CurrencyCode } from '../types/currency';

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: string | number | Decimal,
  currencyCode: CurrencyCode,
  options?: { showSymbol?: boolean; locale?: string }
): string {
  const currency = CURRENCIES[currencyCode];
  const value = new Decimal(amount);
  const { showSymbol = true, locale = 'en-US' } = options ?? {};

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(value.toNumber());

  return showSymbol ? `${currency.symbol}${formatted}` : formatted;
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return CURRENCIES[currencyCode]?.symbol ?? currencyCode;
}

/**
 * Parse currency string to Decimal
 */
export function parseCurrency(value: string): Decimal {
  // Remove currency symbols and thousand separators
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return new Decimal(cleaned || 0);
}

// Usage examples:
formatCurrency(1234.56, 'USD');          // "$1,234.56"
formatCurrency('1234.56', 'EUR');         // "\u20ac1,234.56"
formatCurrency(new Decimal('1234'), 'JPY'); // "\u00a51,234"
```

### Date Utilities

```typescript
// src/utils/date.ts

/**
 * Format a date for display
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'iso' = 'short',
  locale = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  switch (format) {
    case 'short':
      return d.toLocaleDateString(locale);
    case 'long':
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'iso':
      return d.toISOString().split('T')[0];
  }
}

/**
 * Calculate due date from issue date and payment terms
 */
export function calculateDueDate(
  issueDate: Date | string,
  paymentTermsDays: number
): Date {
  const issue = typeof issueDate === 'string' ? new Date(issueDate) : issueDate;
  const due = new Date(issue);
  due.setDate(due.getDate() + paymentTermsDays);
  return due;
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dueDate: Date | string): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return due < new Date();
}

/**
 * Get relative time description
 */
export function getRelativeTime(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = d.getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (Math.abs(days) < 1) return 'today';
  if (Math.abs(days) < 7) return rtf.format(days, 'day');
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(Math.round(days / 30), 'month');
}

// Usage examples:
formatDate(new Date(), 'short');           // "12/1/2024"
formatDate(new Date(), 'long');            // "Sunday, December 1, 2024"
formatDate(new Date(), 'iso');             // "2024-12-01"
calculateDueDate('2024-12-01', 30);        // Date: 2024-12-31
isOverdue('2024-11-01');                   // true
getRelativeTime(new Date(Date.now() + 86400000)); // "tomorrow"
```

### Validation Helpers

```typescript
// src/utils/validation.ts

import { z } from 'zod';

/**
 * Common Zod schemas for reuse
 */
export const zodSchemas = {
  // UUID validation
  uuid: z.string().uuid(),

  // Email validation
  email: z.string().email().toLowerCase().trim(),

  // Non-empty string
  nonEmptyString: z.string().min(1).trim(),

  // Currency amount (string for precision)
  currencyAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid currency format'),

  // Date string (ISO format)
  dateString: z.string().datetime(),

  // Positive integer
  positiveInt: z.number().int().positive(),

  // Percentage (0-100)
  percentage: z.number().min(0).max(100),

  // Phone number (basic validation)
  phone: z.string().regex(/^[+]?[\d\s-()]+$/, 'Invalid phone format').optional(),
};

/**
 * Validate and parse with detailed errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Result<T, z.ZodError> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }
  return formatted;
}
```

---

## Usage in Other Packages

### Installation

The package is automatically linked in the monorepo. Import directly:

```typescript
// In apps/api or apps/web
import { createLogger, formatCurrency, Result } from '@open-bookkeeping/shared';
```

### Example: API Service

```typescript
// apps/api/src/trpc/services/invoice.ts
import { createLogger, formatCurrency, isOverdue } from '@open-bookkeeping/shared';

const logger = createLogger('invoice-service');

export const invoiceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    logger.info({ userId: ctx.user.id }, 'Fetching invoices');

    const invoices = await invoiceRepository.list(ctx.user.id);

    // Add computed fields
    return invoices.map(invoice => ({
      ...invoice,
      formattedTotal: formatCurrency(
        invoice.invoiceDetails.total,
        invoice.invoiceDetails.currency
      ),
      isOverdue: isOverdue(invoice.invoiceDetails.dueDate),
    }));
  }),
});
```

### Example: React Component

```typescript
// apps/web/src/components/InvoiceCard.tsx
import { formatCurrency, formatDate, getRelativeTime } from '@open-bookkeeping/shared';

interface InvoiceCardProps {
  invoice: Invoice;
}

export function InvoiceCard({ invoice }: InvoiceCardProps) {
  const { invoiceDetails } = invoice;

  return (
    <div className="rounded-lg border p-4">
      <h3>{invoice.invoiceNumber}</h3>
      <p className="text-2xl font-bold">
        {formatCurrency(invoiceDetails.total, invoiceDetails.currency)}
      </p>
      <p className="text-sm text-gray-500">
        Due {getRelativeTime(invoiceDetails.dueDate)}
      </p>
      <p className="text-xs text-gray-400">
        Issued {formatDate(invoiceDetails.issueDate, 'short')}
      </p>
    </div>
  );
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log level | `info` |
| `NODE_ENV` | Environment mode | `development` |

### Recommended Settings

| Environment | `LOG_LEVEL` | Notes |
|-------------|-------------|-------|
| Development | `debug` | See detailed logs |
| Staging | `info` | Standard operational logs |
| Production | `warn` | Reduce log volume |

---

## Best Practices

### Logging

```typescript
// DO: Include relevant context
logger.info({ invoiceId, customerId, amount }, 'Payment received');

// DON'T: Log sensitive data
logger.info({ creditCard: '4111...' }, 'Payment processed'); // BAD!

// DO: Use appropriate log levels
logger.debug({ input }, 'Processing started');   // Debug: detailed info
logger.info({ result }, 'Processing completed'); // Info: success
logger.warn({ retries: 3 }, 'Slow response');    // Warn: degraded
logger.error({ err }, 'Processing failed');      // Error: failure

// DO: Use 'err' key for errors (Pino convention)
logger.error({ err: error }, 'Operation failed');

// DON'T: Log errors as strings
logger.error(error.message); // Loses stack trace!
```

### Type Safety

```typescript
// DO: Use shared types for consistency
import type { Result, ApiResponse } from '@open-bookkeeping/shared';

function processInvoice(id: string): Result<Invoice> {
  // ...
}

// DO: Use the currency type for type safety
import type { CurrencyCode } from '@open-bookkeeping/shared';

function formatAmount(amount: string, currency: CurrencyCode): string {
  // Type-checked: only valid currency codes allowed
}
```

---

## Adding New Utilities

1. **Create the utility** in the appropriate file under `src/utils/` or `src/types/`

2. **Export from index** in `src/index.ts`:

   ```typescript
   export { newUtility } from './utils/newUtility';
   export type { NewType } from './types/newType';
   ```

3. **Add tests** for the new utility

4. **Document usage** in this README

---

## Further Reading

- [Pino Documentation](https://getpino.io/)
- [Zod Documentation](https://zod.dev/)
- [Decimal.js](https://mikemcl.github.io/decimal.js/)
- [Intl API (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
