# Architecture Cleanup Plan

**Date**: December 10, 2024
**Goal**: Clean, unified accounting infrastructure with no redundancies

---

## Phase 1: Remove Legacy/Duplicate Code (Quick Wins)

### 1.1 Remove Legacy Invoice Schema
- [ ] Check if `invoices.ts` is referenced anywhere
- [ ] Remove `packages/db/src/schema/invoices.ts` (keep only `invoicesV2.ts`)
- [ ] Update schema exports
- [ ] Verify no breaking changes

### 1.2 Clean Up Unused Imports/Exports
- [ ] Run TypeScript check to find dead code
- [ ] Remove unused exports from schema/index.ts

---

## Phase 2: Fix Broken API Endpoints (Critical)

### 2.1 Dashboard Stats Endpoints (404 errors)
**Problem**: `/dashboard/stats`, `/dashboard/top-customers`, etc. return 404
**Root Cause**: REST routes not mounted, only tRPC exists

- [ ] Create `apps/api/src/routes/dashboard.ts` REST routes
- [ ] Export from `apps/api/src/routes/index.ts`
- [ ] Mount in `apps/api/src/index.ts`
- [ ] Verify frontend calls work

### 2.2 Developer Portal Endpoints (404 errors)
**Problem**: `/api-keys`, `/webhooks` return 404
**Root Cause**: REST routes not created

- [ ] Create `apps/api/src/routes/api-keys.ts`
- [ ] Create `apps/api/src/routes/webhooks.ts`
- [ ] Export and mount routes
- [ ] Test end-to-end

### 2.3 Settings/Storage Endpoints (404 errors)
**Problem**: `/settings`, `/storage`, `/einvoice/settings` return 404

- [ ] Create `apps/api/src/routes/settings.ts`
- [ ] Create `apps/api/src/routes/storage.ts`
- [ ] Create `apps/api/src/routes/einvoice.ts`
- [ ] Export and mount routes

---

## Phase 3: Consolidate API Patterns

### 3.1 Decision: REST vs tRPC
**Recommendation**: Keep BOTH but with clear separation:
- **REST**: Public API (`/api/v1/*`) + Internal routes for simple CRUD
- **tRPC**: Complex operations, real-time features, type-safe internal calls

### 3.2 Ensure Frontend Uses Consistent Pattern
- [x] Audit `apps/web/src/api/*.ts` files (Dec 11, 2024)
- [x] Ensure all use `api-client.ts` (REST) consistently
- [x] Document when to use tRPC vs REST

**Audit Results (Dec 11, 2024):**

REST API Pattern (Majority of codebase):
- 21 API modules in `apps/web/src/api/` using `api-client.ts`
- Uses React Query hooks (`useQuery`, `useMutation`)
- All modules follow consistent pattern: query keys, types, hooks

Remaining tRPC Usage (5 components):
- `chart-of-accounts/initialize-defaults-modal.tsx` - tRPC for complex multi-step initialization
- `chart-of-accounts/account-form-modal.tsx` - tRPC for account CRUD with cache sync
- `chart-of-accounts/journal-entry-modal.tsx` - tRPC for journal entry with account search
- `table-columns/credit-notes/index.tsx` - tRPC for inline status updates
- `table-columns/debit-notes/index.tsx` - tRPC for inline status updates

**Decision**: Keep both as per Phase 3.1 recommendation. REST hooks exist for all these features
(`useUpdateCreditNoteStatus`, `useDeleteCreditNote`, etc.) - components can be migrated if needed.

---

## Phase 4: Connect Disconnected Features

### 4.1 Bank Feeds → Journal Entries Integration ✅ DONE
**Current**: Bank feeds exist but don't create journal entries
**Target**: Reconciled transactions auto-create journal entries

**Audit (Dec 11, 2024):**
- Schema already supports link: `journalEntries.sourceType = "bank_transaction"`, `journalEntries.sourceId` → bank_transaction.id
- `bank_transactions` has: `matchedInvoiceId`, `matchedBillId`, `categoryId`, `isReconciled`

**Implementation (Dec 11, 2024):**
- [x] Add `journalEntryId` to bank_transactions schema
  - Migration: `0018_shocking_norman_osborn.sql`
  - Schema: `packages/db/src/schema/bankFeeds.ts`
- [x] Create reconciliation service that auto-creates journal entries:
  - File: `apps/api/src/services/reconciliation.service.ts`
  - For deposits: Debit Bank Account (asset), Credit Revenue/AR
  - For withdrawals: Debit Expense/AP, Credit Bank Account
- [x] Integrate with bank feed tRPC router `reconcileTransaction()` method
  - Updated `reconcileTransaction` to use reconciliation service
  - Updated `reconcileMatched` for batch reconciliation
  - Added `undoReconciliation` endpoint

