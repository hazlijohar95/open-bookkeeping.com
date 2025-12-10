# @open-bookkeeping/web

React frontend application for Open Bookkeeping.

---

## Overview

This package contains the web application for Open Bookkeeping, built with React 19 and Vite. It provides a complete invoicing interface with real-time PDF generation, offline support, and cloud synchronization.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI components with latest concurrent features |
| **Vite 6** | Fast development server and optimized builds |
| **TypeScript 5.8** | Type-safe development |
| **Tailwind CSS 4** | Utility-first styling |
| **Radix UI** | Accessible component primitives |
| **Jotai** | Atomic UI state management |
| **React Query** | Server state and caching |
| **React Hook Form** | Form handling with Zod validation |
| **@react-pdf/renderer** | Client-side PDF generation |

---

## Project Structure

```
src/
├── assets/              # Static assets (icons, images)
│
├── components/          # React components
│   ├── ui/              # Base components (Button, Input, Dialog, etc.)
│   │   └── form/        # Form field wrappers for React Hook Form
│   ├── pdf/             # PDF template components
│   │   ├── templates/   # Invoice templates (Default, Cynco, Classic)
│   │   └── shared/      # Shared PDF components (Header, Footer, etc.)
│   ├── customers/       # Customer management components
│   ├── vendors/         # Vendor management components
│   └── layout/          # Layout components (Sidebar, Header, etc.)
│
├── routes/              # Page components (file-based routing)
│   ├── dashboard/       # Dashboard page
│   ├── invoices/        # Invoice list and detail pages
│   ├── create-invoice/  # Invoice creation page
│   ├── quotations/      # Quotation pages
│   ├── create-quotation/
│   ├── credit-notes/
│   ├── create-credit-note/
│   ├── debit-notes/
│   ├── create-debit-note/
│   ├── customers/
│   ├── vendors/
│   ├── settings/
│   └── vault/
│
├── hooks/               # Custom React hooks
│   ├── use-invoice.ts   # Invoice data and mutations
│   ├── use-customer.ts  # Customer data and mutations
│   └── ...
│
├── lib/                 # Utility functions
│   ├── utils.ts         # General utilities
│   ├── currency.ts      # Currency formatting
│   └── date.ts          # Date formatting
│
├── global/
│   ├── atoms/           # Jotai state atoms
│   │   ├── ui-atoms.ts  # UI state (tabs, modals, etc.)
│   │   └── error-atoms.ts
│   ├── indexdb/         # IndexedDB configuration
│   │   └── db.ts        # Database setup and stores
│   └── instances/       # Singleton instances
│
├── providers/           # React context providers
│   ├── QueryProvider.tsx
│   └── AuthProvider.tsx
│
├── trpc/                # tRPC client configuration
│   ├── client.ts        # tRPC client setup
│   └── react.tsx        # React Query integration
│
├── types/               # TypeScript type definitions
│
└── zod-schemas/         # Zod validation schemas
    ├── invoice.ts       # Invoice validation
    ├── quotation.ts     # Quotation validation
    ├── customer.ts      # Customer validation
    └── ...
```

---

## Key Patterns

### State Management

The application uses a dual-state approach:

| State Type | Library | Use Case |
|------------|---------|----------|
| UI State | Jotai | Local UI state (tabs, modals, form state) |
| Server State | React Query | Remote data (invoices, customers, settings) |

**Jotai for UI State:**

```typescript
// src/global/atoms/ui-atoms.ts
import { atom } from 'jotai';

// Tab state for invoice form
export const invoiceTabAtom = atom<'form' | 'preview' | 'both'>('both');

// Sidebar state
export const sidebarOpenAtom = atom(true);

// Usage in component
import { useAtom } from 'jotai';
import { invoiceTabAtom } from '@/global/atoms/ui-atoms';

function InvoiceEditor() {
  const [activeTab, setActiveTab] = useAtom(invoiceTabAtom);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* ... */}
    </Tabs>
  );
}
```

**React Query for Server State:**

```typescript
// Server data is managed via tRPC hooks
import { trpc } from '@/trpc/react';

function InvoiceList() {
  const { data: invoices, isLoading } = trpc.invoice.list.useQuery();

  const createMutation = trpc.invoice.insert.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.invoice.list.invalidate();
    },
  });

  if (isLoading) return <Skeleton />;

  return (
    <ul>
      {invoices?.map(invoice => (
        <InvoiceRow key={invoice.id} invoice={invoice} />
      ))}
    </ul>
  );
}
```

---

### Form Handling

Forms use React Hook Form with Zod validation for type-safe, validated inputs.

```typescript
// src/routes/create-invoice/InvoiceForm.tsx
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInvoiceSchema, type CreateInvoiceInput } from '@/zod-schemas/invoice';

export function InvoiceForm() {
  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      invoiceNumber: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
      companyDetails: {},
      clientDetails: {},
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const onSubmit = (data: CreateInvoiceInput) => {
    // Submit to API
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="invoiceNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Invoice Number</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* More fields... */}
    </form>
  );
}
```

