# Contributing to Open Bookkeeping

Thank you for your interest in contributing to Open Bookkeeping! This document provides guidelines and information to help you get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and inclusive environment for everyone.

**Our standards include:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

---

## Ways to Contribute

### Report Bugs

Found something broken? Help us fix it:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** using the bug report template
3. **Include details**:
   - Clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs. actual behavior
   - Screenshots or error logs if applicable
   - Environment (OS, browser, Node.js version)

### Suggest Features

Have an idea for improvement?

1. **Check the roadmap** in README.md to see if it is planned
2. **Search existing issues** to find similar suggestions
3. **Open a feature request** with:
   - Clear description of the feature
   - Problem it solves or value it adds
   - Mockups or examples if applicable
   - Consideration of edge cases

### Improve Documentation

Documentation improvements are always welcome:

- Fix typos or clarify confusing sections
- Add examples or use cases
- Translate documentation (future)
- Write tutorials or guides

### Submit Code

Ready to code? Here is how to get started:

1. Find an issue labeled `good first issue` or `help wanted`
2. Comment on the issue to claim it
3. Follow the development setup below
4. Submit a pull request

---

## Development Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 20 | [Download](https://nodejs.org/) |
| Yarn | 4.x | Included via Corepack |
| PostgreSQL | >= 14 | Or use [Supabase](https://supabase.com) |
| Git | >= 2.30 | For version control |

### Step 1: Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/open-bookkeeping.git
cd open-bookkeeping

# Add upstream remote for syncing
git remote add upstream https://github.com/open-bookkeeping/open-bookkeeping.git
```

### Step 2: Install Dependencies

```bash
# Enable Corepack (included with Node.js)
corepack enable

# Install all dependencies
yarn install
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - DATABASE_URL
```

### Step 4: Initialize Database

```bash
# Push schema to your database
yarn db:push

# (Optional) View database in Drizzle Studio
yarn db:studio
```

### Step 5: Start Development

```bash
# Start all services
yarn dev

# Or run individually:
yarn dev:web    # Frontend at http://localhost:5173
yarn dev:api    # Backend at http://localhost:3001
```

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge into your main branch
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

---

## Project Architecture

### Monorepo Structure

```
open-bookkeeping/
├── apps/
│   ├── web/          # React frontend (Vite + TypeScript)
│   └── api/          # Hono/tRPC backend (Node.js)
├── packages/
│   ├── db/           # Drizzle ORM schemas and repositories
│   └── shared/       # Shared utilities (logger, types)
```

### Key Directories

| Path | Purpose |
|------|---------|
| `apps/web/src/components/` | React components (ui/, pdf/, layout/) |
| `apps/web/src/routes/` | Page components and routing |
| `apps/web/src/zod-schemas/` | Validation schemas shared with backend |
| `apps/web/src/global/atoms/` | Jotai state atoms |
| `apps/api/src/trpc/services/` | tRPC routers with business logic |
| `packages/db/src/schema/` | Drizzle table definitions |
| `packages/db/src/repositories/` | Data access layer |

### Data Flow

```
User Action
    ↓
React Component (apps/web)
    ↓
React Hook Form + Zod Validation
    ↓
tRPC Client (apps/web/src/trpc/)
    ↓
tRPC Router (apps/api/src/trpc/services/)
    ↓
Repository (packages/db/src/repositories/)
    ↓
Drizzle ORM → PostgreSQL
```

---

## Coding Standards

### TypeScript

```typescript
// DO: Use explicit types for function parameters and returns
function calculateTotal(items: LineItem[]): Decimal {
  return items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
}

// DON'T: Use 'any' type
function processData(data: any) { /* avoid this */ }

// DO: Use type inference for simple cases
const isEnabled = true; // boolean is inferred

// DO: Export types from dedicated files
// types/invoice.ts
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: Decimal;
}
```

### React Components

```tsx
// DO: Use functional components with TypeScript
interface InvoiceCardProps {
  invoice: Invoice;
  onSelect: (id: string) => void;
}

export function InvoiceCard({ invoice, onSelect }: InvoiceCardProps) {
  return (
    <div onClick={() => onSelect(invoice.id)}>
      {invoice.number}
    </div>
  );
}

// DO: Keep components focused on a single responsibility
// DO: Extract complex logic into custom hooks
// DO: Use React Query for server state, Jotai for UI state
```

### State Management

```typescript
// UI State: Use Jotai atoms
import { atom, useAtom } from 'jotai';

const sidebarOpenAtom = atom(false);

export function Sidebar() {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);
  // ...
}

// Server State: Use React Query via tRPC
const { data: invoices, isLoading } = trpc.invoice.list.useQuery();
```

### Styling

```tsx
// DO: Use Tailwind CSS utility classes
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
  Save Invoice
</button>

// DO: Use Radix UI primitives for accessibility
import * as Dialog from '@radix-ui/react-dialog';

// DO: Maintain dark mode support
<div className="bg-white dark:bg-gray-900">
```

### Forms

```typescript
// DO: Use React Hook Form with Zod validation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInvoiceSchema, type CreateInvoiceInput } from '@/zod-schemas/invoice';

const form = useForm<CreateInvoiceInput>({
  resolver: zodResolver(createInvoiceSchema),
  defaultValues: {
    invoiceNumber: '',
    items: [],
  },
});
```

### API Endpoints

```typescript
// DO: Use protectedProcedure for authenticated routes
// DO: Validate input with Zod schemas
// DO: Return consistent response shapes