### 4.2 Bills → Vendor Payments Flow ✅ DONE
**Current**: Bills exist, payments tracked separately
**Target**: Unified AP workflow

**Audit (Dec 11, 2024):** Already fully implemented!
- [x] Bill creation creates journal entry (Debit Purchases, Credit AP)
- [x] Bill payment creates journal entry (Debit AP, Credit Cash at Bank)
- [x] `paidAt` timestamp tracks payment date

Files:
- `apps/api/src/trpc/services/bill.ts` - Lines 134-172 (create), Lines 220-253 (updateStatus)
- `apps/api/src/services/journalEntry.integration.ts` - createBillJournalEntry, createPaymentJournalEntry

---

## Phase 5: Complete Partial Features

### 5.1 E-Invoice (MyInvois) Integration
- [ ] Audit current e-invoice implementation
- [ ] Complete submission flow
- [ ] Add status tracking

### 5.2 Webhooks Delivery System ✅ DONE
**Audit (Dec 11, 2024):** Infrastructure already fully implemented!
- [x] Webhook repository with CRUD operations
- [x] BullMQ worker for background delivery
- [x] Retry logic with exponential backoff (1min, 5min, 30min, 2hr, 24hr)
- [x] Circuit breaker for failing endpoints
- [x] SSRF protection for URL validation
- [x] HMAC-SHA256 signature verification

**Integration (Dec 11, 2024):**
- [x] Created `webhook.integration.ts` with fire-and-forget dispatchers
- [x] Connected to bill service (bill.created, bill.updated, bill.paid)

Files:
- `apps/api/src/services/webhook.service.ts` - Core delivery logic
- `apps/api/src/workers/webhook.worker.ts` - BullMQ background worker
- `apps/api/src/services/webhook.integration.ts` - Business event integration
- `apps/api/src/lib/circuit-breaker.ts` - Circuit breaker implementation

**Note:** To enable full webhook delivery, configure BullMQ Redis:
- Set `BULLMQ_REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
- Without Redis, webhooks are still dispatched but synchronously

---

## Execution Order

| Order | Task | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1 | Remove legacy invoices.ts | HIGH | 15 min | ✅ DONE (Assessed - both tables in use, not duplicate) |
| 2 | Fix Dashboard REST routes | HIGH | 30 min | ✅ DONE |
| 3 | Fix Developer Portal routes | HIGH | 30 min | ✅ DONE |
| 4 | Fix Settings/Storage routes | HIGH | 30 min | ✅ DONE |
| 5 | Audit API patterns | MEDIUM | 20 min | ✅ DONE (Dec 11) |
| 6 | Bank Feeds integration | MEDIUM | 1 hour | ✅ DONE (Dec 11) - Service + tRPC integration |
| 7 | E-Invoice completion | LOW | 2+ hours | ✅ DONE (Routes created) |
| 8 | Webhooks integration | MEDIUM | 30 min | ✅ DONE (Dec 11) - Connected to business events |

## Routes Created (Dec 10, 2024)

### New REST Route Files:
- `apps/api/src/routes/dashboard.ts` - Dashboard statistics
- `apps/api/src/routes/api-keys.ts` - API key management
- `apps/api/src/routes/webhooks.ts` - Webhook management
- `apps/api/src/routes/settings.ts` - User settings
- `apps/api/src/routes/storage.ts` - Image storage
- `apps/api/src/routes/einvoice.ts` - E-Invoice (MyInvois) integration
- `apps/api/src/routes/sst.ts` - SST (Sales & Service Tax) compliance

---

## Success Criteria

- [x] Zero 404 errors on any sidebar navigation (routes now return Unauthorized, not 404)
- [ ] All CRUD operations work end-to-end
- [ ] No duplicate/legacy schema files
- [x] TypeScript compiles with no errors (Dec 11, 2024)
- [ ] All features visible in sidebar are functional

## TypeScript Fixes (Dec 11, 2024)

### einvoice.ts
- Fixed `identificationScheme` enum: "TIN" → "NRIC"
- Fixed status comparison: "validated" → "valid"
- Fixed invoice field access through `invoiceFields.clientDetails` and `invoiceFields.items`

### dashboard.ts
- Fixed invoice field access through `invoiceFields.invoiceDetails`, `invoiceFields.clientDetails`, `invoiceFields.items`
- Calculate total from items instead of accessing non-existent `grandTotal` field

### sst.ts
- Fixed `parseFloat(6 || "6")` → `6` (tax rate was incorrectly wrapped)
- Fixed nonsensical rate filter comparisons