---

### PDF Generation

PDF templates are React components rendered with @react-pdf/renderer. Templates receive invoice data and produce a PDF document.

```typescript
// src/components/pdf/templates/DefaultTemplate.tsx
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  // ... more styles
});

interface InvoicePdfProps {
  invoice: InvoiceData;
}

export function DefaultTemplate({ invoice }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text>{invoice.invoiceNumber}</Text>
          </View>
          {invoice.companyDetails.logo && (
            <Image src={invoice.companyDetails.logo} style={styles.logo} />
          )}
        </View>

        {/* Company and Client Details */}
        <View style={styles.detailsRow}>
          <CompanySection details={invoice.companyDetails} />
          <ClientSection details={invoice.clientDetails} />
        </View>

        {/* Line Items Table */}
        <ItemsTable items={invoice.items} />

        {/* Totals */}
        <TotalsSection invoice={invoice} />
      </Page>
    </Document>
  );
}
```

**Using the PDF Component:**

```typescript
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { DefaultTemplate } from '@/components/pdf/templates/DefaultTemplate';

function InvoicePreview({ invoice }: { invoice: InvoiceData }) {
  return (
    <>
      {/* In-browser preview */}
      <PDFViewer width="100%" height={600}>
        <DefaultTemplate invoice={invoice} />
      </PDFViewer>

      {/* Download link */}
      <PDFDownloadLink
        document={<DefaultTemplate invoice={invoice} />}
        fileName={`${invoice.invoiceNumber}.pdf`}
      >
        {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
      </PDFDownloadLink>
    </>
  );
}
```

---

### Offline Storage

IndexedDB provides offline-first functionality. Data is stored locally and synced when online.

```typescript
// src/global/indexdb/db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OpenInvoicesDB extends DBSchema {
  invoices: {
    key: string;
    value: Invoice;
    indexes: { 'by-status': string; 'by-date': string };
  };
  customers: {
    key: string;
    value: Customer;
  };
  pendingSync: {
    key: string;
    value: SyncItem;
  };
}

export async function getDB(): Promise<IDBPDatabase<OpenInvoicesDB>> {
  return openDB<OpenInvoicesDB>('open-bookkeeping', 1, {
    upgrade(db) {
      // Invoices store
      const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
      invoiceStore.createIndex('by-status', 'status');
      invoiceStore.createIndex('by-date', 'createdAt');

      // Customers store
      db.createObjectStore('customers', { keyPath: 'id' });

      // Pending sync queue
      db.createObjectStore('pendingSync', { keyPath: 'id' });
    },
  });
}

// Usage
export async function cacheInvoice(invoice: Invoice) {
  const db = await getDB();
  await db.put('invoices', invoice);
}

export async function getCachedInvoices(): Promise<Invoice[]> {
  const db = await getDB();
  return db.getAll('invoices');
}
```

---

## Component Library

### Base UI Components

Located in `src/components/ui/`, these are primitive components built on Radix UI:

| Component | Description |
|-----------|-------------|
| `Button` | Primary action button with variants |
| `Input` | Text input with validation states |
| `Select` | Dropdown selection |
| `Dialog` | Modal dialog |
| `Popover` | Floating content |
| `Tabs` | Tab navigation |
| `Table` | Data table with sorting |
| `Card` | Content container |
| `Badge` | Status indicators |
| `Skeleton` | Loading placeholder |

### Form Components

Located in `src/components/ui/form/`, these wrap React Hook Form:

| Component | Description |
|-----------|-------------|
| `Form` | Form context provider |
| `FormField` | Field with label and error |
| `FormItem` | Field container |
| `FormLabel` | Accessible label |
| `FormControl` | Input wrapper |
| `FormMessage` | Error message display |

---

## Development

### Running Locally

```bash
# From monorepo root
yarn dev:web

# From this directory
yarn dev
```

The development server runs at `http://localhost:5173` with hot module replacement.

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Production build to `dist/` |
| `yarn preview` | Preview production build |
| `yarn lint` | Run ESLint |
| `yarn check-types` | TypeScript type checking |

### Testing

```bash
# Run E2E tests with Playwright
yarn test:e2e

# Run with UI
yarn test:e2e:ui

# Run in headed mode (see browser)
yarn test:e2e:headed
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_API_URL` | No | API server URL (default: `http://localhost:3001`) |

All environment variables must be prefixed with `VITE_` to be exposed to the client.

---

## Build Output

Production builds are output to `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Main bundle
│   ├── index-[hash].css     # Compiled CSS
│   └── [chunk]-[hash].js    # Code-split chunks
└── fonts/                    # PDF fonts
```

The build is optimized with:

- Tree shaking for unused code
- Code splitting for lazy-loaded routes
- CSS minification
- Asset hashing for cache busting

---

## Further Reading

- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Jotai](https://jotai.org/)
- [React PDF](https://react-pdf.org/)
