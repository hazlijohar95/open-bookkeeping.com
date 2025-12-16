# AGENTS.md

## Commands

- `yarn dev` - Start all services | `yarn build` - Production build | `yarn lint` - ESLint | `yarn check-types` - TypeScript
- `yarn test` - Run Vitest | Single test: `npx vitest run path/to/file.test.ts` | Pattern: `npx vitest run -t "test name"`
- `yarn test:e2e` - Playwright E2E | Single: `npx playwright test e2e/file.spec.ts`
- `yarn db:generate && yarn db:migrate` - Schema changes (avoid `db:push`, it's slow)

## Code Style

- **Formatting**: Double quotes, semicolons, 2-space indent, trailing commas (ES5), 80 char width
- **Imports**: React → external libs → `@/components` → `@/api` → `@/lib` → `@/hooks` → `@/types` → relative
- **Type imports**: Use `import type { X }` for type-only imports (enforced by ESLint)
- **Files**: `kebab-case.tsx` for components, `use-kebab-case.ts` for hooks, `*.service.ts` for services
- **Naming**: PascalCase components/types, camelCase functions/variables, `_prefix` for unused params

## Patterns

- **Errors**: Use factory functions from `@/lib/errors.ts`: `notFound()`, `badRequest()`, `forbidden()`, etc.
- **React Query keys**: Follow factory pattern in `@/api/*.ts` (e.g., `invoiceKeys.detail(id)`)
- **Zod schemas**: Define in `@/zod-schemas/`, infer types with `z.infer<typeof schema>`
- **tRPC**: Use `protectedProcedure` with Zod input validation in `apps/api/src/trpc/services/`

## Shared Package (`@open-bookkeeping/shared`)

All common utilities, types, and schemas are centralized in `packages/shared/src/`.

### Schemas (`schemas.ts`)

- **Enums**: `valueTypeSchema`, `documentStatusSchema`, `noteReasonSchema`, `themeModeSchema`
- **Document schemas**: `billingDetailSchema`, `documentItemSchema`, `companyDetailsSchema`, `clientDetailsSchema`
- **Both API (loose) and Form (strict) versions**: e.g., `documentItemSchema` vs `documentItemFormSchema`

### Date Utilities (`date.ts`)

```typescript
import {
  formatDate,
  formatDateISO,
  differenceInDays,
  isPastDate,
} from "@open-bookkeeping/shared";

formatDate(new Date()); // "15 Dec 2024" (en-MY locale)
formatDateISO(new Date()); // "2024-12-15"
differenceInDays(dueDate, now); // Days between dates
isPastDate(date); // Boolean check
```

### Aging Utilities (`aging.ts`)

```typescript
import {
  calculateDaysOverdue,
  categorizeIntoBucket,
  calculateAgingReport,
} from "@open-bookkeeping/shared";

calculateDaysOverdue(dueDate); // Days overdue (negative if future)
categorizeIntoBucket(15); // "days1to30"
calculateAgingReport(invoices, getDueDate, getAmount); // Full aging report
```

### Calculation Utilities (`calculations.ts`)

```typescript
import {
  calculateSubtotal,
  calculateDocumentTotals,
  calculateAmountDue,
} from "@open-bookkeeping/shared";

calculateSubtotal(items); // Sum of qty × price
calculateDocumentTotals(items, billingDetails); // { subtotal, taxTotal, discountTotal, total }
calculateAmountDue(total, amountPaid); // Remaining balance
```

### Currency (`types.ts`)

```typescript
import {
  formatCurrency,
  formatNumber,
  currencies,
} from "@open-bookkeeping/shared";

formatCurrency(1000, "MYR"); // "RM 1,000.00" (en-MY locale default)
formatNumber(1234.56); // "1,234.56"
currencies; // Array of { code, symbol, name }
```

## Business Services (`apps/api/src/services/business/`)

Business logic layer between routes/tRPC and repositories. Handles webhooks, journal entries, and aggregations.

```typescript
import { invoiceBusiness } from "@/services/business";

// In tRPC or route handler:
const invoice = await invoiceBusiness.create(ctx, input);
await invoiceBusiness.update(ctx, id, input);
await invoiceBusiness.delete(ctx, id);
```

**Available services**: `invoiceBusiness`, `billBusiness`, `quotationBusiness`, `customerBusiness`, `vendorBusiness`, `creditNoteBusiness`, `debitNoteBusiness`

## V2 Database Schemas

New JSONB-based schemas in `packages/db/src/schema/`:

- `invoicesV2.ts` - Invoices with JSONB company/client/billing/metadata/theme
- `quotationsV2.ts` - Quotations with same pattern
- `creditNotesV2.ts` - Credit notes with same pattern
- `debitNotesV2.ts` - Debit notes with same pattern

Pattern: Main table + items table + activities table per document type.