export const invoiceRouter = router({
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await invoiceRepository.insert(ctx.user.id, input);
      return { success: true, data: invoice };
    }),
});
```

### Currency Calculations

```typescript
// DO: Use decimal.js for all currency math
import Decimal from 'decimal.js';

const subtotal = new Decimal(quantity).times(unitPrice);
const tax = subtotal.times(taxRate).dividedBy(100);
const total = subtotal.plus(tax);

// DON'T: Use native JavaScript floating-point math
const wrong = 0.1 + 0.2; // 0.30000000000000004
```

---

## Pull Request Process

### Before Submitting

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make focused commits** following our commit guidelines

3. **Run quality checks**
   ```bash
   yarn check-types   # TypeScript validation
   yarn lint          # ESLint
   yarn format        # Prettier formatting
   yarn test:e2e      # End-to-end tests (if applicable)
   ```

4. **Update documentation** if you changed functionality

5. **Update CHANGELOG.md** for significant changes

### Submitting

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template** completely:
   - Describe what changes you made
   - Link related issues (`Fixes #123`)
   - List any breaking changes
   - Include screenshots for UI changes

### Review Process

1. **Automated checks** must pass (types, lint, tests)
2. **At least one maintainer** will review your code
3. **Address feedback** by pushing additional commits
4. **Squash and merge** once approved

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear history.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(invoice): add recurring invoice support` |
| `fix` | Bug fix | `fix(pdf): resolve font loading on Safari` |
| `docs` | Documentation | `docs(readme): update installation steps` |
| `style` | Formatting only | `style(components): fix indentation` |
| `refactor` | Code restructure | `refactor(api): simplify auth middleware` |
| `test` | Add/update tests | `test(invoice): add unit tests for calculations` |
| `chore` | Maintenance | `chore(deps): update React to v19.1` |
| `perf` | Performance | `perf(list): virtualize large invoice lists` |

### Scopes

Common scopes include: `invoice`, `quotation`, `customer`, `vendor`, `pdf`, `auth`, `api`, `db`, `ui`

### Examples

```bash
# Feature with scope
git commit -m "feat(invoice): add support for recurring invoices"

# Bug fix with issue reference
git commit -m "fix(pdf): resolve blank page issue

Fixes #234"

# Breaking change
git commit -m "feat(api)!: change invoice status enum values

BREAKING CHANGE: Status values changed from uppercase to lowercase.
Migrate existing data using: UPDATE invoices SET status = LOWER(status);"
```

### Branch Naming

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feature/` | New features | `feature/recurring-invoices` |
| `fix/` | Bug fixes | `fix/pdf-font-loading` |
| `docs/` | Documentation | `docs/api-reference` |
| `refactor/` | Code improvements | `refactor/auth-flow` |

---

## Testing

### Available Test Commands

```bash
# Run end-to-end tests
yarn test:e2e

# Run tests with UI
yarn test:e2e:ui

# Run tests in headed mode (see browser)
yarn test:e2e:headed

# Run type checking
yarn check-types
```

### Writing Tests

E2E tests use [Playwright](https://playwright.dev/):

```typescript
// apps/web/e2e/invoice.spec.ts
import { test, expect } from '@playwright/test';

test('should create a new invoice', async ({ page }) => {
  await page.goto('/invoices/new');

  await page.fill('[name="invoiceNumber"]', 'INV-001');
  await page.fill('[name="customerName"]', 'Acme Corp');

  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/invoices\/\w+/);
  await expect(page.locator('h1')).toContainText('INV-001');
});
```

### Test Requirements

- All new features should include E2E tests
- Tests should cover happy path and important edge cases
- Tests should not depend on external services (use mocks)

---

## Documentation

### Where to Document

| Change | Where to Document |
|--------|-------------------|
| New feature | README.md (features section) + code comments |
| API changes | `apps/api/README.md` + inline JSDoc |
| Database changes | `packages/db/README.md` |
| Breaking changes | CHANGELOG.md + migration guide |
| Configuration | README.md (configuration section) |

### Documentation Standards

- Use clear, concise language
- Include code examples that work
- Explain the "why," not just the "how"
- Keep documentation close to the code it describes

---

## Getting Help

### Resources

| Resource | Purpose |
|----------|---------|
| [Documentation](https://open-bookkeeping.com/docs) | Official guides and reference |
| [GitHub Discussions](https://github.com/open-bookkeeping/open-bookkeeping/discussions) | Community Q&A |
| [GitHub Issues](https://github.com/open-bookkeeping/open-bookkeeping/issues) | Bug reports and features |

### Before Asking

1. Search existing issues and discussions
2. Check the documentation
3. Try to reproduce with minimal code

### When Asking

- Describe what you are trying to accomplish
- Share relevant code snippets
- Include error messages and logs
- Mention your environment (OS, Node.js version, browser)

---

## Recognition

Contributors are recognized in:

- **README.md** - Listed as a contributor
- **Release Notes** - Credited for significant contributions
- **GitHub Profile** - Contributions appear on your profile

We appreciate every contribution, from fixing typos to implementing major features!

---

<div align="center">

**Thank you for contributing to Open Bookkeeping!**

Your work helps freelancers and small businesses around the world.

</div>
